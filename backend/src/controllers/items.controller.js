const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapItem, resolveStoreId, resolveCategoryId, resolveLocationId } = require('./_helpers');

const SELECT = `
  SELECT i.*, c.name AS category_name, s.name AS store_name,
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
    const { rows } = await query(`${SELECT} ORDER BY i.id`);
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
  await assertItemStoreAccess(req.user, rows[0].store_id);
  res.json(mapItem(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { code, name, category, locationId, unit, minLevel, maxLevel, reorderLevel, unitPrice, expiryTracked = false, expiryDate, batchNo, condition } = req.body;
  if (!code || !name || !unit) {
    throw new AppError('code, name, and unit are required for an item master record.', 400);
  }

  const categoryId = await resolveCategoryId(category);
  const { rows: mainStores } = await query("SELECT id FROM stores WHERE type = 'Main Store' AND active = TRUE ORDER BY id LIMIT 1");
  if (!mainStores[0]) throw new AppError('A Main Store must exist before creating item master records.', 409);
  const storeId = mainStores[0].id;
  const resolvedLocationId = locationId ? await resolveLocationId(locationId, storeId) : null;
  let locationCode = null;
  if (resolvedLocationId) {
    const { rows: locationRows } = await query('SELECT code, type FROM locations WHERE id = $1', [resolvedLocationId]);
    if (locationRows[0]?.type !== 'BIN') throw new AppError('Items must be assigned to a BIN location.', 400);
    locationCode = locationRows[0].code;
  }

  const { rows } = await query(
    `INSERT INTO items (code, name, category_id, store_id, bin, location_id, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price, expiry_tracked, expiry_date, batch_no, item_condition)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [code, name, categoryId, storeId, locationCode, resolvedLocationId, unit, minLevel || 0, maxLevel || 0, reorderLevel || 0, 0, unitPrice || 0, Boolean(expiryTracked), expiryTracked ? expiryDate || null : null, batchNo || null, condition || null]
  );
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
  const categoryId = category !== undefined ? await resolveCategoryId(category) : undefined;
  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;
  const { rows: currentRows } = await query('SELECT store_id, location_id FROM items WHERE id = $1', [req.params.id]);
  if (!currentRows[0]) throw new AppError('Item not found.', 404);
  await assertItemStoreAccess(req.user, currentRows[0].store_id);
  const nextStoreId = storeId === undefined ? currentRows[0].store_id : storeId;
  await assertItemStoreAccess(req.user, nextStoreId);
  if (categoryId) {
    const { rows: categoryRows } = await query('SELECT store_id FROM categories WHERE id = $1', [categoryId]);
    if (categoryRows[0]?.store_id && String(categoryRows[0].store_id) !== String(nextStoreId)) {
      throw new AppError('Category must belong to the selected store.', 400);
    }
  }
  if (storeId !== undefined && locationId === undefined && Number(nextStoreId) !== Number(currentRows[0].store_id)) {
    throw new AppError('Select a BIN location when moving an item to another store.', 400);
  }
  const resolvedLocationId = locationId === undefined
    ? currentRows[0].location_id
    : await resolveLocationId(locationId, nextStoreId);
  const { rows: locationRows } = resolvedLocationId
    ? await query('SELECT code FROM locations WHERE id = $1', [resolvedLocationId])
    : { rows: [] };

  const { rows } = await query(
    `UPDATE items SET
       code = COALESCE($1, code), name = COALESCE($2, name),
      category_id = COALESCE($3, category_id), store_id = COALESCE($4, store_id),
      bin = COALESCE($5, bin), location_id = COALESCE($6, location_id), unit = COALESCE($7, unit),
       min_level = COALESCE($8, min_level), max_level = COALESCE($9, max_level),
       reorder_level = COALESCE($10, reorder_level),
       qty_on_hand = COALESCE($11, qty_on_hand), unit_price = COALESCE($12, unit_price),
       expiry_tracked = COALESCE($13, expiry_tracked),
       expiry_date = CASE WHEN COALESCE($13, expiry_tracked) THEN COALESCE($14, expiry_date) ELSE NULL END,
       batch_no = COALESCE($15, batch_no), item_condition = COALESCE($16, item_condition),
       updated_at = NOW()
     WHERE id = $17 RETURNING id`,
    [code, name, categoryId, storeId, locationRows[0]?.code || bin, resolvedLocationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryTracked, expiryDate, batchNo, condition, req.params.id]
  );
  if (!rows[0]) throw new AppError('Item not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated item ${name || rows[0].id}`, module: 'Items & Locations' });

  const { rows: full } = await query(`${SELECT} WHERE i.id = $1`, [rows[0].id]);
  res.json(mapItem(full[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM items WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('Item not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted item ${rows[0].name}`, module: 'Items & Locations' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
