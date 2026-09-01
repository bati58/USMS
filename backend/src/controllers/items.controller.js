const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapItem, resolveStoreId, resolveCategoryId, resolveLocationId } = require('./_helpers');

const SELECT = `
  SELECT i.*, c.name AS category_name, s.name AS store_name, l.name AS location_name
  FROM items i
  LEFT JOIN categories c ON c.id = i.category_id
  LEFT JOIN stores s ON s.id = i.store_id
  LEFT JOIN locations l ON l.id = i.location_id
`;

const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY i.id`);
  res.json(rows.map(mapItem));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE i.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Item not found.', 404);
  res.json(mapItem(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { code, name, category, store, bin, locationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryDate, batchNo, condition } = req.body;
  if (!code || !name || !store || !unit) {
    throw new AppError('code, name, store, and unit are required.', 400);
  }

  const categoryId = await resolveCategoryId(category);
  const storeId = await resolveStoreId(store);
  const resolvedLocationId = await resolveLocationId(locationId, storeId);

  const { rows } = await query(
    `INSERT INTO items (code, name, category_id, store_id, bin, location_id, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price, expiry_date, batch_no, item_condition)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [code, name, categoryId, storeId, bin || null, resolvedLocationId, unit, minLevel || 0, maxLevel || 0, reorderLevel || 0, qtyOnHand || 0, unitPrice || 0, expiryDate || null, batchNo || null, condition || null]
  );

  await logAudit(query, { userName: req.user.name, action: `Created item ${name} (${code})`, module: 'Items & Locations' });

  const { rows: full } = await query(`${SELECT} WHERE i.id = $1`, [rows[0].id]);
  res.status(201).json(mapItem(full[0]));
});

const update = asyncHandler(async (req, res) => {
  const { code, name, category, store, bin, locationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryDate, batchNo, condition } = req.body;
  const categoryId = category !== undefined ? await resolveCategoryId(category) : undefined;
  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;
  const resolvedLocationId = locationId !== undefined && storeId !== undefined
    ? await resolveLocationId(locationId, storeId)
    : locationId;

  const { rows } = await query(
    `UPDATE items SET
       code = COALESCE($1, code), name = COALESCE($2, name),
       category_id = COALESCE($3, category_id), store_id = COALESCE($4, store_id),
       bin = COALESCE($5, bin), location_id = COALESCE($6, location_id), unit = COALESCE($7, unit),
       min_level = COALESCE($8, min_level), max_level = COALESCE($9, max_level),
       reorder_level = COALESCE($10, reorder_level),
       qty_on_hand = COALESCE($11, qty_on_hand), unit_price = COALESCE($12, unit_price),
       expiry_date = COALESCE($13, expiry_date), batch_no = COALESCE($14, batch_no),
       item_condition = COALESCE($15, item_condition),
       updated_at = NOW()
     WHERE id = $16 RETURNING id`,
    [code, name, categoryId, storeId, bin, resolvedLocationId, unit, minLevel, maxLevel, reorderLevel, qtyOnHand, unitPrice, expiryDate, batchNo, condition, req.params.id]
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
