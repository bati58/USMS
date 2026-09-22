const asyncHandler = require('../utils/asyncHandler');
const passwordRecoveryService = require('../services/passwordRecovery.service');

function requestMetadata(req) {
    return {
        ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null
    };
}

const forgotPassword = asyncHandler(async (req, res) => {
    const result = await passwordRecoveryService.requestPasswordReset(req.body?.identifier, requestMetadata(req));
    res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
    const result = await passwordRecoveryService.resetPassword(
        req.body?.token,
        req.body?.newPassword,
        requestMetadata(req)
    );
    res.json(result);
});

module.exports = { forgotPassword, resetPassword };
