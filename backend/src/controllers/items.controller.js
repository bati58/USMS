const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapItem, resolveStoreId, resolveCategoryId, resolveLocationId, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');

const SELECT = `
   SELECT i.*, c.name AS category_name,
       s.name AS store_name,
          l.name AS location_name, l.code AS location_code,
          section_location.code AS section_code, rack_location.code AS rack_code,
          shelf_location.code AS shelf_code,
          NULLIF(CONCAT_WS(' / ', section_location.name, rack_location.name, shelf_location.name, l.name), '') AS location_path
   FROM items i
   LEFT JOIN categories c ON c.id = i.category_id
  LEFT JOIN stores s ON s.id = i.store_id
   LEFT JOIN locations l ON l.id = i.location_id
   LEFT JOIN locations shelf_location ON shelf_location.id = l.parent_id AND l.type = 'BIN'
   LEFT JOIN locations rack_location ON rack_location.id = shelf_location.parent_id
   LEFT JOIN locations section_location ON section_location.id = rack_location.parent_id
`;

function validateItemFields({ code, name, unit, minLevel, maxLevel, reorderLevel, unitPrice, expiryTracked, expiryDate }) {
  if (!String(code || '').trim() || !String(name || '').trim() || !String(unit || '').trim()) {
    throw new AppError('code, name, and unit are required for an item master record.', 400);
  }

  for (const [label, value] of [
    ['minimum level', minLevel],
    ['maximum level', maxLevel],
    ['reorder level', reorderLevel],
    ['unit price', unitPrice]
  ]) {
    if (value !== undefined && value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      throw new AppError(`${label} must be a non-negative number.`, 400);
    }
  }

  if (expiryTracked && !String(expiryDate || '').trim()) {
    throw new AppError('An expiry date is required when expiry tracking is enabled.', 400);
  }
}

async function getItemStoreScope(user) {
  if (!['Store Head', 'Storekeeper'].includes(user?.role)) return null;

  if (user?.id) {
    const { rows } = await query(
      `SELECT DISTINCT s.id
       FROM store_user_assignments a
       JOIN stores s ON s.id = a.store_id
       WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE
       UNION
       SELECT s.id
       FROM stores s
       WHERE s.active = TRUE AND (
         ($2 = 'Store Head' AND s.head_of_store = $3) OR
         ($2 = 'Storekeeper' AND s.storekeeper = $3)
       )
       ORDER BY id`,
      [user.id, user.role, user.name]
    );
    if (rows.length) return rows.map((row) => Number(row.id));
  }

  const assignmentColumn = user.role === 'Store Head' ? 'head_of_store' : 'storekeeper';
  const { rows } = await query(
    `SELECT id FROM stores WHERE ${assignmentColumn} = $1 AND active = TRUE ORDER BY id`,
    [user.name]
  );
  return rows.map((row) => Number(row.id));
}

async function assertItemStoreAccess(user, storeId) {
  const scope = await getItemStoreScope(user);
  if (scope !== null && !scope.some((id) => Number(id) === Number(storeId))) {
    throw new AppError('You may access items only within your assigned store.', 403);
  }
}

