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

async function resolveDepartmentHead(value) {
    if (value === undefined || value === null || value === '') return null;
    const { rows } = await query('SELECT id FROM users WHERE id = $1 AND role = $2 AND active = TRUE LIMIT 1', [value, 'Department Head']);
    if (!rows[0]) throw new AppError('Department Head must be an active Department Head user.', 400);
    return rows[0].id;
}

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
    if (!String(code || '').trim() || !String(name || '').trim()) throw new AppError('code and name are required.', 400);
    const resolvedHeadUserId = await resolveDepartmentHead(headUserId);
    const { rows } = await query(
        `INSERT INTO departments (code, name, head_user_id, active) VALUES ($1, $2, $3, $4) RETURNING id`,
        [String(code).trim(), String(name).trim(), resolvedHeadUserId, active !== undefined ? Boolean(active) : true]
    );

    if (resolvedHeadUserId) {
        await query(
            `UPDATE users SET department = $1, updated_at = NOW() WHERE id = $2`,
            [String(name).trim(), resolvedHeadUserId]
        );
    }

    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Created department ${name}`, module: 'Departments', entityType: 'department', entityId: rows[0].id });
    const { rows: full } = await query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
    res.status(201).json(mapDepartment(full[0]));
});

const update = asyncHandler(async (req, res) => {
    const { code, name, headUserId, active } = req.body;
    const existing = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
    if (!existing.rows[0]) throw new AppError('Department not found.', 404);

    if (code !== undefined && !String(code || '').trim()) throw new AppError('Department code cannot be empty.', 400);
    if (name !== undefined && !String(name || '').trim()) throw new AppError('Department name cannot be empty.', 400);
    const previousHeadUserId = existing.rows[0].head_user_id;
    const nextDepartmentName = name === undefined ? existing.rows[0].name : String(name).trim();
    const resolvedHeadUserId = await resolveDepartmentHead(headUserId);
    const headWasProvided = headUserId !== undefined;

    const { rows } = await query(
        `UPDATE departments SET code = COALESCE($1, code), name = COALESCE($2, name),
             head_user_id = CASE WHEN $3::boolean THEN $4::integer ELSE head_user_id END,
             active = COALESCE($5, active), updated_at = NOW()
    WHERE id = $6 RETURNING id`,
        [code === undefined ? null : String(code).trim(), name === undefined ? null : String(name).trim(), headWasProvided, resolvedHeadUserId, active === undefined ? null : Boolean(active), req.params.id]
    );

    if (headWasProvided && resolvedHeadUserId) {
        await query(
            `UPDATE users SET department = $1, updated_at = NOW() WHERE id = $2`,
            [nextDepartmentName, resolvedHeadUserId]
        );
    }

    if (previousHeadUserId && (!headWasProvided || Number(previousHeadUserId) !== Number(resolvedHeadUserId))) {
        await query(
            `UPDATE users SET department = NULL, updated_at = NOW() WHERE id = $1 AND department = $2`,
            [previousHeadUserId, existing.rows[0].name]
        );
    }

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