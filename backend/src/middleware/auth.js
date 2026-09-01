const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Verifies the Bearer token and attaches { id, role, name, username } to
// req.user. Every protected route in routes/index.js runs this first.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required.', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name, username }
    next();
  } catch (err) {
    next(new AppError('Invalid or expired session. Please log in again.', 401));
  }
}

module.exports = { requireAuth };
