const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const list = asyncHandler(async (req, res) => {
    const { rows } = await query(
        `SELECT id, title, message, type, route, entity_type, entity_id, read_at, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.user.id]
    );
    res.json(rows.map((row) => ({ ...row, read: Boolean(row.read_at), timestamp: row.created_at })));
});

const markRead = asyncHandler(async (req, res) => {
    const { rows } = await query(
        'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id, read_at',
        [req.params.id, req.user.id]
    );
    if (!rows[0]) throw new AppError('Notification not found.', 404);
    res.json({ id: rows[0].id, read: true, readAt: rows[0].read_at });
});

module.exports = { list, markRead };