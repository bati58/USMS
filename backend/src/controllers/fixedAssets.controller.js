const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapFixedAsset, resolveStoreId } = require('./_helpers');

const SELECT = `
  SELECT fa.*, s.name AS store_name
  FROM fixed_assets fa
  LEFT JOIN stores s ON s.id = fa.store_id
`;

const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY fa.id DESC`);
  res.json(rows.map(mapFixedAsset));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE fa.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);
  res.json(mapFixedAsset(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { assetTag, name, category, store, assignedTo, status, acquisitionDate, value } = req.body;
  if (!assetTag || !name) throw new AppError('assetTag and name are required.', 400);

  const storeId = await resolveStoreId(store);
  const { rows } = await query(
    `INSERT INTO fixed_assets (asset_tag, name, category, store_id, assigned_to, status, acquisition_date, value)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'In Store'),$7,COALESCE($8,0)) RETURNING id`,
    [assetTag, name, category || null, storeId, assignedTo || null, status, acquisitionDate || null, value]
  );

  await logAudit(query, { userName: req.user.name, action: `Registered asset ${assetTag}`, module: 'Fixed Assets' });

  const { rows: full } = await query(`${SELECT} WHERE fa.id = $1`, [rows[0].id]);
  res.status(201).json(mapFixedAsset(full[0]));
});

const update = asyncHandler(async (req, res) => {
  const { assetTag, name, category, store, assignedTo, status, acquisitionDate, value } = req.body;
  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;

  const { rows } = await query(
    `UPDATE fixed_assets SET
       asset_tag = COALESCE($1, asset_tag), name = COALESCE($2, name), category = COALESCE($3, category),
       store_id = COALESCE($4, store_id), assigned_to = COALESCE($5, assigned_to),
       status = COALESCE($6, status), acquisition_date = COALESCE($7, acquisition_date),
       value = COALESCE($8, value), updated_at = NOW()
     WHERE id = $9 RETURNING id`,
    [assetTag, name, category, storeId, assignedTo, status, acquisitionDate, value, req.params.id]
  );
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated asset ${assetTag || rows[0].id}`, module: 'Fixed Assets' });

  const { rows: full } = await query(`${SELECT} WHERE fa.id = $1`, [rows[0].id]);
  res.json(mapFixedAsset(full[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM fixed_assets WHERE id = $1 RETURNING asset_tag', [req.params.id]);
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);
  await logAudit(query, { userName: req.user.name, action: `Deleted asset ${rows[0].asset_tag}`, module: 'Fixed Assets' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
