const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { emailConfigured, sendPasswordResetEmail } = require('./email.service');

const GENERIC_MESSAGE = 'If an account matches the information provided, password reset instructions have been sent.';
const PASSWORD_MIN_LENGTH = 8;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function tokenExpiry() {
    const minutes = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 15);
    return new Date(Date.now() + (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60 * 1000);
}

function resetUrl(token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    return `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

function developmentResetUrl(rawToken) {
    if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') return undefined;
    return resetUrl(rawToken);
}

function requestResponse(rawToken) {
    const response = { message: GENERIC_MESSAGE };
    const devResetUrl = developmentResetUrl(rawToken);
    if (devResetUrl) response.devResetUrl = devResetUrl;
    return response;
}

async function requestPasswordReset(identifier, metadata = {}) {
    const normalized = String(identifier || '').trim();
    if (!normalized) throw new AppError('Username or email is required.', 400);

    const { rows } = await query(
        `SELECT id, name, username, email
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(email, '')) = LOWER($1)
     LIMIT 1`,
        [normalized]
    );
    const user = rows[0];
    if (!user) {
        await logAudit(query, {
            action: 'PASSWORD_RESET_REQUESTED',
            module: 'Authentication',
            outcome: 'SUCCESS',
            metadata: { ...metadata, accountMatched: false }
        });
        return requestResponse();
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = tokenExpiry();
    const expiresMinutes = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 15);
    let resetId;

    await withTransaction(async (client) => {
        await client.query(
            'UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW()) WHERE user_id = $1 AND used_at IS NULL',
            [user.id]
        );
        const { rows: inserted } = await client.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id`,
            [user.id, tokenHash, expiresAt]
        );
        resetId = inserted[0]?.id;
        await logAudit(client, {
            userId: user.id,
            userName: user.name,
            action: 'PASSWORD_RESET_REQUESTED',
            module: 'Authentication',
            entityType: 'user',
            entityId: user.id,
            outcome: 'SUCCESS',
            metadata: { ...metadata, accountMatched: true }
        });
    });

    if (user.email && emailConfigured()) {
        try {
            await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetUrl: resetUrl(rawToken),
                expiresMinutes
            });
        } catch (error) {
            await query('UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW()) WHERE id = $1', [resetId]);
            await logAudit(query, {
                userId: user.id,
                userName: user.name,
                action: 'PASSWORD_RESET_FAILED',
                module: 'Authentication',
                entityType: 'user',
                entityId: user.id,
                outcome: 'FAILED',
                metadata: { ...metadata, reason: 'Email delivery failed', emailConfigured: true }
            });
        }
    } else if (process.env.NODE_ENV === 'production') {
        await query('UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW()) WHERE id = $1', [resetId]);
        await logAudit(query, {
            userId: user.id,
            userName: user.name,
            action: 'PASSWORD_RESET_FAILED',
            module: 'Authentication',
            entityType: 'user',
            entityId: user.id,
            outcome: 'FAILED',
            metadata: { ...metadata, reason: user.email ? 'Email delivery is not configured' : 'Account has no registered email', emailConfigured: false }
        });
    }

    return requestResponse(rawToken);
}

async function resetPassword(token, newPassword, metadata = {}) {
    if (!String(token || '').trim()) throw new AppError('Password reset token is required.', 400);
    if (!String(newPassword || '')) throw new AppError('New password is required.', 400);
    if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
        throw new AppError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 400);
    }

    const tokenHash = hashToken(token);
    let completed = false;
    let failureMessage = 'Your password reset link is invalid or has expired. Please request a new one.';

    await withTransaction(async (client) => {
        const { rows } = await client.query(
            `SELECT prt.id AS reset_id, prt.user_id, prt.used_at, prt.expires_at, u.name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
       FOR UPDATE OF prt, u`,
            [tokenHash]
        );
        const reset = rows[0];
        if (!reset || reset.used_at || new Date(reset.expires_at) <= new Date()) {
            await logAudit(client, {
                action: 'PASSWORD_RESET_FAILED',
                module: 'Authentication',
                outcome: 'FAILED',
                metadata: { ...metadata, reason: 'Invalid, expired, or used token' }
            });
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await client.query(
            `UPDATE users
       SET password_hash = $1, must_change_password = FALSE, auth_version = auth_version + 1, updated_at = NOW()
       WHERE id = $2`,
            [passwordHash, reset.user_id]
        );
        await client.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
            [reset.user_id]
        );
        await logAudit(client, {
            userId: reset.user_id,
            userName: reset.name,
            action: 'PASSWORD_RESET_COMPLETED',
            module: 'Authentication',
            entityType: 'user',
            entityId: reset.user_id,
            outcome: 'SUCCESS',
            metadata
        });
        completed = true;
    });

    if (!completed) throw new AppError(failureMessage, 400);
    return { message: 'Password reset successfully. You can now sign in.' };
}

async function adminResetPassword(userId, metadata = {}) {
    const temporaryPassword = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT id, name, username FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const user = rows[0];
        if (!user) throw new AppError('User not found.', 404);

        await client.query(
            `UPDATE users
       SET password_hash = $1, must_change_password = TRUE, auth_version = auth_version + 1, updated_at = NOW()
       WHERE id = $2`,
            [passwordHash, user.id]
        );
        await client.query(
            'UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW()) WHERE user_id = $1 AND used_at IS NULL',
            [user.id]
        );
        await logAudit(client, {
            userId: user.id,
            userName: user.name,
            action: 'ADMIN_PASSWORD_RESET',
            module: 'User Management',
            entityType: 'user',
            entityId: user.id,
            outcome: 'SUCCESS',
            metadata
        });
    });

    return { temporaryPassword };
}

module.exports = {
    GENERIC_MESSAGE,
    PASSWORD_MIN_LENGTH,
    requestPasswordReset,
    resetPassword,
    adminResetPassword
};
