const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { mapMaterialReturn, resolveStoreId, resolveItemId } = require('./_helpers');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT mr.*, i.name AS item_name, COALESCE(rs.name, s.name) AS store_name
  FROM material_returns mr
  LEFT JOIN items i ON i.id = mr.item_id
  LEFT JOIN stores s ON s.id = i.store_id
  LEFT JOIN stores rs ON rs.id = mr.store_id
`;

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Department Head') {
    scope = 'WHERE mr.department = $1 OR mr.created_by = $2';
    params = [req.user.department || '', req.user.name];
  } else if (req.user.role === 'Store Head' && req.user.store) {
    scope = 'WHERE COALESCE(rs.name, s.name) = $1';
    params = [req.user.store];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY mr.id DESC`, params);
  res.json(rows.map(mapMaterialReturn));
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Department Head') {
    scope = ' AND (mr.department = $2 OR mr.created_by = $3)';
    params.push(req.user.department || '', req.user.name);
  } else if (req.user.role === 'Store Head' && req.user.store) {
    scope = ' AND COALESCE(rs.name, s.name) = $2';
    params.push(req.user.store);
  }

  const { rows } = await query(`${SELECT} WHERE mr.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Material return not found.', 404);
  res.json(mapMaterialReturn(rows[0]));
});

// POST /api/material-returns — Backend-SRS §6.3 step 1 (Draft, no stock change)
const create = asyncHandler(async (req, res) => {
  const { department, store, item, qty, reason, date, condition, originalIssueRef } = req.body;
  const effectiveDepartment = req.user.role === 'Department Head' ? req.user.department : department;
  if (!effectiveDepartment || !store || !item || !qty) throw new AppError('department, store, item, and qty are required.', 400);

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    const itemId = await resolveItemId(item, client, storeId);
    if (!itemId) throw new AppError(`Unknown item: "${item}".`, 400);
    const srnRef = await nextRef(client, 'SRN');

    const { rows } = await client.query(
      `INSERT INTO material_returns (srn_ref, department, created_by, store_id, item_id, qty, reason, date, status, condition, original_issue_ref)
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_DATE),'Draft',$9,$10) RETURNING id`,
      [srnRef, effectiveDepartment, req.user.name, storeId, itemId, qty, reason || null, date || null, condition || null, originalIssueRef || null]
    );

    await logAudit(client, { userName: req.user.name, action: `Created return ${srnRef}`, module: 'Material Return' });

    const { rows: full } = await client.query(`${SELECT} WHERE mr.id = $1`, [rows[0].id]);
    return mapMaterialReturn(full[0]);
  });

  res.status(201).json(result);
});

// POST /api/material-returns/:id/submit
const submit = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT mr.status, mr.srn_ref, mr.department, mr.created_by,
              COALESCE(rs.name, source_store.name) AS store_name,
              sh.id AS store_head_id
       FROM material_returns mr
       LEFT JOIN items i ON i.id = mr.item_id
       LEFT JOIN stores source_store ON source_store.id = i.store_id
       LEFT JOIN stores rs ON rs.id = mr.store_id
       LEFT JOIN users sh ON sh.name = COALESCE(rs.head_of_store, source_store.head_of_store)
         AND sh.role = 'Store Head' AND sh.active = TRUE
       WHERE mr.id = $1 FOR UPDATE OF mr`,
      [req.params.id]
    );
    const ret = rows[0];
    if (!ret) throw new AppError('Material return not found.', 404);
    if (req.user.role === 'Department Head' && ret.department !== req.user.department && ret.created_by !== req.user.name) {
      throw new AppError('You can only submit returns from your department.', 403);
    }
    if (ret.status !== 'Draft' && ret.status !== 'Pending') {
      throw new AppError(`Cannot submit return in status: ${ret.status}`, 400);
    }
    await client.query('UPDATE material_returns SET status = $1, updated_at = NOW() WHERE id = $2', ['Submitted', req.params.id]);
    await logAudit(client, { userName: req.user.name, action: `Submitted return ${ret.srn_ref}`, module: 'Material Return' });
    await notify(client, {
      userId: ret.store_head_id || undefined,
      role: ret.store_head_id ? undefined : 'Store Head',
      title: 'Material return awaiting inspection',
      message: `${ret.srn_ref} for ${ret.store_name || 'the store'} is ready for Store Head review.`,
      type: 'warning',
      route: '/material-return',
      entityType: 'material_return',
      entityId: req.params.id
    });
    const { rows: full } = await client.query(`${SELECT} WHERE mr.id = $1`, [req.params.id]);
    return mapMaterialReturn(full[0]);
  });
  res.json(result);
});

// POST /api/material-returns/:id/approve — Backend-SRS §6.3 steps 2-3
const decide = asyncHandler(async (req, res) => {
  const { decision, qtyApproved, findings, recommendation } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) throw new AppError('decision must be "Approved" or "Rejected".', 400);

  await withTransaction(async (client) => {
    await stockService.decideMaterialReturn(client, { returnId: req.params.id, decision, qtyApproved, findings, recommendation, actorName: req.user.name });
    if (decision === 'Approved') {
      const { rows } = await client.query(
        `SELECT mr.srn_ref, COALESCE(rs.head_of_store, source_store.head_of_store) AS receiving_operator
         FROM material_returns mr
         LEFT JOIN items i ON i.id = mr.item_id
         LEFT JOIN stores source_store ON source_store.id = i.store_id
         LEFT JOIN stores rs ON rs.id = mr.store_id
         WHERE mr.id = $1`,
        [req.params.id]
      );
      const { rows: operatorRows } = await client.query(
        `SELECT id FROM users
         WHERE name = $1 AND role = 'Storekeeper' AND active = TRUE
         LIMIT 1`,
        [rows[0]?.receiving_operator]
      );
      await notify(client, {
        userId: operatorRows[0]?.id,
        role: operatorRows[0]?.id ? undefined : 'Storekeeper',
        title: 'Material return approved for receipt',
        message: `${rows[0]?.srn_ref} was approved by the Store Head. Receive the material and post it back to stock.`,
        type: 'success',
        route: '/material-return',
        entityType: 'material_return',
        entityId: req.params.id
      });
    }
  });

  const { rows } = await query(`${SELECT} WHERE mr.id = $1`, [req.params.id]);
  res.json(mapMaterialReturn(rows[0]));
});

const receive = asyncHandler(async (req, res) => {
  await withTransaction((client) =>
    stockService.receiveMaterialReturn(client, { returnId: req.params.id, actorName: req.user.name })
  );
  const { rows } = await query(`${SELECT} WHERE mr.id = $1`, [req.params.id]);
  res.json(mapMaterialReturn(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const scope = req.user.role === 'Department Head' ? ' AND (department = $2 OR created_by = $3)' : '';
  const params = req.user.role === 'Department Head'
    ? [req.params.id, req.user.department, req.user.name]
    : [req.params.id];
  const { rows: check } = await query(`SELECT status FROM material_returns WHERE id = $1${scope}`, params);
  if (!check[0]) throw new AppError('Material return not found.', 404);
  if (!['Draft', 'Submitted', 'Pending Review', 'Pending'].includes(check[0].status)) throw new AppError('Cannot delete a material return that has already been processed.', 400);

  const { rows } = await query('DELETE FROM material_returns WHERE id = $1 RETURNING srn_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted return ${rows[0].srn_ref}`, module: 'Material Return' });
  res.status(204).send();
});

module.exports = { list, getOne, create, submit, decide, receive, remove };
