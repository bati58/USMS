const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapRequisition, resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord, assertUserCanAccessDepartmentRecord } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT r.*, s.name AS store_name
  FROM requisitions r
  LEFT JOIN stores s ON s.id = r.store_id
`;

async function fetchWithLines(id, dbClient = { query }) {
  const { rows } = await dbClient.query(`${SELECT} WHERE r.id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: lines } = await dbClient.query(
    `SELECT ri.*, i.name AS item_name FROM requisition_items ri JOIN items i ON i.id = ri.item_id WHERE ri.requisition_id = $1`,
    [id]
  );
  const { rows: approvals } = await dbClient.query(
    'SELECT decision, comments, approved_by, approved_at FROM requisition_approvals WHERE requisition_id = $1 ORDER BY approved_at DESC',
    [id]
  );
  return mapRequisition(rows[0], lines, approvals);
}

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Department Head') {
    scope = 'WHERE r.requested_by = $1';
    params = [req.user.name];
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE r.store_id = $1';
      params = [visibility.assignedStoreId];
    }
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY r.id DESC`, params);
  const results = [];
  for (const row of rows) {
    const { rows: lines } = await query(
      `SELECT ri.*, i.name AS item_name FROM requisition_items ri JOIN items i ON i.id = ri.item_id WHERE ri.requisition_id = $1`,
      [row.id]
    );
    const { rows: approvals } = await query('SELECT decision, comments, approved_by, approved_at FROM requisition_approvals WHERE requisition_id = $1 ORDER BY approved_at DESC', [row.id]);
    results.push(mapRequisition(row, lines, approvals));
  }
  res.json(results);
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Department Head') {
    scope = ' AND r.requested_by = $2';
    params.push(req.user.name);
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND r.store_id = $2';
      params.push(visibility.assignedStoreId);
    } else {
      throw new AppError('You are not assigned to any store scope.', 403);
    }
  }

  const { rows } = await query(`${SELECT} WHERE r.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Requisition not found.', 404);

  if (req.user.role === 'Department Head') {
    await assertUserCanAccessDepartmentRecord(req.user, rows[0].department, { query });
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
  }

  const r = await fetchWithLines(rows[0].id);
  res.json(r);
});

// POST /api/requisitions — Backend-SRS §6.2 step 1 (Pending only, no stock change)
const create = asyncHandler(async (req, res) => {
  const { department, requestedBy, date, store, items } = req.body;
  const effectiveDepartment = req.user.role === 'Department Head' ? req.user.department : department;
  if (!effectiveDepartment || !store || !Array.isArray(items) || items.length === 0) {
    throw new AppError('department, store, and at least one item are required.', 400);
  }

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    const srRef = await nextRef(client, 'SR');

    const { rows } = await client.query(
      `INSERT INTO requisitions (sr_ref, department, requested_by, date, store_id, status)
       VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,'Draft') RETURNING id`,
      [srRef, effectiveDepartment, req.user.role === 'Department Head' ? req.user.name : (requestedBy || req.user.name), date || null, storeId]
    );
    const reqId = rows[0].id;

    for (const line of items) {
      const itemId = await resolveItemId(line.item, client, storeId);
      if (!itemId) throw new AppError(`Unknown item on this requisition: "${line.item}".`, 400);
      await client.query('INSERT INTO requisition_items (requisition_id, item_id, qty) VALUES ($1,$2,$3)', [
        reqId,
        itemId,
        line.qty
      ]);
    }

    await logAudit(client, { userName: req.user.name, action: `Created requisition ${srRef}`, module: 'Store Requisition' });
    // No notification on create: a Draft requisition is not yet awaiting anyone.
    // The approver is notified when the requester submits it (see `submit`).

    return fetchWithLines(reqId, client);
  });

  res.status(201).json(result);
});

