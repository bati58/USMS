// Standard application error. Every route error should throw this (or let
// asyncHandler catch a thrown Error and treat it as a 500) so the error
// handler middleware can respond consistently with { message } as the
// frontend's apiClient.js already expects.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = AppError;
