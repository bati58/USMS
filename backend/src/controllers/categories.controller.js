const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapCategory } = require('./_helpers');

const SELECT = `
  SELECT c.*, s.name AS store_name
  FROM categories c
  LEFT JOIN stores s ON s.id = c.store_id
`;

const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY c.id`);
  res.json(rows.map(mapCategory));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Category not found.', 404);
  res.json(mapCategory(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { code, name, description, active } = req.body;
  if (!String(code || '').trim() || !String(name || '').trim()) throw new AppError('code and name are required.', 400);

  const { rows } = await query(
    'INSERT INTO categories (code, name, store_id, description, active) VALUES ($1, $2, NULL, $3, $4) RETURNING id',
    [String(code).trim(), String(name).trim(), String(description || '').trim() || null, active !== undefined ? Boolean(active) : true]
  );

  await logAudit(query, { userName: req.user.name, action: `Created category ${name}`, module: 'Item Category' });

  const { rows: full } = await query(`${SELECT} WHERE c.id = $1`, [rows[0].id]);
  res.status(201).json(mapCategory(full[0]));
});

const update = asyncHandler(async (req, res) => {
  const { code, name, description, active } = req.body;
  if (code !== undefined && !String(code || '').trim()) throw new AppError('Category code cannot be empty.', 400);
  if (name !== undefined && !String(name || '').trim()) throw new AppError('Category name cannot be empty.', 400);

  const { rows } = await query(
    `UPDATE categories SET
       code = COALESCE($1, code), name = COALESCE($2, name),
       store_id = NULL, description = CASE WHEN $3::text IS NULL THEN description ELSE NULLIF($3::text, '') END,
       active = COALESCE($4, active), updated_at = NOW()
     WHERE id = $5 RETURNING id`,
    [code === undefined ? null : String(code).trim(), name === undefined ? null : String(name).trim(), description === undefined ? null : String(description).trim(), active === undefined ? null : Boolean(active), req.params.id]
  );
  if (!rows[0]) throw new AppError('Category not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated category ${name || rows[0].id}`, module: 'Item Category' });

  const { rows: full } = await query(`${SELECT} WHERE c.id = $1`, [rows[0].id]);
  res.json(mapCategory(full[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM categories WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('Category not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted category ${rows[0].name}`, module: 'Item Category' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
