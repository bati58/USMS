const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

const mapSupplier = (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    contact: row.contact,
    address: row.address,
    active: row.active
});

const list = asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM suppliers ORDER BY name');
    res.json(rows.map(mapSupplier));
});

const getOne = asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new AppError('Supplier not found.', 404);
    res.json(mapSupplier(rows[0]));
});

const create = asyncHandler(async (req, res) => {
    const { code, name, contact, address, active } = req.body;
    if (!String(code || '').trim() || !String(name || '').trim()) throw new AppError('code and name are required.', 400);
    const { rows } = await query(
        `INSERT INTO suppliers (code, name, contact, address, active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [String(code).trim(), String(name).trim(), String(contact || '').trim() || null, String(address || '').trim() || null, active !== undefined ? Boolean(active) : true]
    );
    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Created supplier ${name}`, module: 'Suppliers', entityType: 'supplier', entityId: rows[0].id });
    res.status(201).json(mapSupplier(rows[0]));
});

const update = asyncHandler(async (req, res) => {
    const { code, name, contact, address, active } = req.body;
    if (code !== undefined && !String(code || '').trim()) throw new AppError('Supplier code cannot be empty.', 400);
    if (name !== undefined && !String(name || '').trim()) throw new AppError('Supplier name cannot be empty.', 400);
    const { rows } = await query(
        `UPDATE suppliers SET code = COALESCE($1, code), name = COALESCE($2, name),
       contact = CASE WHEN $3::text IS NULL THEN contact ELSE NULLIF($3::text, '') END,
       address = CASE WHEN $4::text IS NULL THEN address ELSE NULLIF($4::text, '') END,
       active = COALESCE($5, active), updated_at = NOW()
     WHERE id = $6 RETURNING *`,
        [code === undefined ? null : String(code).trim(), name === undefined ? null : String(name).trim(), contact === undefined ? null : String(contact).trim(), address === undefined ? null : String(address).trim(), active === undefined ? null : Boolean(active), req.params.id]
    );
    if (!rows[0]) throw new AppError('Supplier not found.', 404);
    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Updated supplier ${rows[0].name}`, module: 'Suppliers', entityType: 'supplier', entityId: rows[0].id });
    res.json(mapSupplier(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM suppliers WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows[0]) throw new AppError('Supplier not found.', 404);

    await logAudit(query, {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Deleted supplier ${rows[0].name}`,
        module: 'Suppliers',
        entityType: 'supplier',
        entityId: Number(req.params.id)
    });
    res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };