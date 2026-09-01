const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapRequisition, resolveStoreId, resolveItemId } = require('./_helpers');
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
    scope = 'WHERE r.department = $1 OR r.requested_by = $2';
    params = [req.user.department || req.user.name, req.user.name];
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role) && req.user.store) {
    scope = 'WHERE s.name = $1';
    params = [req.user.store];
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
    scope = ' AND (r.department = $2 OR r.requested_by = $3)';
    params.push(req.user.department || req.user.name, req.user.name);
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role) && req.user.store) {
    scope = ' AND s.name = $2';
    params.push(req.user.store);
  }

  const { rows } = await query(`${SELECT} WHERE r.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Requisition not found.', 404);
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
    await client.query('UPDATE requisitions SET status = $1, updated_at = NOW() WHERE id = $2', ['Submitted', req.params.id]);
    await logAudit(client, { userName: req.user.name, action: `Submitted requisition ${reqDoc.sr_ref}`, module: 'Store Requisition' });

    await notify(client, {
      userId: req.user.role === 'Department Head' ? undefined : (reqDoc.department_head_id || undefined),
      role: req.user.role === 'Department Head' || !reqDoc.department_head_id ? 'Property Administration Officer' : undefined,
      title: 'Requisition Submitted',
      message: `Requisition ${reqDoc.sr_ref} from ${reqDoc.department} has been submitted and requires approval.`,
      type: 'info',
      route: `/requisitions/${req.params.id}`,
      entityType: 'requisition',
      entityId: req.params.id
    });

    return fetchWithLines(req.params.id, client);
  });
  res.json(result);
});

// POST /api/requisitions/:id/approve — Backend-SRS §6.2 step 2 (no stock change)
const decide = asyncHandler(async (req, res) => {
  const { decision, items, comments } = req.body;
  if (!['Approved', 'Partially Approved', 'Rejected', 'Returned for Correction'].includes(decision)) {
    throw new AppError('decision must be "Approved", "Partially Approved", "Rejected", or "Returned for Correction".', 400);
  }

  await withTransaction(async (client) => {
    if (req.user.role === 'Department Head') {
      const { rows } = await client.query('SELECT department, requested_by FROM requisitions WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!rows[0]) throw new AppError('Requisition not found.', 404);
      if (rows[0].department !== req.user.department) {
        throw new AppError('You can only approve requisitions from your department.', 403);
      }
      if (rows[0].requested_by === req.user.name) {
        throw new AppError('You cannot approve a requisition that you created yourself.', 403);
      }
    }
    await stockService.decideRequisition(client, { requisitionId: req.params.id, decision, items, comments, actorName: req.user.name });

    const { rows } = await client.query('SELECT sr_ref FROM requisitions WHERE id = $1', [req.params.id]);
    const srRef = rows[0]?.sr_ref;

    // Phase 5: the approval outcome must be persisted, not derived only in the browser.
    if (decision === 'Approved' || decision === 'Partially Approved') {
      await notify(client, {
        role: 'Storekeeper',
        title: 'Requisition Approved',
        message: `Requisition ${srRef} was ${decision.toLowerCase()}. Generate the issue voucher to fulfil it.`,
        type: 'success',
        route: `/requisitions/${req.params.id}`,
        entityType: 'requisition',
        entityId: req.params.id
      });
    } else if (decision === 'Returned for Correction') {
      await notify(client, {
        role: 'Department Head',
        title: 'Requisition Returned for Correction',
        message: `Requisition ${srRef} was returned for correction. Update and resubmit it.`,
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
