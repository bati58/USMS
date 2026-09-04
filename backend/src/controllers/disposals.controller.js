const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapDisposal, resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');
const { assertTransition } = require('../utils/workflow');

const SELECT = `
  SELECT d.*, s.name AS store_name, i.name AS item_name
  FROM disposals d
  LEFT JOIN stores s ON s.id = d.store_id
  LEFT JOIN items i ON i.id = d.item_id
`;

const ACTION_RECIPIENTS = {
  Quarantined: { role: 'Technical Evaluation Committee' },
  'Under Technical Assessment': { role: 'Technical Evaluation Committee' },
  Repairable: { role: 'Storekeeper' },
  'Returned to Stock': { role: 'Storekeeper' },
  Unusable: { role: 'Store Head' },
  'Disposal Requested': { role: 'Store Head' },
  'Pending Store Head Review': { role: 'Store Head' },
  'Recommended for Disposal': { role: 'Property Administration Officer' },
  'Pending Authorization': { role: 'Property Administration Officer' },
  'Ready for Disposal': { role: 'Storekeeper' },
  Disposed: { role: 'Storekeeper' },
  'Pending Confirmation': { role: 'Property Administration Officer' },
  Confirmed: { role: 'Property Administration Officer' }
};

async function transitionDisposal(req, client, nextStatus, fields = {}) {
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [req.params.id]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, disposal.store_id, client);
  assertTransition('disposal', disposal.status, nextStatus);

  const updates = ['status = $1', 'updated_at = NOW()'];
  const values = [nextStatus];
  Object.entries(fields).forEach(([column, value]) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  });
  values.push(req.params.id);
  await client.query(`UPDATE disposals SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
  await logAudit(client, { userName: req.user.name, action: `Moved disposal ${disposal.disposal_ref} to ${nextStatus}`, module: 'Disposal Management', entityType: 'disposal', entityId: disposal.id, entityReference: disposal.disposal_ref });

  const recipient = ACTION_RECIPIENTS[nextStatus];
  if (recipient) {
    await notify(client, {
      ...recipient,
      storeId: disposal.store_id,
      title: 'Disposal Action Required',
      message: `${disposal.disposal_ref} is now ${nextStatus}.`,
      type: 'warning',
      route: '/disposal',
      entityType: 'disposal',
      entityId: disposal.id
    });
  }
}

const action = (nextStatus, fieldsFactory = () => ({})) => asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    await transitionDisposal(req, client, nextStatus, fieldsFactory(req));
  });
  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const quarantine = action('Quarantined');
const startAssessment = action('Under Technical Assessment');
const requestDisposal = action('Disposal Requested');
const review = action('Store Head Review', (req) => ({ reviewed_by: req.user.name, reviewed_at: new Date() }));
const recommend = action('Recommended for Disposal', (req) => ({ reviewed_by: req.user.name, reviewed_at: new Date() }));
const submitAuthorization = action('Pending Authorization');
const sendForRepair = action('Send for Repair');
const reassess = action('Under Technical Assessment');
const authorize = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  const nextStatus = decision === 'Rejected' || decision === 'Returned for Correction' ? decision : 'Ready for Disposal';
  if (!['Approved', 'Rejected', 'Returned for Correction'].includes(decision)) throw new AppError('decision must be "Approved", "Rejected", or "Returned for Correction".', 400);
  await withTransaction(async (client) => {
    await transitionDisposal(req, client, nextStatus, decision === 'Approved' ? { approved_by: req.user.name, approved_at: new Date() } : {});
  });
  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const assess = asyncHandler(async (req, res) => {
  const { result, notes } = req.body;
  const targets = { repairable: 'Repairable', unusable: 'Unusable', 'return to stock': 'Returned to Stock' };
  const nextStatus = targets[String(result || '').trim().toLowerCase()];
  if (!nextStatus) throw new AppError('Assessment result must be Repairable, Unusable, or Return to Stock.', 400);
  await withTransaction(async (client) => {
    await transitionDisposal(req, client, nextStatus, { assessment_result: result, assessment_notes: notes || null });
  });
  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const submitConfirmation = action('Pending Confirmation');
const confirm = action('Confirmed', (req) => ({ confirmed_by: req.user.name, confirmed_at: new Date() }));
const post = action('Posted', (req) => ({ posted_by: req.user.name, posted_at: new Date() }));

const list = asyncHandler(async (req, res) => {
  const visibility = await getUserStoreVisibility(req.user, { query });
  let scope = '';
  let params = [];

  if (visibility.storeFilter && !visibility.canViewAllStores) {
    scope = 'WHERE d.store_id = $1';
    params = [visibility.storeFilter.id];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY d.id DESC`, params);
  res.json(rows.map(mapDisposal));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Disposal request not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
  res.json(mapDisposal(rows[0]));
});

// POST /api/disposals — Backend-SRS §6.7 step 1 (Pending, no stock change)
const create = asyncHandler(async (req, res) => {
  const { item, itemId, store, qty, reason, dateFlagged, supportingDocument } = req.body;
  if (!item || !store || !qty || !String(reason || '').trim()) throw new AppError('item, store, positive qty, and a disposal reason are required.', 400);
  if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) throw new AppError('Disposal quantity must be positive.', 400);

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    await assertUserCanAccessStoreRecord(req.user, storeId, client);
    const resolvedItemId = itemId
      ? (await client.query('SELECT id FROM items WHERE id = $1 AND store_id = $2', [itemId, storeId])).rows[0]?.id
      : await resolveItemId(item, client, storeId);
    if (!resolvedItemId) throw new AppError(`Unknown item: "${item || itemId}" in the selected store.`, 400);
    const { rows: stockRows } = await client.query('SELECT qty_on_hand FROM items WHERE id = $1 FOR UPDATE', [resolvedItemId]);
    if (!stockRows[0] || Number(stockRows[0].qty_on_hand) < Number(qty)) {
      throw new AppError('The requested disposal quantity exceeds the current stock on hand.', 400);
    }
    const disposalRef = await nextRef(client, 'DSP');

    const { rows } = await client.query(
      `INSERT INTO disposals (disposal_ref, item_id, store_id, qty, reason, date_flagged, status, created_by, supporting_document)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),'Flagged',$7,$8) RETURNING id`,
      [disposalRef, resolvedItemId, storeId, qty, reason.trim(), dateFlagged || null, req.user.name, supportingDocument || null]
    );

    await logAudit(client, { userName: req.user.name, action: `Created disposal request ${disposalRef}`, module: 'Disposal Management', entityType: 'disposal', entityId: rows[0].id, entityReference: disposalRef });

    const { rows: full } = await client.query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
    return mapDisposal(full[0]);
  });

  res.status(201).json(result);
});

