const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

const SELECT = `
    SELECT uc.*, i.name AS item_name, u.name AS current_user_name
  FROM user_cards uc
  JOIN items i ON i.id = uc.item_id
    LEFT JOIN users u ON u.id = uc.user_id
`;

function map(row) {
    return {
        id: row.id,
        user: row.current_user_name || row.user_name,
        userId: row.user_id,
        department: row.department,
        item: row.item_name,
        issueRef: row.issue_ref,
        issueDate: row.issue_date,
        qty: Number(row.qty),
        status: row.status,
        returnedDate: row.returned_date,
        notes: row.notes
    };
}

const list = asyncHandler(async (req, res) => {
    if (req.user.role === 'Department Head' && !req.user.department) {
        return res.json([]);
    }
    const params = req.user.role === 'Department Head' ? [req.user.department] : [];
    const scope = req.user.role === 'Department Head' ? ' WHERE uc.department = $1' : '';
    const { rows } = await query(`${SELECT}${scope} ORDER BY uc.id DESC`, params);
    res.json(rows.map(map));
});

const getOne = asyncHandler(async (req, res) => {
    if (req.user.role === 'Department Head' && !req.user.department) {
        throw new AppError('Your account is not assigned to a department.', 403);
    }
    const params = req.user.role === 'Department Head' ? [req.params.id, req.user.department] : [req.params.id];
    const scope = req.user.role === 'Department Head' ? ' AND uc.department = $2' : '';
    const { rows } = await query(`${SELECT} WHERE uc.id = $1${scope}`, params);
    if (!rows[0]) throw new AppError('User card not found.', 404);
    res.json(map(rows[0]));
});

const create = asyncHandler(async (req, res) => {
    const { user, department, item, issueRef, issueDate, qty, status = 'In Use', returnedDate, notes } = req.body;
    if (!user || !item || !issueRef || !issueDate || !qty) {
        throw new AppError('user, item, issueRef, issueDate, and qty are required.', 400);
    }
    const { rows: userRows } = await query(
        `SELECT id, name, department FROM users WHERE name = $1 AND active = TRUE LIMIT 1`,
        [user]
    );
    if (!userRows[0]) throw new AppError('The custody recipient must be an active system user.', 400);
    const { rows: voucherRows } = await query(
        `SELECT iv.id, i.id AS item_id
         FROM issue_vouchers iv
         JOIN issue_voucher_items ivi ON ivi.issue_voucher_id = iv.id
         JOIN items i ON i.id = ivi.item_id
         WHERE iv.siv_ref = $1 AND iv.status = 'Posted' AND i.name = $2 AND ivi.qty >= $3
         LIMIT 1`,
        [issueRef, item, qty]
    );
    if (!voucherRows[0]) {
        throw new AppError('User material cards must be created from a posted issue voucher with sufficient issued quantity.', 400);
    }
    const itemId = voucherRows[0].item_id;
    const departmentName = department || userRows[0].department || null;
    const { rows } = await query(
        `INSERT INTO user_cards (user_name, user_id, department, item_id, issue_ref, issue_date, qty, status, returned_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [userRows[0].name, userRows[0].id, departmentName, itemId, issueRef, issueDate, qty, status, returnedDate || null, notes || null]
    );
    await logAudit(query, { userName: req.user.name, action: `Created custody card for ${user}`, module: 'User Material Cards', entityType: 'user_card', entityId: rows[0].id, entityReference: issueRef });
    const full = await query(`${SELECT} WHERE uc.id = $1`, [rows[0].id]);
    res.status(201).json(map(full.rows[0]));
});

const update = asyncHandler(async (req, res) => {
    const { status, returnedDate, notes } = req.body;
    if (status === 'Returned' && !returnedDate) throw new AppError('A returned date is required when closing a custody card.', 400);
    const { rows } = await query(
        `UPDATE user_cards SET
      status = COALESCE($1, status), returned_date = COALESCE($2, returned_date), notes = COALESCE($3, notes), updated_at = NOW()
     WHERE id = $4 RETURNING id, user_name, issue_ref`,
        [status, returnedDate, notes, req.params.id]
    );
    if (!rows[0]) throw new AppError('User card not found.', 404);
    await logAudit(query, { userName: req.user.name, action: `Updated custody status for ${rows[0].user_name}`, module: 'User Material Cards', entityType: 'user_card', entityId: rows[0].id, entityReference: rows[0].issue_ref });
    const full = await query(`${SELECT} WHERE uc.id = $1`, [rows[0].id]);
    res.json(map(full.rows[0]));
});

const remove = asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM user_cards WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw new AppError('User card not found.', 404);
    res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
