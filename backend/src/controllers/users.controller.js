const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapUser } = require('./_helpers');

const list = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM users ORDER BY id');
  res.json(rows.map(mapUser));
});

const listStockClerks = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM users WHERE role = $1 AND active = TRUE ORDER BY name`,
    ['Stock Clerk']
  );
  res.json(rows.map(mapUser));
});

const listAssetCustodians = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, username, role, email, department, active
     FROM users
     WHERE active = TRUE
     ORDER BY name`
  );
  res.json(rows.map(mapUser));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw new AppError('User not found.', 404);
  res.json(mapUser(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { name, username, email, role, department, password, active } = req.body;
  if (!name || !username || !role) {
    throw new AppError('name, username, and role are required.', 400);
  }
  if (password && password.length < 8) {
    throw new AppError('Password must be at least 8 characters.', 400);
  }
  const passwordHash = await bcrypt.hash(password || 'sms@1234', 10);

  const { rows } = await query(
    `INSERT INTO users (name, username, password_hash, role, email, department, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, username, passwordHash, role, email || null, department || null, active !== undefined ? active : true]
  );

  await logAudit(query, {
    userName: req.user.name,
    action: `Created user account for ${name}`,
    module: 'User Management'
  });

  res.status(201).json(mapUser(rows[0]));
});

const update = asyncHandler(async (req, res) => {
  const { name, username, email, role, department, active, password } = req.body;
  if (password && password.length < 8) {
    throw new AppError('Password must be at least 8 characters.', 400);
  }
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($1, name),
       username = COALESCE($2, username),
       email = COALESCE($3, email),
       role = COALESCE($4, role),
       department = COALESCE($5, department),
       active = COALESCE($6, active),
       password_hash = COALESCE($7, password_hash),
       updated_at = NOW()
    WHERE id = $8 RETURNING *`,
    [name, username, email, role, department, active, passwordHash, req.params.id]
  );
  if (!rows[0]) throw new AppError('User not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated user ${rows[0].name}`, module: 'User Management' });
  await query(
    `UPDATE store_user_assignments
     SET active = FALSE, effective_to = CURRENT_DATE, updated_at = NOW()
     WHERE user_id = $1 AND active = TRUE
       AND ($2 = FALSE OR assignment_role <> $3)`,
    [rows[0].id, rows[0].active, rows[0].role]
  );

  res.json(mapUser(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('User not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted user ${rows[0].name}`, module: 'User Management' });

  res.status(204).send();
});

module.exports = { list, listStockClerks, listAssetCustodians, getOne, create, update, remove };