const update = asyncHandler(async (req, res) => {
  const { reason, dateFlagged, supportingDocument } = req.body;
  const { rows: currentRows } = await query('SELECT store_id FROM disposals WHERE id = $1', [req.params.id]);
  if (!currentRows[0]) throw new AppError('Disposal request not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, currentRows[0].store_id, { query });
  if (reason !== undefined && !String(reason).trim()) throw new AppError('A disposal reason is required.', 400);

  const { rows } = await query(
    `UPDATE disposals SET
       reason = COALESCE($1, reason), date_flagged = COALESCE($2, date_flagged),
       supporting_document = COALESCE($3, supporting_document), updated_at = NOW()
    WHERE id = $4 AND status IN ('Flagged','Quarantined','Under Technical Assessment','Repairable','Unusable','Send for Repair','Disposal Requested','Pending Store Head Review','Store Head Review','Recommended for Disposal','Requested','Pending Review','Returned for Correction')
     RETURNING id`,
    [reason ? String(reason).trim() : null, dateFlagged, supportingDocument, req.params.id]
  );
  if (!rows[0]) throw new AppError('Disposal request not found or is no longer editable.', 409);

  await logAudit(query, { userName: req.user.name, action: `Updated disposal ${req.params.id}`, module: 'Disposal Management' });
  const { rows: full } = await query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
  res.json(mapDisposal(full[0]));
});

// POST /api/disposals/:id/approve — Backend-SRS §6.7 step 2
const decide = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected', 'Returned for Correction'].includes(decision)) throw new AppError('decision must be "Approved", "Rejected", or "Returned for Correction".', 400);

  await withTransaction(async (client) => {
    const { rows: disposalRows } = await client.query('SELECT store_id FROM disposals WHERE id = $1', [req.params.id]);
    if (!disposalRows[0]) throw new AppError('Disposal request not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, disposalRows[0].store_id, client);
    await stockService.decideDisposal(client, { disposalId: req.params.id, decision, actorName: req.user.name });

    // Phase 5: persist the approval so the executor is notified server-side, not only in the browser.
    if (decision === 'Approved') {
      const { rows } = await client.query('SELECT disposal_ref, store_id FROM disposals WHERE id = $1', [req.params.id]);
      await notify(client, {
        role: 'Storekeeper',
        storeId: rows[0]?.store_id,
        title: 'Disposal Approved - Execution Required',
        message: `Disposal ${rows[0]?.disposal_ref} was approved and is ready to execute.`,
        type: 'success',
        route: '/disposal',
        entityType: 'disposal',
        entityId: req.params.id
      });
    }
  });

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const execute = asyncHandler(async (req, res) => {
  if (!String(req.body.disposalMethod || '').trim() || !String(req.body.witness || '').trim()) {
    throw new AppError('Disposal method and witness are required to execute a disposal.', 400);
  }
  await withTransaction(async (client) => {
    const { rows: disposalRows } = await client.query('SELECT store_id FROM disposals WHERE id = $1', [req.params.id]);
    if (!disposalRows[0]) throw new AppError('Disposal request not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, disposalRows[0].store_id, client);
    await stockService.executeDisposal(client, { disposalId: req.params.id, actorName: req.user.name, disposalDate: req.body.disposalDate, disposalMethod: req.body.disposalMethod, witness: req.body.witness });
    await notify(client, {
      role: 'Property Administration Officer',
      title: 'Disposal Awaiting Confirmation',
      message: `Disposal ${req.params.id} was physically executed and awaits confirmation.`,
      type: 'info',
      route: '/disposal',
      entityType: 'disposal',
      entityId: req.params.id
    });
  });

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const complete = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    const { rows: disposalRows } = await client.query('SELECT store_id FROM disposals WHERE id = $1', [req.params.id]);
    if (!disposalRows[0]) throw new AppError('Disposal request not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, disposalRows[0].store_id, client);
    await stockService.completeDisposal(client, { disposalId: req.params.id, actorName: req.user.name });
  });

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const close = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    const { rows: disposalRows } = await client.query('SELECT store_id FROM disposals WHERE id = $1', [req.params.id]);
    if (!disposalRows[0]) throw new AppError('Disposal request not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, disposalRows[0].store_id, client);
    await stockService.closeDisposal(client, { disposalId: req.params.id, actorName: req.user.name });
  });

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows: check } = await query('SELECT status FROM disposals WHERE id = $1', [req.params.id]);
  if (!check[0]) throw new AppError('Disposal request not found.', 404);
  if (!['Flagged', 'Quarantined', 'Under Technical Assessment', 'Repairable', 'Unusable', 'Send for Repair', 'Disposal Requested', 'Pending Store Head Review', 'Store Head Review', 'Recommended for Disposal', 'Requested', 'Pending Review', 'Returned for Correction'].includes(check[0].status)) throw new AppError('Cannot delete a disposal request that has already been processed.', 400);

  const { rows } = await query('DELETE FROM disposals WHERE id = $1 RETURNING disposal_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted disposal ${rows[0].disposal_ref}`, module: 'Disposal Management' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, decide, execute, complete, close, remove, quarantine, startAssessment, assess, sendForRepair, reassess, requestDisposal, review, recommend, submitAuthorization, authorize, submitConfirmation, confirm, post };
