const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { mapMaterialReturn, resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord, assertUserCanAccessDepartmentRecord } = require('./_helpers');
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
    scope = 'WHERE mr.created_by = $1';
    params = [req.user.name];
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE mr.store_id = $1 OR i.store_id = $1';
      params = [visibility.assignedStoreId];
    }
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY mr.id DESC`, params);
  res.json(rows.map(mapMaterialReturn));
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Department Head') {
    scope = ' AND mr.created_by = $2';
    params.push(req.user.name);
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND (mr.store_id = $2 OR i.store_id = $2)';
      params.push(visibility.assignedStoreId);
    } else {
      throw new AppError('You are not assigned to any store scope.', 403);
    }
  }

  const { rows } = await query(`${SELECT} WHERE mr.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Material return not found.', 404);

  if (req.user.role === 'Department Head') {
    await assertUserCanAccessDepartmentRecord(req.user, rows[0].department, { query });
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
  }

  res.json(mapMaterialReturn(rows[0]));
});

// POST /api/material-returns — Backend-SRS §6.3 step 1 (Draft, no stock change)
const create = asyncHandler(async (req, res) => {
  const { department, store, item, qty, reason, date, condition, originalIssueRef, status } = req.body;
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [{ item, qty, reason, condition }];
  const effectiveDepartment = req.user.role === 'Department Head' ? req.user.department : department;
  if (!effectiveDepartment || !store || !lines.length || lines.some((line) => !line.item || !line.qty || Number(line.qty) <= 0)) {
    throw new AppError('department, store, and valid item and quantity details are required for every return line.', 400);
  }
  if (new Set(lines.map((line) => line.item)).size !== lines.length) {
    throw new AppError('Each returned item can only appear once in an SRN batch.', 400);
  }

  const requestedStatus = status === 'Submitted' ? 'Submitted' : 'Draft';

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    await assertUserCanAccessStoreRecord(req.user, storeId, client);
    const created = [];
    for (const line of lines) {
      const itemId = await resolveItemId(line.item, client, storeId);
      if (!itemId) throw new AppError(`Unknown item: "${line.item}".`, 400);
      const srnRef = await nextRef(client, 'SRN');
      const { rows } = await client.query(
        `INSERT INTO material_returns (srn_ref, department, created_by, store_id, item_id, qty, reason, date, status, condition, original_issue_ref)
        VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_DATE),$9,$10,$11) RETURNING id`,
        [srnRef, effectiveDepartment, req.user.name, storeId, itemId, line.qty, line.reason || null, date || null, requestedStatus, line.condition || null, originalIssueRef || null]
      );

      await logAudit(client, { userName: req.user.name, action: `Created return ${srnRef} (${requestedStatus})`, module: 'Material Return' });

      if (requestedStatus === 'Submitted') {
        await notify(client, {
          role: 'Store Head',
          storeId,
          title: 'Material return awaiting inspection',
          message: `${srnRef} for ${store} is ready for Store Head review.`,
          type: 'warning',
          route: '/material-return',
          entityType: 'material_return',
          entityId: rows[0].id
        });
      }

      const { rows: full } = await client.query(`${SELECT} WHERE mr.id = $1`, [rows[0].id]);
      created.push(mapMaterialReturn(full[0]));
    }
    return created;
  });

  res.status(201).json(result.length === 1 ? result[0] : result);
});

// POST /api/material-returns/:id/submit
const submit = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT mr.status, mr.srn_ref, mr.department, mr.created_by,
              COALESCE(rs.name, source_store.name) AS store_name,
              COALESCE(rs.id, source_store.id) AS store_id,
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
    if (ret.created_by !== req.user.name) {
      throw new AppError('Only the requester can submit this material return.', 403);
    }
    if (req.user.role === 'Department Head' && ret.department !== req.user.department) {
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
      storeId: ret.store_id,
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
  const { decision, qtyApproved, findings, recommendation, reason } = req.body;
  if (!['Approved', 'Rejected', 'Returned for Correction'].includes(decision)) {
    throw new AppError('decision must be "Approved", "Rejected", or "Returned for Correction".', 400);
  }

  await withTransaction(async (client) => {
    const { rows: returnRows } = await client.query('SELECT store_id FROM material_returns WHERE id = $1', [req.params.id]);
    if (!returnRows[0]) throw new AppError('Material return not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, returnRows[0].store_id, client);
    await stockService.decideMaterialReturn(client, {
      returnId: req.params.id,
      decision,
      qtyApproved,
      findings,
      recommendation,
      reason,
      actorName: req.user.name
    });

    if (decision === 'Approved') {
      const { rows } = await client.query(
        `SELECT mr.srn_ref, COALESCE(rs.storekeeper, source_store.storekeeper) AS receiving_operator,
          COALESCE(rs.id, source_store.id) AS receiving_store_id
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
        storeId: rows[0]?.receiving_store_id,
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
  const { actualQty, acceptedQty, rejectedQty, condition, remarks, rejectionReason } = req.body;

  await withTransaction(async (client) => {
    const { rows: returnRows } = await client.query('SELECT store_id FROM material_returns WHERE id = $1', [req.params.id]);
    if (!returnRows[0]) throw new AppError('Material return not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, returnRows[0].store_id, client);
    await stockService.receiveMaterialReturn(client, {
      returnId: req.params.id,
      actualQty,
      acceptedQty,
      rejectedQty,
      condition,
      remarks,
      rejectionReason,
      actorName: req.user.name
    });
  });

  const { rows } = await query(`${SELECT} WHERE mr.id = $1`, [req.params.id]);
  res.json(mapMaterialReturn(rows[0]));
});

const resubmit = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    const { rows: returnRows } = await client.query('SELECT store_id FROM material_returns WHERE id = $1', [req.params.id]);
    if (!returnRows[0]) throw new AppError('Material return not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, returnRows[0].store_id, client);
    await stockService.decideMaterialReturn(client, {
      returnId: req.params.id,
      decision: 'Submitted',
      actorName: req.user.name
    });
  });

  const { rows } = await query(`${SELECT} WHERE mr.id = $1`, [req.params.id]);
  res.json(mapMaterialReturn(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const scope = req.user.role === 'Department Head' ? ' AND (department = $2 OR created_by = $3)' : '';
  const params = req.user.role === 'Department Head'
    ? [req.params.id, req.user.department, req.user.name]
    : [req.params.id];
  const { rows: check } = await query(`SELECT status, store_id FROM material_returns WHERE id = $1${scope}`, params);
  if (!check[0]) throw new AppError('Material return not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, check[0].store_id, { query });
  if (!['Draft', 'Submitted', 'Pending Review', 'Pending'].includes(check[0].status)) throw new AppError('Cannot delete a material return that has already been processed.', 400);

  const { rows } = await query('DELETE FROM material_returns WHERE id = $1 RETURNING srn_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted return ${rows[0].srn_ref}`, module: 'Material Return' });
  res.status(204).send();
});

module.exports = { list, getOne, create, submit, decide, receive, resubmit, remove };
