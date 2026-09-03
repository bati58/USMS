const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapMaterialTransfer, resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord, assertUserCanAccessDepartmentRecord } = require('./_helpers');
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

  if (req.user.role === 'Department Head') {
    scope = 'WHERE mt.requested_by = $1';
    params = [req.user.name];
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE mt.from_store_id = $1 OR mt.to_store_id = $1';
      params = [visibility.assignedStoreId];
    }
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY mt.id DESC`, params);
  res.json(rows.map(mapMaterialTransfer));
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Department Head') {
    scope = ' AND mt.requested_by = $2';
    params.push(req.user.name);
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND (mt.from_store_id = $2 OR mt.to_store_id = $2)';
      params.push(visibility.assignedStoreId);
    } else {
      throw new AppError('You are not assigned to any store scope.', 403);
    }
  }

  const { rows } = await query(`${SELECT} WHERE mt.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Material transfer not found.', 404);

  if (req.user.role === 'Department Head') {
    await assertUserCanAccessDepartmentRecord(req.user, rows[0].department, { query });
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    await assertUserCanAccessStoreRecord(req.user, rows[0].from_store_id, { query });
  }

  res.json(mapMaterialTransfer(rows[0]));
});

// POST /api/material-transfers — Backend-SRS §6.4 step 1 (Pending, no stock change)
const create = asyncHandler(async (req, res) => {
  const { requisitionId, date } = req.body;
  const lines = Array.isArray(req.body.lines)
    ? req.body.lines
    : [{ item: req.body.item, qty: req.body.qty, destinationBin: req.body.destinationBin }];
  if (!requisitionId || !lines.length) {
    throw new AppError('requisitionId and at least one transfer line are required.', 400);
  }
  if (!['Store Head', 'Storekeeper'].includes(req.user.role)) {
    throw new AppError('Only Main Store operators can create material transfers.', 403);
  }

  const result = await withTransaction(async (client) => {
    const visibility = await getUserStoreVisibility(req.user, client);
    const { rows: sourceStores } = await client.query(
      `SELECT id FROM stores WHERE active = TRUE AND type = 'Main Store' AND ($1 = ANY(ARRAY[storekeeper, head_of_store])) LIMIT 1`,
      [req.user.name]
    );
    if (!sourceStores[0] || !visibility.canViewAllStores && visibility.assignedStoreType !== 'Main Store') {
      throw new AppError('Only a Main Store operator can create material transfers.', 403);
    }
    const fromStoreId = sourceStores[0].id;
    const { rows: requests } = await client.query(
      `SELECT r.*, s.type AS destination_type
       FROM requisitions r JOIN stores s ON s.id = r.store_id
       WHERE r.id = $1 FOR UPDATE`,
      [requisitionId]
    );
    const request = requests[0];
    if (!request) throw new AppError('Requisition not found.', 404);
    if (!['Approved', 'Partially Approved'].includes(request.status)) {
      throw new AppError('Only an approved requisition can be converted into a transfer.', 409);
    }
    if (request.destination_type === 'Main Store') {
      throw new AppError('Material transfers can only fulfil Sub-Store requisitions.', 400);
    }
    const { rows: requestLines } = await client.query(
      `SELECT ri.qty, ri.qty_approved, i.id, i.name
       FROM requisition_items ri JOIN items i ON i.id = ri.item_id
       WHERE ri.requisition_id = $1 AND i.store_id = $2`,
      [requisitionId, fromStoreId]
    );
    const toStoreId = request.store_id;
    const selectedItems = new Set();
    const createdTransfers = [];
    for (const line of lines) {
      const itemName = String(line.item || '').trim();
      const destinationBin = String(line.destinationBin || '').trim();
      const quantity = Number(line.qty);
      if (!itemName || !Number.isFinite(quantity) || quantity <= 0 || !destinationBin) {
        throw new AppError('Each transfer line requires an item, positive quantity, and destination bin.', 400);
      }
      if (selectedItems.has(itemName)) throw new AppError(`Item "${itemName}" can only appear once in a transfer request.`, 400);
      selectedItems.add(itemName);

      const requestLine = requestLines.find((lineItem) => lineItem.name === itemName);
      if (!requestLine) throw new AppError(`Item "${itemName}" is not part of the approved requisition from Main Store.`, 400);
      const approvedQty = requestLine.qty_approved == null ? Number(requestLine.qty) : Number(requestLine.qty_approved);
      if (quantity > approvedQty) {
        throw new AppError(`Transfer quantity for "${itemName}" cannot exceed the approved quantity of ${approvedQty}.`, 400);
      }

      const transferRef = await nextRef(client, 'TRF');
      const { rows } = await client.query(
        `INSERT INTO material_transfers (transfer_ref, from_store_id, to_store_id, item_id, qty, date, status, destination_bin, department, requested_by)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),'Pending Approval',$7,$8,$9) RETURNING id`,
        [transferRef, fromStoreId, toStoreId, requestLine.id, quantity, date || null, destinationBin, req.user.department || null, req.user.name]
      );
      await client.query('UPDATE material_transfers SET requisition_id = $1 WHERE id = $2', [requisitionId, rows[0].id]);

      await logAudit(client, { userName: req.user.name, action: `Created transfer ${transferRef}`, module: 'Material Transfer' });
      await notify(client, {
        role: 'Property Administration Officer',
        title: 'Store transfer awaiting approval',
        message: `Transfer ${transferRef} for requisition ${request.sr_ref} is awaiting review.`,
        type: 'info',
        route: '/material-transfer',
        entityType: 'material-transfer',
        entityId: rows[0].id
      });

      const { rows: full } = await client.query(`${SELECT} WHERE mt.id = $1`, [rows[0].id]);
      createdTransfers.push(mapMaterialTransfer(full[0]));
    }
    return createdTransfers;
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
    const { rows: transferRows } = await client.query('SELECT from_store_id FROM material_transfers WHERE id = $1', [req.params.id]);
    const transfer = transferRows[0];
    if (!transfer) throw new AppError('Material transfer not found.', 404);

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
      const assignedStores = Array.isArray(req.user.assignedStores) && req.user.assignedStores.length ? req.user.assignedStores : (req.user.store ? [req.user.store] : []);
      const { rows: userStoreRows } = await client.query('SELECT id FROM stores WHERE name = ANY($1)', [assignedStores]);
      const userStoreId = userStoreRows[0]?.id;
      if (assignedStores.length && !userStoreRows.some((row) => Number(transfer.from_store_id) === Number(row.id))) {
        throw new AppError('You can only act on transfers from one of your assigned stores.', 403);
      }
    }

    await stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision, actorName: req.user.name });

    // Keep the workflow decision and its handoff notification atomic.
    if (decision === 'Approved' || decision === 'Returned for Correction' || decision === 'Rejected') {
      const { rows: transferDetailRows } = await client.query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
      const transferDetail = transferDetailRows[0];
      await notify(client, {
        role: decision === 'Approved' ? 'Storekeeper' : 'Store Head',
        storeId: transferDetail.from_store_id,
        title: decision === 'Approved' ? 'Transfer Approved' : decision === 'Rejected' ? 'Transfer Rejected' : 'Transfer Returned for Correction',
        message: decision === 'Approved'
          ? `Transfer ${transferDetail.transfer_ref} (${transferDetail.from_store_name} -> ${transferDetail.to_store_name}) is approved and ready to dispatch.`
          : decision === 'Rejected'
            ? `Transfer ${transferDetail.transfer_ref} was rejected and requires attention before resubmission.`
            : `Transfer ${transferDetail.transfer_ref} was returned for correction. Update and resubmit it for approval.`,
        type: decision === 'Approved' ? 'success' : decision === 'Rejected' ? 'danger' : 'warning',
        route: '/material-transfer',
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
    const { rows: transferRows } = await client.query('SELECT from_store_id, to_store_id FROM material_transfers WHERE id = $1', [req.params.id]);
    const transfer = transferRows[0];
    if (!transfer) throw new AppError('Material transfer not found.', 404);

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
      const assignedStores = Array.isArray(req.user.assignedStores) && req.user.assignedStores.length ? req.user.assignedStores : (req.user.store ? [req.user.store] : []);
      const { rows: userStoreRows } = await client.query('SELECT id FROM stores WHERE name = ANY($1)', [assignedStores]);
      const requiredStoreId = decision === 'Received' ? transfer.to_store_id : transfer.from_store_id;
      if (assignedStores.length && !userStoreRows.some((row) => Number(requiredStoreId) === Number(row.id))) {
        const actionStore = decision === 'Received' ? 'destination' : 'source';
        throw new AppError(`You can only ${decision === 'Received' ? 'receive transfers at' : 'execute transfers from'} one of your assigned ${actionStore} stores.`, 403);
      }
    }

    await stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision, actorName: req.user.name });

    const { rows: executeTransferRows } = await client.query(`${SELECT} WHERE mt.id = $1`, [req.params.id]);
    const executeTransfer = executeTransferRows[0];
    if (decision === 'Dispatched') {
      await notify(client, {
        role: 'Storekeeper',
        storeId: executeTransfer.from_store_id,
        title: 'Transfer Dispatched',
        message: `Transfer ${executeTransfer.transfer_ref} has been dispatched from ${executeTransfer.from_store_name} to ${executeTransfer.to_store_name}.`,
        type: 'success',
        route: '/material-transfer',
        entityType: 'material-transfer',
        entityId: req.params.id
      });
      await notify(client, {
        role: 'Storekeeper',
        storeId: executeTransfer.to_store_id,
        title: 'Transfer Ready to Receive',
        message: `Transfer ${executeTransfer.transfer_ref} has been dispatched from ${executeTransfer.from_store_name} and is ready to receive at ${executeTransfer.to_store_name}.`,
        type: 'info',
        route: '/material-transfer',
        entityType: 'material-transfer',
        entityId: req.params.id
      });
    }
    if (decision === 'Received') {
      await notify(client, {
        role: 'Storekeeper',
        storeId: executeTransfer.from_store_id,
        title: 'Transfer Received',
        message: `Transfer ${executeTransfer.transfer_ref} has been received at ${executeTransfer.to_store_name}.`,
        type: 'success',
        route: '/material-transfer',
        entityType: 'material-transfer',
        entityId: req.params.id
      });
      await notify(client, {
        role: 'Storekeeper',
        storeId: executeTransfer.to_store_id,
        title: 'Transfer Completed',
        message: `Transfer ${executeTransfer.transfer_ref} has been received and added to ${executeTransfer.to_store_name} stock.`,
        type: 'success',
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
  await withTransaction(async (client) => {
    const { rows: transferRows } = await client.query('SELECT from_store_id FROM material_transfers WHERE id = $1', [req.params.id]);
    const transfer = transferRows[0];
    if (!transfer) throw new AppError('Material transfer not found.', 404);

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
      const assignedStores = Array.isArray(req.user.assignedStores) && req.user.assignedStores.length ? req.user.assignedStores : (req.user.store ? [req.user.store] : []);
      const { rows: userStoreRows } = await client.query('SELECT id FROM stores WHERE name = ANY($1)', [assignedStores]);
      if (assignedStores.length && !userStoreRows.some((row) => Number(transfer.from_store_id) === Number(row.id))) {
        throw new AppError('You can only resubmit transfers from one of your assigned stores.', 403);
      }
    }

    await stockService.decideMaterialTransfer(client, { transferId: req.params.id, decision: 'Pending Approval', actorName: req.user.name });
  });
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
