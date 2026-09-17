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

async function assertLocationStoreAccess(user, storeId) {
    if (!['Store Head', 'Storekeeper'].includes(user?.role)) return;

    if (user?.id) {
        const { rows } = await query(
            `SELECT 1
             FROM store_user_assignments a
             JOIN stores s ON s.id = a.store_id
             WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE AND a.store_id = $3
             UNION
             SELECT 1
             FROM stores s
             WHERE s.active = TRUE AND s.id = $3 AND (
               ($2 = 'Store Head' AND s.head_of_store = $4) OR
               ($2 = 'Storekeeper' AND s.storekeeper = $4)
             )
             LIMIT 1`,
            [user.id, user.role, storeId, user.name]
        );
        if (rows[0]) return;
    }

    const assignmentColumn = user.role === 'Store Head' ? 'head_of_store' : 'storekeeper';
    const { rows } = await query(
        `SELECT 1 FROM stores WHERE id = $1 AND ${assignmentColumn} = $2 AND active = TRUE LIMIT 1`,
        [storeId, user.name]
    );
    if (!rows[0]) throw new AppError('You may access locations only within your assigned store.', 403);
}

async function getLocationStoreScope(user) {
    if (!['Store Head', 'Storekeeper'].includes(user?.role)) return null;

    if (user?.id) {
        const { rows } = await query(
            `SELECT DISTINCT s.id
             FROM store_user_assignments a
             JOIN stores s ON s.id = a.store_id
             WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE
             UNION
             SELECT s.id
             FROM stores s
             WHERE s.active = TRUE AND (
               ($2 = 'Store Head' AND s.head_of_store = $3) OR
               ($2 = 'Storekeeper' AND s.storekeeper = $3)
             )
             ORDER BY id`,
            [user.id, user.role, user.name]
        );
        if (rows.length) return rows.map((row) => Number(row.id));
    }

    const assignmentColumn = user.role === 'Store Head' ? 'head_of_store' : 'storekeeper';
    const { rows } = await query(
        `SELECT id FROM stores WHERE ${assignmentColumn} = $1 AND active = TRUE ORDER BY id`,
        [user.name]
    );
    return rows.map((row) => Number(row.id));
}

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
    const storeScope = await getLocationStoreScope(req.user);
    const params = storeScope === null ? [] : [storeScope];
    const scope = storeScope === null ? '' : ' WHERE l.store_id = ANY($1::int[])';
    const { rows } = await query(`${SELECT}${scope} ORDER BY l.store_id, l.type, l.name`, params);
    res.json(rows.map(mapLocation));
});

const getOne = asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT} WHERE l.id = $1`, [req.params.id]);
    if (!rows[0]) throw new AppError('Location not found.', 404);
    await assertLocationStoreAccess(req.user, rows[0].store_id);
    res.json(mapLocation(rows[0]));
});

const create = asyncHandler(async (req, res) => {
    const { storeId, store, parentId, type, code, name, active } = req.body;
    if ((!storeId && !String(store || '').trim()) || !String(type || '').trim() || !String(code || '').trim() || !String(name || '').trim()) {
        throw new AppError('store or storeId, type, code, and name are required.', 400);
    }
    const resolvedStoreId = storeId || await resolveStoreId(store);
    await assertLocationStoreAccess(req.user, resolvedStoreId);
    const { rows: storeRows } = await query('SELECT active FROM stores WHERE id = $1', [resolvedStoreId]);
    if (!storeRows[0]?.active) throw new AppError('Locations can only be created under an active store.', 400);
    await validateLocationHierarchy({ storeId: resolvedStoreId, parentId, type });

    const { rows } = await query(
        `INSERT INTO locations (store_id, parent_id, type, code, name, active)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [resolvedStoreId, parentId || null, type, String(code).trim(), String(name).trim(), active !== undefined ? Boolean(active) : true]
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
    if (code !== undefined && !String(code || '').trim()) throw new AppError('Location code cannot be empty.', 400);
    if (name !== undefined && !String(name || '').trim()) throw new AppError('Location name cannot be empty.', 400);
    const { rows: currentRows } = await query('SELECT store_id, parent_id, type FROM locations WHERE id = $1', [req.params.id]);
    if (!currentRows[0]) throw new AppError('Location not found.', 404);
    await assertLocationStoreAccess(req.user, currentRows[0].store_id);
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
        [parentId, type, code === undefined ? null : String(code).trim(), name === undefined ? null : String(name).trim(), active === undefined ? null : Boolean(active), req.params.id]
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
    const { rows: locationRows } = await query('SELECT id, store_id, code FROM locations WHERE id = $1', [req.params.id]);
    if (!locationRows[0]) throw new AppError('Location not found.', 404);
    await assertLocationStoreAccess(req.user, locationRows[0].store_id);
    const { rows: childRows } = await query('SELECT 1 FROM locations WHERE parent_id = $1 LIMIT 1', [req.params.id]);
    if (childRows[0]) throw new AppError('This location has child locations. Deactivate it instead of deleting it.', 409);
    const { rows: itemRows } = await query('SELECT 1 FROM items WHERE location_id = $1 LIMIT 1', [req.params.id]);
    if (itemRows[0]) throw new AppError('This location is assigned to stock items. Deactivate it instead of deleting it.', 409);
    const { rows } = await query('UPDATE locations SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING code', [req.params.id]);
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