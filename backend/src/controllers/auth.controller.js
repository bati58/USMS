const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

async function resolveAssignedStoreName(userName, role, db = query) {
  if (!userName || !['Store Head', 'Storekeeper'].includes(role)) return null;

  const client = typeof db === 'function' ? { query: db } : (db || { query });

  const { rows } = await client.query(
    `SELECT DISTINCT s.name
     FROM store_user_assignments a
     JOIN stores s ON s.id = a.store_id
     JOIN users u ON u.id = a.user_id
     WHERE a.active = TRUE
       AND s.active = TRUE
       AND u.name = $1
       AND u.role = $2
       AND a.assignment_role = $2
     UNION
     SELECT s.name
     FROM stores s
     WHERE s.active = TRUE AND (
       ($2 = 'Store Head' AND s.head_of_store = $1) OR
       ($2 = 'Storekeeper' AND s.storekeeper = $1)
     )
     ORDER BY name`,
    [userName, role]
  );

  if (rows.length > 1) return null;
  return rows[0]?.name || null;
}

async function resolveAssignedStoreNames(userName, role, db = query) {
  if (!userName || !['Store Head', 'Storekeeper'].includes(role)) return [];
  const client = typeof db === 'function' ? { query: db } : (db || { query });
  const { rows } = await client.query(
    `SELECT DISTINCT s.name
     FROM store_user_assignments a
     JOIN stores s ON s.id = a.store_id
     JOIN users u ON u.id = a.user_id
     WHERE a.active = TRUE
       AND s.active = TRUE
       AND u.name = $1
       AND u.role = $2
       AND a.assignment_role = $2
     UNION
     SELECT s.name
     FROM stores s
     WHERE s.active = TRUE AND (
       ($2 = 'Store Head' AND s.head_of_store = $1) OR
       ($2 = 'Storekeeper' AND s.storekeeper = $1)
     )
     ORDER BY name`,
    [userName, role]
  );
  return rows.map((row) => row.name).filter(Boolean);
}

async function resolveAssignedStoreNamesById(userId, role, db = query) {
  if (!userId || !['Store Head', 'Storekeeper'].includes(role)) return [];
  const client = typeof db === 'function' ? { query: db } : (db || { query });
  const { rows } = await client.query(
    `SELECT DISTINCT s.name
     FROM store_user_assignments a
     JOIN stores s ON s.id = a.store_id
     WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE
     UNION
     SELECT s.name
     FROM stores s
     JOIN users u ON u.name = s.head_of_store OR u.name = s.storekeeper
     WHERE u.id = $1 AND u.role = $2 AND s.active = TRUE AND (
       ($2 = 'Store Head' AND s.head_of_store = u.name) OR
       ($2 = 'Storekeeper' AND s.storekeeper = u.name)
     )
     ORDER BY name`,
    [userId, role]
  );
  return rows.map((row) => row.name).filter(Boolean);
}

async function resolveAssignedDepartments(userId, db = query) {
  if (!userId) return [];
  const client = typeof db === 'function' ? { query: db } : (db || { query });
  const { rows } = await client.query(
    `SELECT d.name
     FROM departments d
     WHERE d.head_user_id = $1 AND d.active = TRUE
     ORDER BY d.name`,
    [userId]
  );
  return rows.map((row) => row.name).filter(Boolean);
}