// POST /api/requisitions/:id/submit
const submit = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT r.status, r.sr_ref, r.department, r.requested_by, dh.id AS department_head_id
       FROM requisitions r
       LEFT JOIN users dh ON dh.role = 'Department Head' AND dh.department = r.department AND dh.active = TRUE
       WHERE r.id = $1 FOR UPDATE OF r`,
      [req.params.id]
    );
    const reqDoc = rows[0];
    if (!reqDoc) throw new AppError('Requisition not found.', 404);
    if (req.user.role === 'Department Head' && reqDoc.department !== req.user.department && reqDoc.requested_by !== req.user.name) {
      throw new AppError('You can only submit requisitions from your department.', 403);
    }
    if (!['Draft', 'Pending', 'Returned for Correction'].includes(reqDoc.status)) {
      throw new AppError(`Cannot submit requisition in status: ${reqDoc.status}`, 400);
    }

    // Two-stage approval routing. Stage 1 is the Department Head — but a Department Head
    // cannot approve their own department's requisition, and seeded departments frequently
    // have no Department Head user at all. In either case we skip stage 1 and route
    // straight to the PAO (stage 2, status 'Pending Approval') so the flow never dead-ends.
    const routeToDeptHead = Boolean(reqDoc.department_head_id) && req.user.role !== 'Department Head';
    const nextStatus = routeToDeptHead ? 'Submitted' : 'Pending Approval';

    await client.query('UPDATE requisitions SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, req.params.id]);
    await logAudit(client, { userName: req.user.name, action: `Submitted requisition ${reqDoc.sr_ref}`, module: 'Store Requisition' });

    await notify(client, routeToDeptHead
      ? {
        userId: reqDoc.department_head_id,
        title: 'Requisition Awaiting Your Approval',
        message: `Requisition ${reqDoc.sr_ref} from ${reqDoc.department} was submitted and needs your department approval.`,
        type: 'info',
        route: `/requisitions/${req.params.id}`,
        entityType: 'requisition',
        entityId: req.params.id
      }
      : {
        role: 'Property Administration Officer',
        title: 'Requisition Awaiting Approval',
        message: `Requisition ${reqDoc.sr_ref} from ${reqDoc.department} is ready for your approval.`,
        type: 'info',
        route: `/requisitions/${req.params.id}`,
        entityType: 'requisition',
        entityId: req.params.id
      });

    return fetchWithLines(req.params.id, client);
  });
  res.json(result);
});

// POST /api/requisitions/:id/approve — two-stage approval (Backend-SRS §6.2 step 2, no stock change)
//   Stage 1 (Department Head): Submitted -> Pending Approval (endorse) | Rejected | Returned for Correction
//   Stage 2 (PAO):             Pending Approval -> Approved / Partially Approved | Rejected | Returned for Correction
const decide = asyncHandler(async (req, res) => {
  const { decision, items, comments } = req.body;
  if (!['Approved', 'Partially Approved', 'Rejected', 'Returned for Correction'].includes(decision)) {
    throw new AppError('decision must be "Approved", "Partially Approved", "Rejected", or "Returned for Correction".', 400);
  }

  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT status, department, requested_by, sr_ref FROM requisitions WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw new AppError('Requisition not found.', 404);
    const { status, department, requested_by: requestedBy, sr_ref: srRef } = rows[0];
    const role = req.user.role;
    const isApproval = decision === 'Approved' || decision === 'Partially Approved';

    if (role === 'Department Head') {
      // Stage 1 — own department only, never one's own requisition.
      if (status !== 'Submitted') throw new AppError('This requisition is not awaiting department approval.', 409);
      if (department !== req.user.department) throw new AppError('You can only approve requisitions from your department.', 403);
      if (requestedBy === req.user.name) throw new AppError('You cannot approve a requisition that you created yourself.', 403);

      if (isApproval) {
        // Endorse only — forward to the PAO. Final quantities are set by the PAO at stage 2.
        await stockService.endorseRequisition(client, { requisitionId: req.params.id, comments, actorName: req.user.name });
        await notify(client, {
          role: 'Property Administration Officer',
          title: 'Requisition Awaiting Approval',
          message: `Requisition ${srRef} was endorsed by the Department Head and needs your approval.`,
          type: 'info',
          route: `/requisitions/${req.params.id}`,
          entityType: 'requisition',
          entityId: req.params.id
        });
        return;
      }
    } else if (role === 'Property Administration Officer') {
      // Stage 2 — final approval.
      if (status !== 'Pending Approval') throw new AppError('This requisition is not awaiting your approval.', 409);
    } else {
      throw new AppError('You are not authorized to decide on this requisition.', 403);
    }

    // Stage-2 approval, or a rejection/return from either stage — all four are CHECK-valid decisions.
    await stockService.decideRequisition(client, { requisitionId: req.params.id, decision, items, comments, actorName: req.user.name });

    if (isApproval) {
      // Approved by the PAO -> the Store Head prepares the issue voucher.
      await notify(client, {
        role: 'Store Head',
        storeId: rows[0]?.store_id,
        title: 'Requisition Approved',
        message: `Requisition ${srRef} was ${decision.toLowerCase()}. Generate the issue voucher to fulfil it.`,
        type: 'success',
        route: `/requisitions/${req.params.id}`,
        entityType: 'requisition',
        entityId: req.params.id
      });
    } else {
      // Rejected or Returned for Correction -> notify the requester directly (fall back to
      // the Department Head role if the requester has no user account).
      const { rows: requester } = await client.query('SELECT id FROM users WHERE name = $1 AND active = true LIMIT 1', [requestedBy]);
      await notify(client, {
        userId: requester[0]?.id,
        role: requester[0] ? undefined : 'Department Head',
        title: `Requisition ${decision}`,
        message: decision === 'Returned for Correction'
          ? `Requisition ${srRef} was returned for correction. Update and resubmit it.`
          : `Requisition ${srRef} was rejected.`,
        type: 'warning',
        route: `/requisitions/${req.params.id}`,
        entityType: 'requisition',
        entityId: req.params.id
      });
    }
  });

  res.json(await fetchWithLines(req.params.id));
});

const remove = asyncHandler(async (req, res) => {
  const scope = req.user.role === 'Department Head' ? ' AND (department = $2 OR requested_by = $3)' : '';
  const params = req.user.role === 'Department Head'
    ? [req.params.id, req.user.department, req.user.name]
    : [req.params.id];
  const { rows: check } = await query(`SELECT status FROM requisitions WHERE id = $1${scope}`, params);
  if (!check[0]) throw new AppError('Requisition not found.', 404);
  if (!['Draft', 'Pending'].includes(check[0].status)) throw new AppError('Cannot delete a requisition that has already been processed.', 400);

  const { rows } = await query('DELETE FROM requisitions WHERE id = $1 RETURNING sr_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted requisition ${rows[0].sr_ref}`, module: 'Store Requisition' });
  res.status(204).send();
});

module.exports = { list, getOne, create, submit, decide, remove };
