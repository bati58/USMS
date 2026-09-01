const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapMaterialTransfer, resolveStoreId, resolveItemId } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT mt.*, fs.name AS from_store_name, ts.name AS to_store_name, i.name AS item_name
  FROM material_transfers mt
  LEFT JOIN stores fs ON fs.id = mt.from_store_id
  LEFT JOIN stores ts ON ts.id = mt.to_store_id
  LEFT JOIN items i ON i.id = mt.item_id
`;

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = 'WHERE fs.name = $1 OR ts.name = $1';
    params = [req.user.store];
  } else if (req.user.role === 'Department Head') {
    scope = 'WHERE mt.department = $1 OR mt.requested_by = $2';
    params = [req.user.department || '', req.user.name];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY mt.id DESC`, params);
  res.json(rows.map(mapMaterialTransfer));
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = ' AND (fs.name = $2 OR ts.name = $2)';
    params.push(req.user.store);
  } else if (req.user.role === 'Department Head') {
    scope = ' AND (mt.department = $2 OR mt.requested_by = $3)';
    params.push(req.user.department || '', req.user.name);
  }

  const { rows } = await query(`${SELECT} WHERE mt.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Material transfer not found.', 404);
  res.json(mapMaterialTransfer(rows[0]));
});

// POST /api/material-transfers — Backend-SRS §6.4 step 1 (Pending, no stock change)
const create = asyncHandler(async (req, res) => {
  const { fromStore, toStore, item, qty, date, destinationBin } = req.body;
  if (!fromStore || !toStore || !item || !qty) {
    throw new AppError('fromStore, toStore, item, and qty are required.', 400);
  }

  const result = await withTransaction(async (client) => {
    const fromStoreId = await resolveStoreId(fromStore, client);
    const toStoreId = await resolveStoreId(toStore, client);
    const itemId = await resolveItemId(item, client, fromStoreId);
    if (!itemId) throw new AppError(`Unknown item: "${item}".`, 400);
    const { rows: sourceItems } = await client.query('SELECT id FROM items WHERE id = $1 AND store_id = $2', [itemId, fromStoreId]);
    if (!sourceItems[0]) throw new AppError('The selected item does not belong to the source store.', 400);
    if (fromStoreId === toStoreId) throw new AppError('Source and destination stores must be different.', 400);
    const transferRef = await nextRef(client, 'TRF');

    const { rows } = await client.query(
      `INSERT INTO material_transfers (transfer_ref, from_store_id, to_store_id, item_id, qty, date, status, destination_bin, department, requested_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),'Pending Approval',$7,$8,$9) RETURNING id`,
      [transferRef, fromStoreId, toStoreId, itemId, qty, date || null, destinationBin || null, req.user.department || null, req.user.name]
    );

    await logAudit(client, { userName: req.user.name, action: `Created transfer ${transferRef}`, module: 'Material Transfer' });
    await notify(client, {
      role: 'Property Administration Officer',
      title: 'Store transfer awaiting approval',
      message: `Transfer ${transferRef} from ${fromStore} to ${toStore} is awaiting review.`,
      type: 'info',
      route: `/material-transfers/${rows[0].id}`,
      entityType: 'material-transfer',
      entityId: rows[0].id
    });

    const { rows: full } = await client.query(`${SELECT} WHERE mt.id = $1`, [rows[0].id]);
    return mapMaterialTransfer(full[0]);
  });

  res.status(201).json(result);
});

// POST /api/material-transfers/:id/approve — Backend-SRS §6.4 step 2 (approval decision)
// Approve/Reject/Return only. Dispatch & receive are the store operators' job — see `execute`.
const decide = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected', 'Returned for Correction'].includes(decision)) {
    throw new AppError('decision must be "Approved", "Rejected", or "Returned for Correction".', 400);
  }

  await withTransaction(async (client) => {
    await stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision, actorName: req.user.name });

    // Keep the workflow decision and its handoff notification atomic.
    if (decision === 'Approved' || decision === 'Returned for Correction' || decision === 'Rejected') {
      const { rows } = await client.query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
      const transfer = rows[0];
      await notify(client, {
        role: decision === 'Approved' ? 'Storekeeper' : 'Store Head',
        title: decision === 'Approved' ? 'Transfer Approved' : decision === 'Rejected' ? 'Transfer Rejected' : 'Transfer Returned for Correction',
        message: decision === 'Approved'
          ? `Transfer ${transfer.transfer_ref} (${transfer.from_store_name} -> ${transfer.to_store_name}) is approved and ready to dispatch.`
          : decision === 'Rejected'
            ? `Transfer ${transfer.transfer_ref} was rejected and requires attention before resubmission.`
            : `Transfer ${transfer.transfer_ref} was returned for correction. Update and resubmit it for approval.`,
        type: decision === 'Approved' ? 'success' : decision === 'Rejected' ? 'danger' : 'warning',
        route: `/material-transfers/${req.params.id}`,
        entityType: 'material-transfer',
        entityId: req.params.id
      });
    }
  });

  const { rows } = await query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
  const transfer = rows[0];

  res.json(mapMaterialTransfer(transfer));
});

// POST /api/material-transfers/:id/execute — Backend-SRS §6.4 steps 3-4 (Dispatch / Receive).
// Restricted to the store operators (material-transfers-execute), separate from approval (SoD).
const execute = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!['Dispatched', 'Received'].includes(decision)) {
    throw new AppError('decision must be "Dispatched" or "Received".', 400);
  }

  await withTransaction(async (client) => {
    await stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision, actorName: req.user.name });

    const { rows } = await client.query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
    const transfer = rows[0];
    if (decision === 'Dispatched') {
      await notify(client, {
        role: 'Storekeeper',
        title: 'Transfer Ready to Receive',
        message: `Transfer ${transfer.transfer_ref} has been dispatched from ${transfer.from_store_name} and is ready to receive at ${transfer.to_store_name}.`,
        type: 'info',
        route: '/material-transfer',
        entityType: 'material-transfer',
        entityId: req.params.id
      });
    }
  });

  const { rows } = await query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
  res.json(mapMaterialTransfer(rows[0]));
});

// POST /api/material-transfers/:id/resubmit — re-open a corrected transfer for approval,
// closing the "Returned for Correction" loop so it is never a dead-end (§34).
const resubmit = asyncHandler(async (req, res) => {
  await withTransaction((client) =>
    stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision: 'Pending Approval', actorName: req.user.name })
  );
  const { rows } = await query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
  res.json(mapMaterialTransfer(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows: check } = await query('SELECT status FROM material_transfers WHERE id = $1', [req.params.id]);
  if (!check[0]) throw new AppError('Material transfer not found.', 404);
  if (!['Draft', 'Submitted', 'Pending Approval', 'Returned for Correction'].includes(check[0].status)) throw new AppError('Cannot delete a material transfer that has already been processed.', 400);

  const { rows } = await query('DELETE FROM material_transfers WHERE id = $1 RETURNING transfer_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted transfer ${rows[0].transfer_ref}`, module: 'Material Transfer' });
  res.status(204).send();
});

module.exports = { list, getOne, create, decide, execute, resubmit, remove };
