const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

const mapDepartment = (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    headUserId: row.head_user_id,
    head: row.head_name || null,
    active: row.active
});

const SELECT = `
  SELECT d.*, u.name AS head_name
  FROM departments d
  LEFT JOIN users u ON u.id = d.head_user_id
`;

const list = asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} ORDER BY d.name`);
    res.json(rows.map(mapDepartment));
});

const getOne = asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
    if (!rows[0]) throw new AppError('Department not found.', 404);
    res.json(mapDepartment(rows[0]));
});

const create = asyncHandler(async (req, res) => {
    const { code, name, headUserId, active } = req.body;
    if (!code || !name) throw new AppError('code and name are required.', 400);
    const { rows } = await query(
        `INSERT INTO departments (code, name, head_user_id, active) VALUES ($1, $2, $3, $4) RETURNING id`,
        [code, name, headUserId || null, active !== undefined ? active : true]
    );
    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Created department ${name}`, module: 'Departments', entityType: 'department', entityId: rows[0].id });
    const { rows: full } = await query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
    res.status(201).json(mapDepartment(full[0]));
});

const update = asyncHandler(async (req, res) => {
    const { code, name, headUserId, active } = req.body;
    const { rows } = await query(
        `UPDATE departments SET code = COALESCE($1, code), name = COALESCE($2, name),
       head_user_id = COALESCE($3, head_user_id), active = COALESCE($4, active), updated_at = NOW()
     WHERE id = $5 RETURNING id`,
        [code, name, headUserId, active, req.params.id]
    );
    if (!rows[0]) throw new AppError('Department not found.', 404);
    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Updated department ${req.params.id}`, module: 'Departments', entityType: 'department', entityId: rows[0].id });
    const { rows: full } = await query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
    res.json(mapDepartment(full[0]));
});

const remove = asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM departments WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows[0]) throw new AppError('Department not found.', 404);

    await logAudit(query, {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Deleted department ${rows[0].name}`,
        module: 'Departments',
        entityType: 'department',
        entityId: Number(req.params.id)
    });
    res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };