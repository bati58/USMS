const AppError = require('../utils/AppError');
const { canRead, canWrite, canAct, canDelete } = require('../utils/permissions');

// requireRole('items') -> Express middleware that checks the current
// request's HTTP method against the Backend-SRS §4 permission matrix for
// the 'items' resource. Use this on every route in routes/index.js — this
// is the ONLY place authorization should be enforced; do not add role
// checks inside individual controllers.
function requireRole(resource, mode = 'resource') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isDelete = req.method === 'DELETE';
    const allowed = mode === 'action'
      ? canAct(resource, req.user.role)
      : isWrite
        ? isDelete
          ? canDelete(resource, req.user.role)
          : canWrite(resource, req.user.role)
        : canRead(resource, req.user.role);

    if (!allowed) {
      return next(
        new AppError(
          `Your role (${req.user.role}) does not have permission to ${mode === 'action' ? 'perform this action on' : isDelete ? 'delete' : isWrite ? 'modify' : 'view'} ${resource}.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = { requireRole };