// POST /api/auth/login — Backend-SRS §3.2
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new AppError('Username and password are required.', 400);
  }

  const { rows } = await query(
    `SELECT u.*, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.head_user_id = u.id AND d.active = TRUE
     WHERE u.username = $1`,
    [username.trim()]
  );
  const user = rows[0];

  if (!user) {
    throw new AppError('Invalid username or password.', 401);
  }
  if (!user.active) {
    throw new AppError('This account has been deactivated.', 403);
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 403);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  if (!passwordOk) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil = null;
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // lock for 15 minutes
    }
    await query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockedUntil, user.id]);

    await logAudit(query, {
      userId: user.id, userName: user.name, userRole: user.role,
      action: 'Login Failed', module: 'Authentication', outcome: 'FAILED',
      metadata: { ip, userAgent, reason: 'Invalid password' }
    });

    throw new AppError('Invalid username or password.', 401);
  }

  await query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
  await logAudit(query, {
    userId: user.id, userName: user.name, userRole: user.role,
    action: 'Login Successful', module: 'Authentication', outcome: 'SUCCESS',
    metadata: { ip, userAgent }
  });

  const resolvedDepartment = user.department || user.department_name || null;
  const resolvedDepartments = await resolveAssignedDepartments(user.id, query);
  const assignedStores = await resolveAssignedStoreNamesById(user.id, user.role, query);
  const resolvedStore = assignedStores.length === 1 ? assignedStores[0] : null;

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      department: resolvedDepartment,
      departments: resolvedDepartments.length ? resolvedDepartments : (resolvedDepartment ? [resolvedDepartment] : []),
      assignedStores,
      store: resolvedStore
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      email: user.email,
      department: resolvedDepartment,
      departments: resolvedDepartments.length ? resolvedDepartments : (resolvedDepartment ? [resolvedDepartment] : []),
      assignedStores,
      store: resolvedStore,
      active: user.active
    }
  });
});

// GET /api/auth/me — convenience endpoint so the frontend can re-hydrate
// the session on page load using only the stored token.
const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.username, u.role, u.email, COALESCE(u.department, d.name) AS department, u.active
     FROM users u
     LEFT JOIN departments d ON d.head_user_id = u.id AND d.active = TRUE
     WHERE u.id = $1`,
    [req.user.id]
  );

  if (!rows[0]) throw new AppError('User not found.', 404);

  const resolvedDepartment = rows[0].department || rows[0].department_name || null;
  const resolvedDepartments = await resolveAssignedDepartments(rows[0].id, query);
  const assignedStores = await resolveAssignedStoreNamesById(rows[0].id, rows[0].role, query);
  const resolvedStore = assignedStores.length === 1 ? assignedStores[0] : null;

  res.json({
    ...rows[0],
    department: resolvedDepartment,
    departments: resolvedDepartments.length ? resolvedDepartments : (resolvedDepartment ? [resolvedDepartment] : []),
    assignedStores,
    store: resolvedStore
  });
});

const logout = asyncHandler(async (req, res) => {
  await logAudit(query, {
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'Logged out',
    module: 'Authentication',
    entityType: 'session',
    metadata: {
      ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || null,
      userAgent: req.get('user-agent') || null
    }
  });
  res.status(204).send();
});

// PUT /api/auth/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required.', 400);
  }
  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters.', 400);
  }

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordOk) {
    throw new AppError('Invalid current password.', 401);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.status(204).send();
});

const refreshToken = asyncHandler(async (req, res) => {
  const oldToken = req.headers.authorization?.split(' ')[1];
  if (!oldToken) throw new AppError('No token provided', 401);

  let decoded;
  try {
    // allow refreshing even if expired to some degree, but for simplicity we just verify it and if it's expired we check if it was recently expired.
    // A better approach for simple JWT is to just sign a new one if they are authenticated.
    // Actually, since this route will be protected by `requireAuth` or we can just read the header manually.
    decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
  } catch (err) {
    throw new AppError('Invalid token', 401);
  }

  const { rows } = await query(`
    SELECT u.*, d.name AS department_name
    FROM users u
    LEFT JOIN departments d ON d.head_user_id = u.id AND d.active = TRUE
    WHERE u.id = $1 AND u.active = TRUE
  `, [decoded.id]);
  const user = rows[0];
  if (!user) throw new AppError('User not found or deactivated', 401);

  const resolvedDepartment = user.department || user.department_name || null;
  const resolvedDepartments = await resolveAssignedDepartments(user.id, query);
  const assignedStores = await resolveAssignedStoreNamesById(user.id, user.role, query);
  const resolvedStore = assignedStores.length === 1 ? assignedStores[0] : null;

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      department: resolvedDepartment,
      departments: resolvedDepartments.length ? resolvedDepartments : (resolvedDepartment ? [resolvedDepartment] : []),
      assignedStores,
      store: resolvedStore
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token });
});

module.exports = { login, me, logout, changePassword, refreshToken, resolveAssignedStoreName, resolveAssignedStoreNames, resolveAssignedDepartments };
