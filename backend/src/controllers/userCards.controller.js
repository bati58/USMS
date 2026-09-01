const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { resolveItemId } = require('./_helpers');

const SELECT = `
  SELECT uc.*, i.name AS item_name
  FROM user_cards uc
  JOIN items i ON i.id = uc.item_id
`;

function map(row) {
    return {
        id: row.id,
        user: row.user_name,
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
    const itemId = await resolveItemId(item);
    const { rows } = await query(
        `INSERT INTO user_cards (user_name, department, item_id, issue_ref, issue_date, qty, status, returned_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [user, department || null, itemId, issueRef, issueDate, qty, status, returnedDate || null, notes || null]
    );
    const full = await query(`${SELECT} WHERE uc.id = $1`, [rows[0].id]);
    res.status(201).json(map(full.rows[0]));
});

const update = asyncHandler(async (req, res) => {
    const { user, department, item, issueRef, issueDate, qty, status, returnedDate, notes } = req.body;
    const itemId = item ? await resolveItemId(item) : null;
    const { rows } = await query(
        `UPDATE user_cards SET
      user_name = COALESCE($1, user_name), department = COALESCE($2, department), item_id = COALESCE($3, item_id),
      issue_ref = COALESCE($4, issue_ref), issue_date = COALESCE($5, issue_date), qty = COALESCE($6, qty),
      status = COALESCE($7, status), returned_date = COALESCE($8, returned_date), notes = COALESCE($9, notes), updated_at = NOW()
     WHERE id = $10 RETURNING id`,
        [user, department, itemId, issueRef, issueDate, qty, status, returnedDate, notes, req.params.id]
    );
    if (!rows[0]) throw new AppError('User card not found.', 404);
    const full = await query(`${SELECT} WHERE uc.id = $1`, [rows[0].id]);
    res.json(map(full.rows[0]));
});

const remove = asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM user_cards WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw new AppError('User card not found.', 404);
    res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
