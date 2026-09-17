const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { mapStore } = require('./_helpers');

function normalizeStoreType(value) {
  if (!value) return value;

  const normalized = String(value).trim();
  const aliases = {
    main: 'Main Store',
    'main store': 'Main Store',
    'main-store': 'Main Store',
    'department': 'Department Store',
    'department store': 'Department Store',
    'dept store': 'Department Store',
    'dept': 'Department Store',
    cafe: 'Cafe Store',
    'cafe store': 'Cafe Store',
    cafeteria: 'Cafe Store',
    'cafeteria store': 'Cafe Store',
    laboratory: 'Specialized/Laboratory',
    'specialized/laboratory': 'Specialized/Laboratory',
    'specialized laboratory': 'Specialized/Laboratory',
    'specialized / laboratory': 'Specialized/Laboratory',
    'lab store': 'Specialized/Laboratory',
    'specialized store': 'Specialized/Laboratory'
  };

  const direct = aliases[normalized.toLowerCase()];
  if (direct) return direct;

  const compact = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (compact.toLowerCase() === 'main store') return 'Main Store';
  if (compact.toLowerCase() === 'department store' || compact.toLowerCase() === 'dept store') return 'Department Store';
  if (compact.toLowerCase() === 'cafe store' || compact.toLowerCase() === 'cafeteria store') return 'Cafe Store';
  if (compact.toLowerCase() === 'specialized / laboratory' || compact.toLowerCase() === 'specialized laboratory' || compact.toLowerCase() === 'lab store') return 'Specialized/Laboratory';

  return normalized;
}

const STORE_TYPES = ['Main Store', 'Department Store', 'Cafe Store', 'Specialized/Laboratory'];

async function resolveEligibleAssignment(value, role) {
  if (value === null || value === undefined || value === '') return null;

  const isNumericId = String(value).trim() !== '' && /^\d+$/.test(String(value).trim());
  const { rows } = await query(
    isNumericId
      ? 'SELECT id, name FROM users WHERE id = $1 AND role = $2 AND active = TRUE LIMIT 1'
      : 'SELECT id, name FROM users WHERE name = $1 AND role = $2 AND active = TRUE LIMIT 1',
    isNumericId ? [Number(value), role] : [value, role]
  );

  if (!rows[0]) {
    throw new AppError(`${role} must be an active eligible user.`, 400);
  }

  return rows[0].id;
}

async function resolveEligibleAssignmentName(value, role) {
  if (value === null || value === undefined || value === '') return null;

  const isNumericId = String(value).trim() !== '' && /^\d+$/.test(String(value).trim());
  const { rows } = await query(
    isNumericId
      ? 'SELECT name FROM users WHERE id = $1 AND role = $2 AND active = TRUE LIMIT 1'
      : 'SELECT name FROM users WHERE name = $1 AND role = $2 AND active = TRUE LIMIT 1',
    isNumericId ? [Number(value), role] : [value, role]
  );

  if (!rows[0]) {
    throw new AppError(`${role} must be an active eligible user.`, 400);
  }

  return rows[0].name;
}

async function syncStoreAssignments(storeId, headOfStore, storekeeper) {
  const assignments = [
    { name: headOfStore, role: 'Store Head' },
    { name: storekeeper, role: 'Storekeeper' }
  ];
  for (const assignment of assignments) {
    const userId = await resolveEligibleAssignment(assignment.name, assignment.role);
    await query(
      `UPDATE store_user_assignments SET active = FALSE, effective_to = CURRENT_DATE, updated_at = NOW()
       WHERE store_id = $1 AND assignment_role = $2 AND active = TRUE`,
      [storeId, assignment.role]
    );
    if (userId) {
      await query(
        `INSERT INTO store_user_assignments (store_id, user_id, assignment_role)
         VALUES ($1, $2, $3)
         ON CONFLICT (store_id, user_id, assignment_role)
         DO UPDATE SET active = TRUE, effective_to = NULL, updated_at = NOW()`,
        [storeId, userId, assignment.role]
      );
    }
  }
}

const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT s.*,
      COALESCE(head_assignment.user_name, s.head_of_store) AS head_of_store,
      COALESCE(keeper_assignment.user_name, s.storekeeper) AS storekeeper
    FROM stores s
    LEFT JOIN LATERAL (
      SELECT u.name AS user_name
      FROM store_user_assignments a
      JOIN users u ON u.id = a.user_id AND u.active = TRUE
      WHERE a.store_id = s.id AND a.assignment_role = 'Store Head' AND a.active = TRUE
      ORDER BY a.id DESC
      LIMIT 1
    ) head_assignment ON TRUE
    LEFT JOIN LATERAL (
      SELECT u.name AS user_name
      FROM store_user_assignments a
      JOIN users u ON u.id = a.user_id AND u.active = TRUE
      WHERE a.store_id = s.id AND a.assignment_role = 'Storekeeper' AND a.active = TRUE
      ORDER BY a.id DESC
      LIMIT 1
    ) keeper_assignment ON TRUE
    ORDER BY s.id
  `);
  res.json(rows.map(mapStore));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT s.*,
      COALESCE(head_assignment.user_name, s.head_of_store) AS head_of_store,
      COALESCE(keeper_assignment.user_name, s.storekeeper) AS storekeeper
    FROM stores s
    LEFT JOIN LATERAL (
      SELECT u.name AS user_name
      FROM store_user_assignments a
      JOIN users u ON u.id = a.user_id AND u.active = TRUE
      WHERE a.store_id = s.id AND a.assignment_role = 'Store Head' AND a.active = TRUE
      ORDER BY a.id DESC
      LIMIT 1
    ) head_assignment ON TRUE
    LEFT JOIN LATERAL (
      SELECT u.name AS user_name
      FROM store_user_assignments a
      JOIN users u ON u.id = a.user_id AND u.active = TRUE
      WHERE a.store_id = s.id AND a.assignment_role = 'Storekeeper' AND a.active = TRUE
      ORDER BY a.id DESC
      LIMIT 1
    ) keeper_assignment ON TRUE
    WHERE s.id = $1
  `, [req.params.id]);
  if (!rows[0]) throw new AppError('Store not found.', 404);
  res.json(mapStore(rows[0]));
});

const hasStorekeeperColumn = async () => {
  const { rows } = await query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'stores'
      AND column_name = 'storekeeper'
    LIMIT 1
  `);
  return rows.length > 0;
};

const create = asyncHandler(async (req, res) => {
  const { name, code, type, department, location, headOfStore, storekeeper, description, contactInfo, active } = req.body;
  if (!String(name || '').trim() || !String(code || '').trim() || !type || !String(headOfStore || '').trim()) {
    throw new AppError('name, code, type, and an active Store Head are required.', 400);
  }
  const normalizedType = normalizeStoreType(type);
  if (!STORE_TYPES.includes(normalizedType)) throw new AppError(`Invalid store type: ${type}.`, 400);
  await resolveEligibleAssignment(headOfStore, 'Store Head');
  await resolveEligibleAssignment(storekeeper, 'Storekeeper');
  const headName = await resolveEligibleAssignmentName(headOfStore, 'Store Head');
  const storekeeperName = await resolveEligibleAssignmentName(storekeeper, 'Storekeeper');

  const hasColumn = await hasStorekeeperColumn();

  if (hasColumn) {
    const { rows } = await query(
      `INSERT INTO stores (name, code, type, department, location, head_of_store, storekeeper, description, contact_info, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [String(name).trim(), String(code).trim(), normalizedType, department?.trim() || null, location?.trim() || null, headName, storekeeperName, description?.trim() || null, contactInfo?.trim() || null, active !== undefined ? Boolean(active) : true]
    );

    await logAudit(query, { userName: req.user.name, action: `Created store ${name}`, module: 'Store Management' });
    await syncStoreAssignments(rows[0].id, headOfStore, storekeeper);
    return res.status(201).json(mapStore(rows[0]));
  }

  const { rows } = await query(
    `INSERT INTO stores (name, code, type, department, location, head_of_store, description, contact_info, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [String(name).trim(), String(code).trim(), normalizedType, department?.trim() || null, location?.trim() || null, headName, description?.trim() || null, contactInfo?.trim() || null, active !== undefined ? Boolean(active) : true]
  );

  await logAudit(query, { userName: req.user.name, action: `Created store ${name}`, module: 'Store Management' });
  await syncStoreAssignments(rows[0].id, headOfStore, null);
  res.status(201).json(mapStore(rows[0]));
});

const update = asyncHandler(async (req, res) => {
  const { name, code, type, department, location, headOfStore, storekeeper, description, contactInfo, active } = req.body;
  const normalizedType = normalizeStoreType(type);
  if (type !== undefined && !STORE_TYPES.includes(normalizedType)) throw new AppError(`Invalid store type: ${type}.`, 400);
  const hasColumn = await hasStorekeeperColumn();
  await resolveEligibleAssignment(headOfStore, 'Store Head');
  await resolveEligibleAssignment(storekeeper, 'Storekeeper');
  const headName = headOfStore === undefined ? undefined : await resolveEligibleAssignmentName(headOfStore, 'Store Head');
  const storekeeperName = storekeeper === undefined ? undefined : await resolveEligibleAssignmentName(storekeeper, 'Storekeeper');

  if (hasColumn) {
    const { rows } = await query(
      `UPDATE stores SET
         name = COALESCE($1, name), code = COALESCE($2, code), type = COALESCE($3, type),
         department = COALESCE($4, department), location = COALESCE($5, location),
         head_of_store = COALESCE($6, head_of_store), storekeeper = COALESCE($7, storekeeper),
         description = COALESCE($8, description), contact_info = COALESCE($9, contact_info),
         active = COALESCE($10, active), updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [name, code, normalizedType, department, location, headName, storekeeperName, description, contactInfo, active, req.params.id]
    );
    if (!rows[0]) throw new AppError('Store not found.', 404);

    await logAudit(query, { userName: req.user.name, action: `Updated store ${rows[0].name}`, module: 'Store Management' });
    await syncStoreAssignments(rows[0].id, headOfStore ?? rows[0].head_of_store, storekeeper ?? rows[0].storekeeper);
    return res.json(mapStore(rows[0]));
  }

  const { rows } = await query(
    `UPDATE stores SET
       name = COALESCE($1, name), code = COALESCE($2, code), type = COALESCE($3, type),
       department = COALESCE($4, department), location = COALESCE($5, location),
       head_of_store = COALESCE($6, head_of_store),
       description = COALESCE($7, description), contact_info = COALESCE($8, contact_info),
       active = COALESCE($9, active), updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [name, code, normalizedType, department, location, headName, description, contactInfo, active, req.params.id]
  );
  if (!rows[0]) throw new AppError('Store not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Updated store ${rows[0].name}`, module: 'Store Management' });
  await syncStoreAssignments(rows[0].id, headOfStore ?? rows[0].head_of_store, null);
  res.json(mapStore(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows } = await query('DELETE FROM stores WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows[0]) throw new AppError('Store not found.', 404);

  await logAudit(query, { userName: req.user.name, action: `Deleted store ${rows[0].name}`, module: 'Store Management' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove, resolveEligibleAssignment, normalizeStoreType };
