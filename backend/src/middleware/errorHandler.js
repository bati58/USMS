// Centralized error formatter. Every route either throws/passes an
// AppError (expected, user-facing) or lets an unexpected error bubble up
// (logged, returned as a generic 500) — the frontend's apiClient.js reads
// `message` off every non-2xx response body, so always include one.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  let message = typeof err?.message === 'string' && err.message.trim()
    ? err.message
    : 'Something went wrong on the server.';

  // Handle specific PostgreSQL error codes globally
  if (err?.code === '23505') {
    statusCode = 409;
    const constraint = err.constraint || '';
    if (constraint.includes('code')) message = 'A record with this code already exists. Codes must be unique.';
    else if (constraint.includes('name')) message = 'A record with this name already exists. Names must be unique.';
    else if (constraint.includes('username')) message = 'A user with this username already exists.';
    else if (constraint.includes('email')) message = 'A user with this email already exists.';
    else message = 'A record with this information already exists (duplicate entry).';
  } else if (err?.code === '23503') {
    statusCode = 409;
    message = 'Cannot perform this action because this record is referenced by other data in the system.';
  } else if (err?.code === '23514') {
    statusCode = 400;
    message = 'The provided data violates a system validation rule.';
  } else if (err?.code === '22001') {
    statusCode = 400;
    message = 'One of the provided fields contains text that is too long.';
  }

  if (!err || (!err.isAppError && !err.code)) {
    console.error(err);
  }

  res.status(statusCode).json({ message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route matches ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
