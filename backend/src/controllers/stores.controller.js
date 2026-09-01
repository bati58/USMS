const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapStore } = require('./_helpers');

const list = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM stores ORDER BY id');
  res.json(rows.map(mapStore));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM stores WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw new AppError('Store not found.', 404);
  res.json(mapStore(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { name, code, type, location, headOfStore, description, contactInfo, active } = req.body;
  if (!name || !code || !type) throw new AppError('name, code, and type are required.', 400);

  const { rows } = await query(
    `INSERT INTO stores (name, code, type, location, head_of_store, description, contact_info, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, code, type, location || null, headOfStore || null, description || null, contactInfo || null, active !== undefined ? active : true]
  );

  await logAudit(query, { userName: req.user.name, action: `Created store ${name}`, module: 'Store Management' });
  res.status(201).json(mapStore(rows[0]));
});

const update = asyncHandler(async (req, res) => {
  const { name, code, type, location, headOfStore, description, contactInfo, active } = req.body;
  const { rows } = await query(
    `UPDATE stores SET
       name = COALESCE($1, name), code = COALESCE($2, code), type = COALESCE($3, type),
       location = COALESCE($4, location), head_of_store = COALESCE($5, head_of_store),
       description = COALESCE($6, description), contact_info = COALESCE($7, contact_info),
       active = COALESCE($8, active), updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [name, code, type, location, headOfStore, description, contactInfo, active, req.params.id]
  );
  if (!rows[0]) throw new AppError('Store not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated store ${rows[0].name}`, module: 'Store Management' });
  res.json(mapStore(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM stores WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('Store not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted store ${rows[0].name}`, module: 'Store Management' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
