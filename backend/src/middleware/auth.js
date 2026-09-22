const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { query } = require('../config/db');

// Verifies the Bearer token and attaches { id, role, name, username } to
// req.user. Every protected route in routes/index.js runs this first.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required.', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, active, auth_version, must_change_password FROM users WHERE id = $1',
      [payload.id]
    );
    const user = rows[0];
    if (!user || !user.active || Number(payload.authVersion || 0) !== Number(user.auth_version || 0)) {
      throw new AppError('Invalid or expired session. Please log in again.', 401);
    }
    if (user.must_change_password && !['/auth/me', '/auth/force-password', '/auth/logout'].includes(req.path)) {
      throw new AppError('You must change your password before continuing.', 403);
    }
    req.user = { ...payload, mustChangePassword: Boolean(user.must_change_password) };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Invalid or expired session. Please log in again.', 401));
  }
}

module.exports = { requireAuth };
