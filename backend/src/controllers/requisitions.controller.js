const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapRequisition, resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord, assertUserCanAccessDepartmentRecord } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT r.*, s.name AS store_name, issuing_store.name AS issuing_store_name, requester.role AS requester_role
  FROM requisitions r
  LEFT JOIN stores s ON s.id = r.store_id
  LEFT JOIN stores issuing_store ON issuing_store.id = COALESCE(r.issuing_store_id, r.store_id)
  LEFT JOIN users requester ON requester.name = r.requested_by AND requester.active = TRUE
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
    scope = 'WHERE r.department = $1';
    params = [req.user.department];
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE (r.store_id = $1 OR COALESCE(r.issuing_store_id, r.store_id) = $1)';
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
    scope = ' AND r.department = $2';
    params.push(req.user.department);
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND (r.store_id = $2 OR COALESCE(r.issuing_store_id, r.store_id) = $2)';
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
    await assertUserCanAccessStoreRecord(req.user, req.user.role === 'Store Head' ? (rows[0].issuing_store_id || rows[0].store_id) : rows[0].store_id, { query });
  }

  const r = await fetchWithLines(rows[0].id);
  res.json(r);
});

// POST /api/requisitions — Backend-SRS §6.2 step 1 (Pending only, no stock change)
const create = asyncHandler(async (req, res) => {
  const { department, requestedBy, date, store, items, reason } = req.body;
  const effectiveDepartment = req.user.role === 'Department Head' ? req.user.department : department;
  if (req.user.role === 'Department Head' && department && department !== req.user.department) {
    throw new AppError('You can only create requisitions for your own department.', 403);
  }
  if ((!effectiveDepartment && req.user.role !== 'Storekeeper') || !store || !reason?.trim() || !Array.isArray(items) || items.length === 0) {
    throw new AppError('department, store, reason, and at least one item are required.', 400);
  }
  if (date && Number.isNaN(Date.parse(date))) throw new AppError('Date must be a valid calendar date.', 400);
  items.forEach((line, index) => {
    if (!line.item?.trim()) throw new AppError(`Item is required on line ${index + 1}.`, 400);
    if (!Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0) throw new AppError(`Quantity must be greater than zero on line ${index + 1}.`, 400);
  });

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    const { rows: destinationStores } = await client.query(
      `SELECT type, active FROM stores WHERE id = $1`,
      [storeId]
    );
    if (!destinationStores[0]?.active) throw new AppError('The requesting store is not active.', 400);
    if (req.user.role === 'Storekeeper' && destinationStores[0].type === 'Main Store') {
      throw new AppError('A Sub-Store Storekeeper must request materials for their assigned Sub-Store.', 403);
    }
    if (req.user.role === 'Storekeeper') {
      const visibility = await getUserStoreVisibility(req.user, client);
      if (!visibility.assignedStoreId || visibility.canViewAllStores || Number(visibility.assignedStoreId) !== Number(storeId)) {
        throw new AppError('You can only create a requisition for your assigned Sub-Store.', 403);
      }
    }
    const requestDepartment = req.user.role === 'Storekeeper'
      ? (req.user.department || 'Store Operations')
      : effectiveDepartment;
    if (!requestDepartment) throw new AppError('A department is required for this requisition.', 400);
    const { rows: mainStores } = await client.query(
      `SELECT id FROM stores WHERE active = TRUE AND type = 'Main Store' ORDER BY id LIMIT 1`
    );
    const issuingStoreId = req.user.role === 'Storekeeper' ? mainStores[0]?.id : storeId;
    const itemStoreId = issuingStoreId;
    if (req.user.role === 'Storekeeper' && !itemStoreId) {
      throw new AppError('No active Main Store is configured.', 500);
    }
    const srRef = await nextRef(client, 'SR');

    const { rows } = await client.query(
      `INSERT INTO requisitions (sr_ref, department, requested_by, date, store_id, issuing_store_id, priority, reason, status)
       VALUES ($1,$2,$3,COALESCE($4, CURRENT_DATE),$5,$6,$7,$8,'Draft') RETURNING id`,
      [srRef, requestDepartment, req.user.role === 'Department Head' ? req.user.name : (requestedBy || req.user.name), date || null, storeId, issuingStoreId, req.body.priority || 'Normal', reason.trim()]
    );
    const reqId = rows[0].id;

    for (const line of items) {
      const itemId = await resolveItemId(line.item, client);
      if (!itemId) throw new AppError(`Unknown item on this requisition: "${line.item}".`, 400);
      await client.query('INSERT INTO requisition_items (requisition_id, item_id, qty) VALUES ($1,$2,$3)', [
        reqId,
        itemId,
        line.qty
      ]);
    }

    await logAudit(client, {
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: `Created requisition ${srRef}`,
      module: 'Store Requisition',
      entityType: 'requisition',
      entityId: reqId,
      entityReference: srRef,
      afterData: { status: 'Draft' }
    });
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
      `SELECT r.status, r.sr_ref, r.department, r.requested_by, r.store_id, r.issuing_store_id,
          requester.role AS requester_role, dh.id AS department_head_id,
          COALESCE(sh.id, legacy_sh.id) AS store_head_id
       FROM requisitions r
         LEFT JOIN users requester ON requester.name = r.requested_by AND requester.active = TRUE
       LEFT JOIN users dh ON dh.role = 'Department Head' AND dh.department = r.department AND dh.active = TRUE
         LEFT JOIN stores s ON s.id = COALESCE(r.issuing_store_id, r.store_id)
       LEFT JOIN store_user_assignments a ON a.store_id = s.id AND a.assignment_role = 'Store Head' AND a.active = TRUE
       LEFT JOIN users sh ON sh.id = a.user_id AND sh.role = 'Store Head' AND sh.active = TRUE
       LEFT JOIN users legacy_sh ON legacy_sh.role = 'Store Head' AND legacy_sh.name = s.head_of_store AND legacy_sh.active = TRUE
       WHERE r.id = $1 FOR UPDATE OF r`,
      [req.params.id]
    );
    const reqDoc = rows[0];
    if (!reqDoc) throw new AppError('Requisition not found.', 404);
    if (reqDoc.requested_by !== req.user.name) throw new AppError('Only the requester can submit this requisition.', 403);
    if (req.user.role === 'Department Head' && reqDoc.department !== req.user.department) throw new AppError('You can only submit requisitions from your department.', 403);
    if (['Store Head', 'Storekeeper'].includes(req.user.role)) await assertUserCanAccessStoreRecord(req.user, req.user.role === 'Store Head' ? (reqDoc.issuing_store_id || reqDoc.store_id) : reqDoc.store_id, client);
    if (!['Draft', 'Pending', 'Returned for Correction'].includes(reqDoc.status)) {
      throw new AppError(`Cannot submit requisition in status: ${reqDoc.status}`, 400);
    }

    // Two-stage approval routing. Stage 1 is the Department Head — but a Department Head
    // cannot approve their own department's requisition, and seeded departments frequently
    // have no Department Head user at all. In either case we skip stage 1 and route
    // straight to the PAO (stage 2, status 'Pending Approval') so the flow never dead-ends.
    const routeToDeptHead = Boolean(reqDoc.department_head_id) && req.user.role !== 'Department Head';
    const routeToStoreHead = Boolean(reqDoc.store_head_id) && (req.user.role === 'Department Head' || reqDoc.requester_role === 'Storekeeper');
    const nextStatus = routeToDeptHead || routeToStoreHead ? 'Submitted' : 'Pending Approval';

    await client.query('UPDATE requisitions SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, req.params.id]);
    await logAudit(client, {
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: `Submitted requisition ${reqDoc.sr_ref}`,
      module: 'Store Requisition',
      entityType: 'requisition',
      entityId: req.params.id,
      entityReference: reqDoc.sr_ref,
      beforeData: { status: reqDoc.status },
      afterData: { status: nextStatus }
    });

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
      : routeToStoreHead
        ? {
          userId: reqDoc.store_head_id,
          title: 'Requisition Awaiting Store Head Approval',
          message: `Requisition ${reqDoc.sr_ref} from ${reqDoc.department} is ready for approval by the issuing store before fulfillment.`,
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
    const { rows } = await client.query(
      `SELECT r.status, r.department, r.requested_by, r.store_id, r.issuing_store_id, r.sr_ref, requester.role AS requester_role
       FROM requisitions r
       LEFT JOIN users requester ON requester.name = r.requested_by AND requester.active = TRUE
       WHERE r.id = $1 FOR UPDATE OF r`,
      [req.params.id]
    );
    if (!rows[0]) throw new AppError('Requisition not found.', 404);
    const { status, department, requested_by: requestedBy, sr_ref: srRef, requester_role: requesterRole } = rows[0];
    const role = req.user.role;
    const isApproval = decision === 'Approved' || decision === 'Partially Approved';

    if (role === 'Department Head') {
      // Stage 1 — own department only, never one's own requisition.
      if (status !== 'Submitted') throw new AppError('This requisition is not awaiting department approval.', 409);
      if (department !== req.user.department) throw new AppError('You can only approve requisitions from your department.', 403);
      if (requestedBy === req.user.name) throw new AppError('You cannot approve a requisition that you created yourself.', 403);

      if (isApproval) {
        // Endorse only — forward to the PAO. Final quantities are set by the PAO at stage 2.
        await stockService.endorseRequisition(client, { requisitionId: req.params.id, comments, actorName: req.user.name, actorRole: req.user.role });
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
    } else if (role === 'Store Head') {
      if (status !== 'Submitted') throw new AppError('This requisition is not awaiting Store Head approval.', 409);
      await assertUserCanAccessStoreRecord(req.user, req.user.role === 'Store Head' ? (rows[0].issuing_store_id || rows[0].store_id) : rows[0].store_id, client);
    } else if (role === 'Property Administration Officer') {
      // Stage 2 — final approval.
      if (status !== 'Pending Approval') throw new AppError('This requisition is not awaiting your approval.', 409);
    } else {
      throw new AppError('You are not authorized to decide on this requisition.', 403);
    }

    // Stage-2 approval, or a rejection/return from either stage — all four are CHECK-valid decisions.
    await stockService.decideRequisition(client, { requisitionId: req.params.id, decision, items, comments, actorName: req.user.name, actorRole: req.user.role });

    if (isApproval) {
      // Approved by the issuing Store Head -> the Storekeeper prepares the issue voucher.
      const nextStorekeeperStoreId = requesterRole === 'Storekeeper'
        ? rows[0].issuing_store_id || rows[0].store_id
        : rows[0].store_id;
      await notify(client, {
        role: 'Storekeeper',
        storeId: nextStorekeeperStoreId,
        title: 'Requisition Approved',
        message: requesterRole === 'Storekeeper'
          ? `Requisition ${srRef} was ${decision.toLowerCase()}. Prepare the replenishment through Material Transfers.`
          : `Requisition ${srRef} was ${decision.toLowerCase()}. Generate the preliminary issue voucher for Store Head authorization.`,
        type: 'success',
        route: requesterRole === 'Storekeeper' ? '/material-transfer' : '/issue-vouchers',
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
  await logAudit(query, {
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: `Deleted requisition ${rows[0].sr_ref}`,
    module: 'Store Requisition',
    entityType: 'requisition',
    entityId: req.params.id,
    entityReference: rows[0].sr_ref,
    beforeData: { status: check[0].status },
    afterData: { status: 'Deleted' }
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, submit, decide, remove };