const list = asyncHandler(async (req, res) => {
  if (req.query.catalog === 'master' || req.query.catalog === 'requisition') {
    const scope = await getItemStoreScope(req.user);
    const params = scope === null ? [] : [scope];
    const where = scope === null
      ? ''
      : ' WHERE EXISTS (SELECT 1 FROM item_inventory ii_scope WHERE ii_scope.item_id = i.id AND ii_scope.store_id = ANY($1::int[]))';
    const { rows } = await query(`${SELECT}${where} ORDER BY i.id`, params);
    return res.json(rows.map(mapItem));
  }
  if (req.query.inventory === 'true') {
    const { rows } = await query(`
      SELECT i.*, ii.store_id AS inventory_store_id, ii.bin AS inventory_bin,
             ii.location_id AS inventory_location_id, ii.qty_on_hand AS inventory_qty_on_hand,
             ii.unit_price AS inventory_unit_price, ii.min_level AS inventory_min_level,
             ii.max_level AS inventory_max_level, ii.reorder_level AS inventory_reorder_level,
             ii.expiry_tracked AS inventory_expiry_tracked, ii.expiry_date AS inventory_expiry_date,
             ii.batch_no AS inventory_batch_no, ii.item_condition AS inventory_condition,
             c.name AS category_name, s.name AS store_name,
             l.name AS location_name, l.code AS location_code
      FROM item_inventory ii
      JOIN items i ON i.id = ii.item_id
      LEFT JOIN categories c ON c.id = i.category_id
      JOIN stores s ON s.id = ii.store_id
      LEFT JOIN locations l ON l.id = ii.location_id
      ORDER BY i.name, s.name
    `);
    return res.json(rows.map((row) => mapItem({
      ...row,
      store_id: row.inventory_store_id,
      bin: row.inventory_bin,
      location_id: row.inventory_location_id,
      qty_on_hand: row.inventory_qty_on_hand,
      unit_price: row.inventory_unit_price,
      min_level: row.inventory_min_level,
      max_level: row.inventory_max_level,
      reorder_level: row.inventory_reorder_level,
      expiry_tracked: row.inventory_expiry_tracked,
      expiry_date: row.inventory_expiry_date,
      batch_no: row.inventory_batch_no,
      item_condition: row.inventory_condition
    })));
  }
  const scope = await getItemStoreScope(req.user);
  const params = scope === null ? [] : [scope];
  const where = scope === null ? '' : ' WHERE EXISTS (SELECT 1 FROM item_inventory ii_scope WHERE ii_scope.item_id = i.id AND ii_scope.store_id = ANY($1::int[]))';
  const { rows } = await query(`${SELECT}${where} ORDER BY i.id`, params);
  res.json(rows.map(mapItem));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE i.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Item not found.', 404);
  // Item master is institution-wide; no store access check needed here.
  res.json(mapItem(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { code, name, category, store, locationId, unit, minLevel, maxLevel, reorderLevel, unitPrice, expiryTracked = false, expiryDate, batchNo, condition } = req.body;
  const normalizedCode = String(code || '').trim();
  const normalizedName = String(name || '').trim();
  if (!code || !name || !unit) {
    throw new AppError('code, name, and unit are required for an item master record.', 400);
  }
  if (!String(category || '').trim()) {
    throw new AppError('Category is required for an item master record.', 400);
  }
  validateItemFields({ code, name, unit, minLevel, maxLevel, reorderLevel, unitPrice, expiryTracked, expiryDate });

  const categoryId = await resolveCategoryId(category);
  const visibility = await getUserStoreVisibility(req.user);
  let storeId;
  if (locationId) {
    const { rows: locationStoreRows } = await query(
      'SELECT store_id FROM locations WHERE id = $1 AND type = $2 AND active = TRUE',
      [locationId, 'BIN']
    );
    if (!locationStoreRows[0]) throw new AppError('Selected BIN location was not found or is inactive.', 400);
    storeId = locationStoreRows[0].store_id;
  }
  if (visibility !== null) {
    if (store) storeId = await resolveStoreId(store);
    if (!storeId && visibility.assignedStoreId) storeId = visibility.assignedStoreId;
    if (!storeId) throw new AppError('Your account is not assigned to a store for item creation.', 403);
    await assertItemStoreAccess(req.user, storeId);
  } else {
    const { rows: mainStores } = await query("SELECT id FROM stores WHERE type = 'Main Store' AND active = TRUE ORDER BY id LIMIT 1");
    if (!mainStores[0]) throw new AppError('A Main Store must exist before creating item master records.', 409);
    storeId = mainStores[0].id;
  }
  const resolvedLocationId = locationId ? await resolveLocationId(locationId, storeId) : null;
  let locationCode = null;
  if (resolvedLocationId) {
    const { rows: locationRows } = await query('SELECT code, type FROM locations WHERE id = $1', [resolvedLocationId]);
    if (locationRows[0]?.type !== 'BIN') throw new AppError('Items must be assigned to a BIN location.', 400);
    locationCode = locationRows[0].code;
  }

  const { rows: existingRows } = await query(
    `SELECT i.*, c.name AS category_name
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE LOWER(i.code) = LOWER($1)
     LIMIT 1`,
    [normalizedCode]
  );
  if (existingRows[0]) {
    const existing = existingRows[0];
    if (String(existing.name).trim().toLowerCase() !== normalizedName.toLowerCase()
      || String(existing.unit).trim().toLowerCase() !== String(unit).trim().toLowerCase()
      || Number(existing.category_id) !== Number(categoryId)) {
      throw new AppError(`Item code ${normalizedCode} already belongs to a different item. Reuse the existing item name, category, and unit.`, 409);
    }

    const { rows: inventoryRows } = await query(
      `INSERT INTO item_inventory (item_id, store_id, location_id, bin, qty_on_hand, unit_price, min_level, max_level, reorder_level, expiry_tracked, expiry_date, batch_no, item_condition)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (item_id, store_id) DO NOTHING
       RETURNING item_id`,
      [existing.id, storeId, resolvedLocationId, locationCode, unitPrice || existing.unit_price, minLevel || 0, maxLevel || 0, reorderLevel || 0, Boolean(expiryTracked), expiryTracked ? expiryDate || null : null, batchNo || null, condition || null]
    );
    if (!inventoryRows[0]) {
      throw new AppError(`Item ${normalizedCode} already exists in the selected store. Edit the existing store inventory instead.`, 409);
    }

    await logAudit(query, { userName: req.user.name, action: `Added existing item ${normalizedName} (${normalizedCode}) to store inventory`, module: 'Items & Locations' });
    const { rows: full } = await query(`${SELECT} WHERE i.id = $1`, [existing.id]);
    return res.status(201).json(mapItem(full[0]));
  }

  // Insert into items (global master) without store-specific fields
  const { rows } = await query(
    `INSERT INTO items (code, name, category_id, store_id, bin, unit, min_level, max_level, reorder_level,
                        qty_on_hand, unit_price, expiry_tracked, expiry_date, batch_no, item_condition, location_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [normalizedCode, normalizedName, categoryId, storeId, locationCode, unit, minLevel || 0, maxLevel || 0, reorderLevel || 0,
      unitPrice || 0, Boolean(expiryTracked), expiryTracked ? expiryDate || null : null, batchNo || null, condition || null, resolvedLocationId]
  );
  // Create initial inventory record for the assigned store
  await query(
    `INSERT INTO item_inventory (item_id, store_id, location_id, bin, qty_on_hand, unit_price, min_level, max_level, reorder_level, expiry_tracked, expiry_date, batch_no, item_condition)
     VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [rows[0].id, storeId, resolvedLocationId, locationCode, unitPrice || 0, minLevel || 0, maxLevel || 0, reorderLevel || 0, Boolean(expiryTracked), expiryTracked ? expiryDate || null : null, batchNo || null, condition || null]
  );

  await logAudit(query, { userName: req.user.name, action: `Created item ${name} (${code})`, module: 'Items & Locations' });

  const { rows: full } = await query(`${SELECT} WHERE i.id = $1`, [rows[0].id]);
  res.status(201).json(mapItem(full[0]));
});

const update = asyncHandler(async (req, res) => {
  const { code, name, category, store, bin, locationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryTracked, expiryDate, batchNo, condition } = req.body;
  const normalizedCode = code === undefined ? undefined : String(code).trim();
  const normalizedName = name === undefined ? undefined : String(name).trim();
  const categoryId = category !== undefined ? await resolveCategoryId(category) : undefined;
  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;
  const { rows: currentRows } = await query('SELECT * FROM items WHERE id = $1', [req.params.id]);
  if (!currentRows[0]) throw new AppError('Item not found.', 404);
  validateItemFields({
    code: normalizedCode === undefined ? currentRows[0].code : normalizedCode,
    name: normalizedName === undefined ? currentRows[0].name : normalizedName,
    category: category === undefined ? 'existing' : category,
    unit: unit === undefined ? currentRows[0].unit : unit,
    minLevel: minLevel === undefined ? currentRows[0].min_level : minLevel,
    maxLevel: maxLevel === undefined ? currentRows[0].max_level : maxLevel,
    reorderLevel: reorderLevel === undefined ? currentRows[0].reorder_level : reorderLevel,
    unitPrice: unitPrice === undefined ? currentRows[0].unit_price : unitPrice,
    expiryTracked: expiryTracked === undefined ? currentRows[0].expiry_tracked : expiryTracked,
    expiryDate: expiryDate === undefined ? currentRows[0].expiry_date : expiryDate,
    condition
  });
  let targetStoreId = storeId === undefined ? currentRows[0].store_id : storeId;
  let selectedLocationId = locationId;
  if (locationId !== undefined && String(locationId).trim() !== '') {
    const { rows: selectedLocationRows } = await query(
      'SELECT store_id, type, active FROM locations WHERE id = $1',
      [locationId]
    );
    if (!selectedLocationRows[0] || !selectedLocationRows[0].active || selectedLocationRows[0].type !== 'BIN') {
      throw new AppError('Selected BIN location was not found or is inactive.', 400);
    }
    targetStoreId = selectedLocationRows[0].store_id;
    selectedLocationId = Number(locationId);
  }
  await assertItemStoreAccess(req.user, targetStoreId);
  if (categoryId) {
    const { rows: categoryRows } = await query('SELECT store_id FROM categories WHERE id = $1', [categoryId]);
    if (categoryRows[0]?.store_id && String(categoryRows[0].store_id) !== String(targetStoreId)) {
      throw new AppError('Category must belong to the selected store.', 400);
    }
  }
  const resolvedLocationId = locationId === undefined
    ? currentRows[0].location_id
    : await resolveLocationId(selectedLocationId, targetStoreId);
  const { rows: locationRows } = resolvedLocationId
    ? await query('SELECT code, type FROM locations WHERE id = $1', [resolvedLocationId])
    : { rows: [] };
  if (locationRows[0] && locationRows[0].type !== 'BIN') throw new AppError('Items must be assigned to a BIN location.', 400);
  const resolvedBin = locationRows[0]?.code || bin;
  const { rows } = await query(
    `UPDATE items SET
       code = COALESCE($1, code), name = COALESCE($2, name),
      category_id = COALESCE($3, category_id), store_id = CASE WHEN $18 THEN store_id ELSE COALESCE($4, store_id) END,
      bin = CASE WHEN $18 THEN bin ELSE COALESCE($5, bin) END,
      location_id = CASE WHEN $18 THEN location_id ELSE COALESCE($6, location_id) END,
      unit = COALESCE($7, unit),
       min_level = COALESCE($8, min_level), max_level = COALESCE($9, max_level),
       reorder_level = COALESCE($10, reorder_level),
       qty_on_hand = COALESCE($11, qty_on_hand), unit_price = COALESCE($12, unit_price),
       expiry_tracked = COALESCE($13, expiry_tracked),
       expiry_date = CASE WHEN COALESCE($13, expiry_tracked) THEN COALESCE($14, expiry_date) ELSE NULL END,
       batch_no = COALESCE($15, batch_no), item_condition = COALESCE($16, item_condition),
       updated_at = NOW()
     WHERE id = $17 RETURNING id`,
    [normalizedCode, normalizedName, categoryId, targetStoreId, resolvedBin, resolvedLocationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryTracked, expiryDate, batchNo, condition, req.params.id, Number(targetStoreId) !== Number(currentRows[0].store_id)]
  );
  if (!rows[0]) throw new AppError('Item not found.', 404);

  if (Number(targetStoreId) !== Number(currentRows[0].store_id)) {
    await query(
      `INSERT INTO item_inventory (item_id, store_id, location_id, bin, qty_on_hand, unit_price, min_level, max_level, reorder_level, expiry_tracked, expiry_date, batch_no, item_condition)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (item_id, store_id) DO UPDATE SET
         location_id = EXCLUDED.location_id, bin = EXCLUDED.bin, unit_price = EXCLUDED.unit_price,
         min_level = EXCLUDED.min_level, max_level = EXCLUDED.max_level, reorder_level = EXCLUDED.reorder_level,
         expiry_tracked = EXCLUDED.expiry_tracked, expiry_date = EXCLUDED.expiry_date,
         batch_no = EXCLUDED.batch_no, item_condition = EXCLUDED.item_condition, updated_at = NOW()`,
      [req.params.id, targetStoreId, resolvedLocationId, resolvedBin, unitPrice ?? currentRows[0].unit_price,
      minLevel ?? currentRows[0].min_level, maxLevel ?? currentRows[0].max_level, reorderLevel ?? currentRows[0].reorder_level,
      expiryTracked ?? currentRows[0].expiry_tracked, expiryDate ?? currentRows[0].expiry_date, batchNo ?? currentRows[0].batch_no, condition ?? currentRows[0].item_condition]
    );
  } else {
    await query(
      `UPDATE item_inventory SET
       location_id = COALESCE($1, location_id), bin = COALESCE($2, bin),
       min_level = COALESCE($3, min_level), max_level = COALESCE($4, max_level), reorder_level = COALESCE($5, reorder_level),
       unit_price = COALESCE($6, unit_price), expiry_tracked = COALESCE($7, expiry_tracked),
       expiry_date = CASE WHEN COALESCE($7, expiry_tracked) THEN COALESCE($8, expiry_date) ELSE NULL END,
       batch_no = COALESCE($9, batch_no), item_condition = COALESCE($10, item_condition), updated_at = NOW()
       WHERE item_id = $11 AND store_id = $12`,
      [resolvedLocationId, resolvedBin, minLevel, maxLevel, reorderLevel, unitPrice, expiryTracked, expiryDate, batchNo, condition, req.params.id, currentRows[0].store_id]
    );
  }

  await logAudit(query, { userName: req.user.name, action: `Updated item ${name || rows[0].id}`, module: 'Items & Locations' });

  const { rows: full } = await query(`${SELECT} WHERE i.id = $1`, [rows[0].id]);
  res.json(mapItem(full[0]));
});

const remove = asyncHandler(async (req, res) => {
  // Delete item master and cascade inventory rows (ON DELETE RESTRICT currently, so delete inventory first)
  await query('DELETE FROM item_inventory WHERE item_id = $1', [req.params.id]);
  const { rows } = await query('DELETE FROM items WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('Item not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted item ${rows[0].name}`, module: 'Items & Locations' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
