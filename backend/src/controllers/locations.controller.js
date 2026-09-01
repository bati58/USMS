const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapLocation, resolveStoreId } = require('./_helpers');

const SELECT = `
  SELECT l.*, s.name AS store_name, p.name AS parent_name
  FROM locations l
  JOIN stores s ON s.id = l.store_id
  LEFT JOIN locations p ON p.id = l.parent_id
`;

const LOCATION_TYPES = ['SECTION', 'RACK', 'SHELF', 'BIN'];
const PARENT_TYPES = { RACK: 'SECTION', SHELF: 'RACK', BIN: 'SHELF' };

async function validateLocationHierarchy({ storeId, parentId, type, locationId = null }) {
    if (!LOCATION_TYPES.includes(type)) throw new AppError('Location level must be SECTION, RACK, SHELF, or BIN.', 400);
    if (type === 'SECTION' && parentId) throw new AppError('A section cannot have a parent location.', 400);
    if (type !== 'SECTION' && !parentId) throw new AppError(`${type} must have a parent location.`, 400);
    if (!parentId) return;

    if (locationId && String(parentId) === String(locationId)) {
        throw new AppError('A location cannot be its own parent.', 400);
    }

    const { rows } = await query('SELECT id, store_id, type FROM locations WHERE id = $1', [parentId]);
    if (!rows[0]) throw new AppError('Parent location not found.', 400);
    if (String(rows[0].store_id) !== String(storeId)) throw new AppError('Parent location must belong to the selected store.', 400);
    if (rows[0].type !== PARENT_TYPES[type]) {
        throw new AppError(`${type} must be created under a ${PARENT_TYPES[type]}.`, 400);
    }
}

const list = asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} ORDER BY l.store_id, l.type, l.name`);
    res.json(rows.map(mapLocation));
});

const getOne = asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} WHERE l.id = $1`, [req.params.id]);
    if (!rows[0]) throw new AppError('Location not found.', 404);
    res.json(mapLocation(rows[0]));
});

const create = asyncHandler(async (req, res) => {
    const { storeId, store, parentId, type, code, name, active } = req.body;
    if ((!storeId && !store) || !type || !code || !name) {
        throw new AppError('store or storeId, type, code, and name are required.', 400);
    }
    const resolvedStoreId = storeId || await resolveStoreId(store);
    await validateLocationHierarchy({ storeId: resolvedStoreId, parentId, type });

    const { rows } = await query(
        `INSERT INTO locations (store_id, parent_id, type, code, name, active)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [resolvedStoreId, parentId || null, type, code, name, active !== undefined ? active : true]
    );

    await logAudit(query, {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Created location ${code}`,
        module: 'Locations',
        entityType: 'location',
        entityId: rows[0].id
    });

    const { rows: full } = await query(`${SELECT} WHERE l.id = $1`, [rows[0].id]);
    res.status(201).json(mapLocation(full[0]));
});

const update = asyncHandler(async (req, res) => {
    const { parentId, type, code, name, active } = req.body;
    const { rows: currentRows } = await query('SELECT store_id, parent_id, type FROM locations WHERE id = $1', [req.params.id]);
    if (!currentRows[0]) throw new AppError('Location not found.', 404);
    await validateLocationHierarchy({
        storeId: currentRows[0].store_id,
        parentId: parentId === undefined ? currentRows[0].parent_id : parentId,
        type: type || currentRows[0].type,
        locationId: req.params.id
    });
    const { rows } = await query(
        `UPDATE locations SET
       parent_id = COALESCE($1, parent_id), type = COALESCE($2, type),
       code = COALESCE($3, code), name = COALESCE($4, name),
       active = COALESCE($5, active), updated_at = NOW()
     WHERE id = $6 RETURNING id`,
        [parentId, type, code, name, active, req.params.id]
    );
    await logAudit(query, {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Updated location ${req.params.id}`,
        module: 'Locations',
        entityType: 'location',
        entityId: rows[0].id
    });

    const { rows: full } = await query(`${SELECT} WHERE l.id = $1`, [rows[0].id]);
    res.json(mapLocation(full[0]));
});

const remove = asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM locations WHERE id = $1 RETURNING code', [req.params.id]);
    if (!rows[0]) throw new AppError('Location not found.', 404);

    await logAudit(query, {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Deleted location ${rows[0].code}`,
        module: 'Locations',
        entityType: 'location',
        entityId: Number(req.params.id)
    });
    res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };