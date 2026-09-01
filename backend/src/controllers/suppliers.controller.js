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
    if (!code || !name) throw new AppError('code and name are required.', 400);
    const { rows } = await query(
        `INSERT INTO suppliers (code, name, contact, address, active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [code, name, contact || null, address || null, active !== undefined ? active : true]
    );
    await logAudit(query, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Created supplier ${name}`, module: 'Suppliers', entityType: 'supplier', entityId: rows[0].id });
    res.status(201).json(mapSupplier(rows[0]));
});

const update = asyncHandler(async (req, res) => {
    const { code, name, contact, address, active } = req.body;
    const { rows } = await query(
        `UPDATE suppliers SET code = COALESCE($1, code), name = COALESCE($2, name),
       contact = COALESCE($3, contact), address = COALESCE($4, address),
       active = COALESCE($5, active), updated_at = NOW()
     WHERE id = $6 RETURNING *`,
        [code, name, contact, address, active, req.params.id]
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