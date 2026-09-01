const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { assertTransition } = require('../utils/workflow');

// =============================================================================
// This file is the implementation of Backend-SRS.docx Section 6. Every
// function here MUST be called with a transaction client (from
// config/db.js's withTransaction) so a failure partway through never
// leaves items.qty_on_hand, stock_transactions, and bin_cards inconsistent
// with each other.
// =============================================================================

// ---------------------------------------------------------------------------
// §6.6 FIFO valuation
// ---------------------------------------------------------------------------

// Adds a new stock lot (a receipt or a return) for FIFO consumption later.
async function addStockLot(client, { itemId, receivedDate, unitPrice, qty, sourceRef }) {
  await client.query(
    `INSERT INTO stock_lots (item_id, received_date, unit_price, qty_received, qty_remaining, source_ref)
     VALUES ($1, $2, $3, $4, $4, $5)`,
    [itemId, receivedDate, unitPrice, qty, sourceRef]
  );
}

// Consumes `qty` from the oldest available lots first (FIFO). Returns the
// weighted average unit price of what was actually consumed, for recording
// on the stock_transactions row. Throws if there isn't enough stock.
async function consumeFifo(client, itemId, qty) {
  const { rows: lots } = await client.query(
    `SELECT id, unit_price, qty_remaining
     FROM stock_lots
     WHERE item_id = $1 AND qty_remaining > 0
     ORDER BY received_date ASC, id ASC
     FOR UPDATE`,
    [itemId]
  );

  let remainingToConsume = Number(qty);
  let totalCost = 0;
  let totalConsumed = 0;

  for (const lot of lots) {
    if (remainingToConsume <= 0) break;
    const take = Math.min(Number(lot.qty_remaining), remainingToConsume);
    await client.query('UPDATE stock_lots SET qty_remaining = qty_remaining - $1 WHERE id = $2', [
      take,
      lot.id
    ]);
    totalCost += take * Number(lot.unit_price);
    totalConsumed += take;
    remainingToConsume -= take;
  }

  if (remainingToConsume > 0.0001) {
    throw new AppError(
      `Insufficient stock to fulfil this request: short by ${remainingToConsume} unit(s).`,
      400
    );
  }

  return totalConsumed > 0 ? totalCost / totalConsumed : 0;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getItemForUpdate(client, itemId) {
  const { rows } = await client.query('SELECT * FROM items WHERE id = $1 FOR UPDATE', [itemId]);
  if (!rows[0]) throw new AppError(`Item ${itemId} not found.`, 404);
  return rows[0];
}

async function insertStockTransaction(client, { itemId, date, type, ref, qtyIn = 0, qtyOut = 0, unitPrice, balance, actorName = 'System', storeId = null, bin = null, reason = null, sourceType = null, sourceId = null }) {
  await client.query(
    `INSERT INTO stock_transactions (item_id, date, type, ref, qty_in, qty_out, unit_price, balance, actor_name, store_id, bin, reason, source_type, source_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [itemId, date, type, ref, qtyIn, qtyOut, unitPrice, balance, actorName, storeId, bin, reason, sourceType, sourceId]
  );
}

async function upsertBinCard(client, { bin, storeId, itemId, delta, date, reference = 'SYSTEM', type = 'Movement', actorName = 'System', reason = null }) {
  if (!bin) return; // some items may not have a bin assigned yet
  const { rows } = await client.query(
    `INSERT INTO bin_cards (bin, store_id, item_id, last_movement, balance)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (bin, store_id, item_id)
     DO UPDATE SET balance = bin_cards.balance + $5, last_movement = $4
     RETURNING balance`,
    [bin, storeId, itemId, date, delta]
  );
  if (rows[0] && Number(rows[0].balance) < 0) {
    throw new AppError('This movement would take a bin card balance negative.', 400);
  }
  if (rows[0]) {
    await client.query(
      `INSERT INTO bin_card_movements (bin_card_id, item_id, store_id, movement_date, reference, type, qty_in, qty_out, balance, actor_name, reason)
       SELECT id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11 FROM bin_cards WHERE bin = $1 AND store_id = $3 AND item_id = $2`,
      [bin, itemId, storeId, date, reference, type, delta > 0 ? delta : 0, delta < 0 ? Math.abs(delta) : 0, rows[0].balance, actorName, reason]
    );
  }
}

// ---------------------------------------------------------------------------
// §6.1 Goods Receipt approval -> stock increases
// ---------------------------------------------------------------------------

async function recordGoodsReceiptEvaluation(client, { grnId, decision, evaluationNote, findings, condition, evidence, items = [], evaluatedBy, actorName }) {
  const { rows: receiptRows } = await client.query('SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE', [grnId]);
  const receipt = receiptRows[0];
  if (!receipt) throw new AppError('Goods receipt not found.', 404);

  const nextStatus = decision === 'Rejected' ? 'Rejected' : decision === 'Partially Approved' ? 'Partially Accepted' : 'Accepted';
  assertTransition('goodsReceipt', receipt.status, nextStatus);

  const { rows: lines } = await client.query('SELECT gi.*, i.name AS item_name FROM goods_receipt_items gi JOIN items i ON i.id = gi.item_id WHERE gi.goods_receipt_id = $1', [grnId]);
  if (items.length !== lines.length || lines.some((line) => items.filter((entry) => entry.item === line.item_name || String(entry.itemId) === String(line.item_id)).length !== 1)) {
    throw new AppError('Each receipt item must have exactly one valid accepted quantity.', 400);
  }
  if ((decision === 'Approved' || decision === 'Partially Approved') && items.every((entry) => Number(entry.qtyAccepted) <= 0)) {
    throw new AppError('An accepted evaluation must include at least one positive accepted quantity.', 400);
  }
  for (const line of lines) {
    const requested = Number(line.qty);
    const submitted = items.find((entry) => entry.item === line.item_name || String(entry.itemId) === String(line.item_id));
    const acceptedInput = decision === 'Rejected' ? 0 : Number(submitted?.qtyAccepted);
    if (!Number.isFinite(acceptedInput) || acceptedInput < 0 || acceptedInput > requested) {
      throw new AppError(`Accepted quantity for "${line.item_name}" must be between zero and the received quantity.`, 400);
    }
    const accepted = decision === 'Rejected' ? 0 : acceptedInput;
    await client.query('UPDATE goods_receipt_items SET qty_accepted = $1, qty_rejected = $2 WHERE id = $3', [accepted, requested - accepted, line.id]);
  }
  await client.query(
    `UPDATE goods_receipts SET status = $1, evaluation_status = $2, evaluation_date = CURRENT_DATE,
       evaluation_note = $3, evaluation_findings = $4, evaluation_condition = $5,
       evaluation_evidence = $6, evaluated_by = $7, updated_at = NOW() WHERE id = $8`,
    [nextStatus, decision, evaluationNote || null, findings || evaluationNote || null, condition || null, evidence || null, evaluatedBy, grnId]
  );
  await logAudit(client, { userName: actorName, action: `${decision} evaluation for ${receipt.grn_ref}`, module: 'Technical Evaluation', entityType: 'goods_receipt', entityId: grnId, entityReference: receipt.grn_ref });
}

async function generateGrn(client, { grnId, generatedBy, actorName }) {
  const { rows: receiptRows } = await client.query('SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE', [grnId]);
  const receipt = receiptRows[0];
  if (!receipt) throw new AppError('Goods receipt not found.', 404);
  if (!['Accepted', 'Partially Accepted'].includes(receipt.status)) throw new AppError('Only an accepted receipt can generate a GRN.', 409);
  const { rows: existing } = await client.query('SELECT id FROM grns WHERE goods_receipt_id = $1', [grnId]);
  if (existing[0]) throw new AppError('A GRN has already been generated for this receipt.', 409);

  const { nextRef } = require('../utils/refGenerator');
  const grnNumber = await nextRef(client, 'GRN');
  const { rows: grnRows } = await client.query(
    'INSERT INTO grns (grn_number, goods_receipt_id, generated_by) VALUES ($1, $2, $3) RETURNING id',
    [grnNumber, grnId, generatedBy]
  );
  const { rows: lines } = await client.query('SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1', [grnId]);
  if (!lines.some((line) => Number(line.qty_accepted ?? line.qty) > 0)) {
    throw new AppError('Cannot generate a GRN without at least one accepted item quantity.', 409);
  }
  for (const line of lines) {
    const accepted = Number(line.qty_accepted ?? line.qty);
    if (accepted <= 0) continue;
    await client.query('INSERT INTO grn_items (grn_id, item_id, qty, unit_price) VALUES ($1, $2, $3, $4)', [grnRows[0].id, line.item_id, accepted, line.unit_price]);
  }
  await client.query("UPDATE goods_receipts SET status = 'GRN Generated', updated_at = NOW() WHERE id = $1", [grnId]);
  await logAudit(client, { userName: actorName, action: `Generated ${grnNumber}`, module: 'GRN', entityType: 'grn', entityId: grnRows[0].id, entityReference: grnNumber });
}

async function postGrn(client, { grnId, actorName }) {
  const { rows: receiptRows } = await client.query('SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE', [grnId]);
  const receipt = receiptRows[0];
  if (!receipt) throw new AppError('Goods receipt not found.', 404);
  assertTransition('goodsReceipt', receipt.status, 'Posted');
  const { rows: grnRows } = await client.query('SELECT * FROM grns WHERE goods_receipt_id = $1 FOR UPDATE', [grnId]);
  if (!grnRows[0]) throw new AppError('Generate the GRN before posting stock.', 409);
  const { rows: lines } = await client.query('SELECT * FROM grn_items WHERE grn_id = $1', [grnRows[0].id]);
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id);
    const accepted = Number(line.qty);
    const newQty = Number(item.qty_on_hand) + accepted;
    await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE id = $3', [newQty, line.unit_price, item.id]);
    await addStockLot(client, { itemId: item.id, receivedDate: receipt.received_date, unitPrice: line.unit_price, qty: accepted, sourceRef: grnRows[0].grn_number });
    await insertStockTransaction(client, { itemId: item.id, date: receipt.received_date, type: 'Receipt', ref: grnRows[0].grn_number, qtyIn: accepted, unitPrice: line.unit_price, balance: newQty, actorName, storeId: item.store_id, bin: item.bin, sourceType: 'GRN', sourceId: grnRows[0].grn_number });
    await upsertBinCard(client, { bin: item.bin, storeId: item.store_id, itemId: item.id, delta: accepted, date: receipt.received_date, reference: grnRows[0].grn_number, type: 'Receipt', actorName });
  }
  await client.query("UPDATE goods_receipts SET status = 'Posted', updated_at = NOW() WHERE id = $1", [grnId]);
  await logAudit(client, { userName: actorName, action: `Posted ${grnRows[0].grn_number}`, module: 'GRN', entityType: 'grn', entityId: grnRows[0].id, entityReference: grnRows[0].grn_number });
}

// ---------------------------------------------------------------------------
// §6.2 Requisition approval (no stock change) + Issue Voucher (stock decreases)
// ---------------------------------------------------------------------------

async function createPreliminaryIssueVoucher(client, { srRef, issuedBy, actorName }) {
  const { rows: reqRows } = await client.query('SELECT * FROM requisitions WHERE sr_ref = $1 FOR UPDATE', [srRef]);
  const requisition = reqRows[0];
  if (!requisition) throw new AppError('Requisition not found.', 404);
  if (!['Approved', 'Partially Approved', 'Ready for Issue'].includes(requisition.status)) {
    throw new AppError('Only an approved requisition can generate an issue voucher.', 400);
  }

  const { rows: lines } = await client.query(
    'SELECT ri.*, i.name AS item_name FROM requisition_items ri JOIN items i ON i.id = ri.item_id WHERE ri.requisition_id = $1',
    [requisition.id]
  );
  if (!lines.length) throw new AppError('This requisition has no line items.', 400);

  const { nextRef } = require('../utils/refGenerator');
  const sivRef = await nextRef(client, 'SIV');
  const { rows: storeMatch } = await client.query('SELECT id FROM stores WHERE name = $1', [requisition.department]);
  const type = storeMatch.length > 0 ? 'ISIV' : 'SIV';
  const { rows: voucherRows } = await client.query(
    `INSERT INTO issue_vouchers (siv_ref, type, sr_ref, issued_to, issued_by, date, status)
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'Preliminary') RETURNING id`,
    [sivRef, type, srRef, requisition.department, issuedBy]
  );

  for (const line of lines) {
    const issueQty = line.qty_approved == null ? Number(line.qty) : Number(line.qty_approved);
    if (issueQty > 0) {
      await client.query(
        'INSERT INTO issue_voucher_items (issue_voucher_id, item_id, qty, unit_price) VALUES ($1, $2, $3, 0)',
        [voucherRows[0].id, line.item_id, issueQty]
      );
    }
  }
  await logAudit(client, { userName: actorName, action: `Created preliminary ${sivRef}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherRows[0].id, entityReference: sivRef });
  return { id: voucherRows[0].id, sivRef };
}

async function approveIssueVoucher(client, { voucherId, actorName }) {
  const { rows } = await client.query('SELECT * FROM issue_vouchers WHERE id = $1 FOR UPDATE', [voucherId]);
  const voucher = rows[0];
  if (!voucher) throw new AppError('Issue voucher not found.', 404);
  assertTransition('issueVoucher', voucher.status, 'Approved');
  await client.query('UPDATE issue_vouchers SET status = \'Approved\', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2', [actorName, voucherId]);
  await logAudit(client, { userName: actorName, action: `Approved ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref });
}

async function amendIssueVoucher(client, { voucherId, items = [], reason, actorName }) {
  const { rows: voucherRows } = await client.query('SELECT * FROM issue_vouchers WHERE id = $1 FOR UPDATE', [voucherId]);
  const voucher = voucherRows[0];
  if (!voucher) throw new AppError('Issue voucher not found.', 404);
  if (!['Preliminary', 'Pending Approval'].includes(voucher.status)) throw new AppError('Only a preliminary voucher can be amended.', 409);
  if (!Array.isArray(items) || items.length === 0) throw new AppError('At least one amended line is required.', 400);

  for (const entry of items) {
    const qty = Number(entry.qty ?? entry.qtyIssued);
    if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Amended issue quantities must be positive.', 400);
    const { rows: lineRows } = await client.query(
      'SELECT ivi.*, i.name AS item_name FROM issue_voucher_items ivi JOIN items i ON i.id = ivi.item_id WHERE ivi.issue_voucher_id = $1 AND (i.name = $2 OR i.id::text = $3) FOR UPDATE',
      [voucherId, entry.item || '', String(entry.itemId || '')]
    );
    if (!lineRows[0]) throw new AppError(`Voucher line not found for "${entry.item || entry.itemId}".`, 400);
    await client.query('INSERT INTO issue_voucher_amendments (issue_voucher_id, item_id, previous_qty, amended_qty, reason, amended_by) VALUES ($1, $2, $3, $4, $5, $6)', [voucherId, lineRows[0].item_id, lineRows[0].qty, qty, reason || null, actorName]);
    await client.query('UPDATE issue_voucher_items SET qty = $1 WHERE id = $2', [qty, lineRows[0].id]);
  }
  await client.query("UPDATE issue_vouchers SET status = 'Pending Approval', updated_at = NOW() WHERE id = $1", [voucherId]);
  await logAudit(client, { userName: actorName, action: `Amended ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref, metadata: { reason } });
}

async function postIssueVoucher(client, { voucherId, actorName }) {
  const { rows: voucherRows } = await client.query('SELECT * FROM issue_vouchers WHERE id = $1 FOR UPDATE', [voucherId]);
  const voucher = voucherRows[0];
  if (!voucher) throw new AppError('Issue voucher not found.', 404);
  assertTransition('issueVoucher', voucher.status, 'Posted');
  const { rows: lines } = await client.query('SELECT ivi.*, i.name, i.bin, i.store_id, i.unit FROM issue_voucher_items ivi JOIN items i ON i.id = ivi.item_id WHERE ivi.issue_voucher_id = $1', [voucherId]);
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id);
    const issueQty = Number(line.qty);
    if (Number(item.qty_on_hand) < issueQty) throw new AppError(`Not enough stock of "${item.name}" to issue ${issueQty} ${item.unit}(s).`, 400);
    const fifoUnitPrice = await consumeFifo(client, item.id, issueQty);
    const newQty = Number(item.qty_on_hand) - issueQty;
    await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);
    await client.query('UPDATE issue_voucher_items SET unit_price = $1 WHERE id = $2', [fifoUnitPrice, line.id]);
    await insertStockTransaction(client, { itemId: item.id, date: voucher.date, type: 'Issue', ref: voucher.siv_ref, qtyOut: issueQty, unitPrice: fifoUnitPrice, balance: newQty, actorName, storeId: item.store_id, bin: item.bin, sourceType: 'SIV', sourceId: voucher.siv_ref });
    await upsertBinCard(client, { bin: item.bin, storeId: item.store_id, itemId: item.id, delta: -issueQty, date: voucher.date, reference: voucher.siv_ref, type: 'Issue', actorName });
  }
  await client.query("UPDATE issue_vouchers SET status = 'Posted', posted_by = $1, posted_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, voucherId]);
  await client.query("UPDATE requisitions SET status = 'Fulfilled', updated_at = NOW() WHERE sr_ref = $1", [voucher.sr_ref]);
  await logAudit(client, { userName: actorName, action: `Posted ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref });
}

async function decideRequisition(client, { requisitionId, decision, items = [], comments, actorName }) {
  const { rows } = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [requisitionId]);
  const req = rows[0];
  if (!req) throw new AppError('Requisition not found.', 404);
  assertTransition('requisition', req.status, decision);

  await client.query('UPDATE requisitions SET status = $1, updated_at = NOW() WHERE id = $2', [decision, requisitionId]);
  const { rows: requestLines } = await client.query('SELECT ri.*, i.name AS item_name FROM requisition_items ri JOIN items i ON i.id = ri.item_id WHERE ri.requisition_id = $1', [requisitionId]);
  for (const line of requestLines) {
    const submitted = items.find((entry) => entry.item === line.item_name || String(entry.itemId) === String(line.item_id));
    const approvedQty = decision === 'Rejected' ? 0 : Number(submitted?.qtyApproved ?? line.qty);
    if (!Number.isFinite(approvedQty) || approvedQty < 0 || approvedQty > Number(line.qty)) {
      throw new AppError(`Approved quantity for "${line.item_name}" must be between 0 and the requested quantity.`, 400);
    }
    await client.query(
      'UPDATE requisition_items SET qty_approved = $1 WHERE id = $2',
      [approvedQty, line.id]
    );
  }

  await client.query(
    'INSERT INTO requisition_approvals (requisition_id, decision, comments, approved_by) VALUES ($1, $2, $3, $4)',
    [requisitionId, decision, comments || null, actorName]
  );

  await logAudit(client, {
    userName: actorName,
    action: `${decision} requisition ${req.sr_ref}`,
    module: 'Store Requisition'
  });
}


// ---------------------------------------------------------------------------
// §6.3 Material Return approval -> stock increases
// ---------------------------------------------------------------------------

async function decideMaterialReturn(client, { returnId, decision, qtyApproved, findings, recommendation, actorName }) {
  const { rows } = await client.query('SELECT * FROM material_returns WHERE id = $1 FOR UPDATE', [returnId]);
  const ret = rows[0];
  if (!ret) throw new AppError('Material return not found.', 404);
  assertTransition('materialReturn', ret.status, decision);
  await client.query(
    `UPDATE material_returns SET status = $1, qty_approved = $2, evaluated_by = $3,
       evaluated_at = NOW(), evaluation_findings = $4, evaluation_recommendation = $5, updated_at = NOW()
     WHERE id = $6`,
    [decision, decision === 'Approved' ? (qtyApproved == null ? ret.qty : qtyApproved) : 0, actorName, findings || null, recommendation || null, returnId]
  );
  await logAudit(client, { userName: actorName, action: `${decision} return ${ret.srn_ref}`, module: 'Material Return' });
}

async function receiveMaterialReturn(client, { returnId, actorName }) {
  const { rows } = await client.query('SELECT * FROM material_returns WHERE id = $1 FOR UPDATE', [returnId]);
  const ret = rows[0];
  if (!ret) throw new AppError('Material return not found.', 404);
  assertTransition('materialReturn', ret.status, 'Returned to Stock');

  const reusableCondition = ['good', 'usable', 'reusable'].includes(String(ret.condition || '').trim().toLowerCase());

  if (!reusableCondition) {
    throw new AppError('Only good, usable, or reusable returns can be received into stock.', 400);
  }

  if (reusableCondition) {
    const item = await getItemForUpdate(client, ret.item_id);
    const requestedQty = Number(ret.qty);
    const approvedQty = qtyApproved == null ? requestedQty : Number(qtyApproved);
    if (!Number.isFinite(approvedQty) || approvedQty <= 0 || approvedQty > requestedQty) {
      throw new AppError('Approved return quantity must be positive and no greater than the requested quantity.', 400);
    }
    const issuedQuery = `
      SELECT COALESCE(SUM(ivi.qty), 0) AS issued_qty
      FROM issue_voucher_items ivi
      JOIN issue_vouchers iv ON iv.id = ivi.issue_voucher_id
      WHERE ivi.item_id = $1 AND iv.issued_to = $2 AND iv.status IN ('Posted', 'Issued')
        AND ($3::text IS NULL OR iv.siv_ref = $3)
    `;
    const { rows: issuedRows } = await client.query(issuedQuery, [ret.item_id, ret.department, ret.original_issue_ref || null]);
    if (approvedQty > Number(issuedRows[0].issued_qty)) {
      throw new AppError('Returned quantity cannot exceed the quantity previously issued to this department.', 400);
    }
    const newQty = Number(item.qty_on_hand) + approvedQty;

    await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);

    await addStockLot(client, {
      itemId: item.id,
      receivedDate: ret.date,
      unitPrice: item.unit_price, // returns re-enter stock at the item's current cost
      qty: approvedQty,
      sourceRef: ret.srn_ref
    });

    await insertStockTransaction(client, {
      itemId: item.id,
      date: ret.date,
      type: 'Return',
      ref: ret.srn_ref,
      qtyIn: approvedQty,
      unitPrice: item.unit_price,
      balance: newQty
    });

    await upsertBinCard(client, {
      bin: item.bin,
      storeId: item.store_id,
      itemId: item.id,
      delta: approvedQty,
      date: ret.date
    });
  }

  await client.query(
    `UPDATE material_returns SET status = $1, qty_approved = $2, evaluated_by = $3,
       evaluated_at = NOW(), evaluation_findings = $4, evaluation_recommendation = $5, updated_at = NOW()
     WHERE id = $6`,
    ['Returned to Stock', ret.qty_approved == null ? ret.qty : ret.qty_approved, actorName, ret.evaluation_findings || null, ret.evaluation_recommendation || null, returnId]
  );
  await logAudit(client, { userName: actorName, action: `Received return ${ret.srn_ref} into stock`, module: 'Material Return' });
}

// ---------------------------------------------------------------------------
// §6.4 Material Transfer (store-to-store) approval -> dual stock update
// ---------------------------------------------------------------------------

async function decideMaterialTransfer(client, { transferId, decision, actorName }) {
  const { rows } = await client.query('SELECT * FROM material_transfers WHERE id = $1 FOR UPDATE', [transferId]);
  const transfer = rows[0];
  if (!transfer) throw new AppError('Material transfer not found.', 404);
  assertTransition('materialTransfer', transfer.status, decision);

  if (decision === 'Dispatched') {
    const sourceItem = await getItemForUpdate(client, transfer.item_id);
    if (Number(sourceItem.qty_on_hand) < Number(transfer.qty)) {
      throw new AppError('Source store does not have enough stock for this transfer.', 400);
    }

    const fifoUnitPrice = await consumeFifo(client, sourceItem.id, transfer.qty);
    const newSourceQty = Number(sourceItem.qty_on_hand) - Number(transfer.qty);
    await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newSourceQty, sourceItem.id]);

    await insertStockTransaction(client, {
      itemId: sourceItem.id,
      date: transfer.date,
      type: 'Transfer-Out',
      ref: transfer.transfer_ref,
      qtyOut: transfer.qty,
      unitPrice: fifoUnitPrice,
      balance: newSourceQty,
      actorName,
      storeId: sourceItem.store_id,
      bin: sourceItem.bin,
      sourceType: 'Transfer',
      sourceId: transfer.transfer_ref
    });
    await upsertBinCard(client, {
      bin: sourceItem.bin,
      storeId: sourceItem.store_id,
      itemId: sourceItem.id,
      delta: -Number(transfer.qty),
      date: transfer.date,
      reference: transfer.transfer_ref,
      type: 'Transfer-Out',
      actorName
    });
    await client.query('UPDATE material_transfers SET transfer_unit_price = $1 WHERE id = $2', [fifoUnitPrice, transferId]);
  }

  if (decision === 'Received') {
    const { rows: sourceRows } = await client.query('SELECT * FROM items WHERE id = $1', [transfer.item_id]);
    const sourceItem = sourceRows[0];
    if (!sourceItem) throw new AppError('Source item for this transfer was not found.', 404);

    // Find (or create) the matching item row in the destination store, by code.
    let { rows: destRows } = await client.query(
      'SELECT * FROM items WHERE code = $1 AND store_id = $2 FOR UPDATE',
      [sourceItem.code, transfer.to_store_id]
    );
    let destItem = destRows[0];

    if (!destItem) {
      const { rows: created } = await client.query(
        `INSERT INTO items (code, name, category_id, store_id, bin, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10) RETURNING *`,
        [
          sourceItem.code, sourceItem.name, sourceItem.category_id, transfer.to_store_id, transfer.destination_bin || null,
          sourceItem.unit, sourceItem.min_level, sourceItem.max_level, sourceItem.reorder_level, sourceItem.unit_price
        ]
      );
      destItem = created[0];
    }

    const transferUnitPrice = transfer.transfer_unit_price == null ? Number(sourceItem.unit_price) : Number(transfer.transfer_unit_price);
    const destinationBin = transfer.destination_bin || destItem.bin;
    const newDestQty = Number(destItem.qty_on_hand) + Number(transfer.qty);
    await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, bin = COALESCE($3, bin), updated_at = NOW() WHERE id = $4', [
      newDestQty,
      transferUnitPrice,
      destinationBin,
      destItem.id
    ]);

    await addStockLot(client, {
      itemId: destItem.id,
      receivedDate: transfer.date,
      unitPrice: transferUnitPrice,
      qty: transfer.qty,
      sourceRef: transfer.transfer_ref
    });

    await insertStockTransaction(client, {
      itemId: destItem.id,
      date: transfer.date,
      type: 'Transfer-In',
      ref: transfer.transfer_ref,
      qtyIn: transfer.qty,
      unitPrice: transferUnitPrice,
      balance: newDestQty,
      actorName,
      storeId: destItem.store_id,
      bin: destinationBin,
      sourceType: 'Transfer',
      sourceId: transfer.transfer_ref
    });
    await upsertBinCard(client, {
      bin: destinationBin,
      storeId: destItem.store_id,
      itemId: destItem.id,
      delta: Number(transfer.qty),
      date: transfer.date,
      reference: transfer.transfer_ref,
      type: 'Transfer-In',
      actorName
    });
  }

  const nextStatus = decision === 'Received' ? 'Completed' : decision;
  const statusFields = decision === 'Dispatched'
    ? ", dispatched_by = $2, dispatched_at = NOW()"
    : decision === 'Received' ? ", received_by = $2, received_at = NOW()" : '';
  const statusParams = decision === 'Dispatched' || decision === 'Received'
    ? [nextStatus, actorName, transferId]
    : [nextStatus, transferId];
  if (statusFields) {
    await client.query(`UPDATE material_transfers SET status = $1${statusFields}, updated_at = NOW() WHERE id = $3`, statusParams);
  } else {
    await client.query('UPDATE material_transfers SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, transferId]);
  }
  await logAudit(client, {
    userName: actorName,
    action: `${decision} transfer ${transfer.transfer_ref}`,
    module: 'Material Transfer'
  });
}

// ---------------------------------------------------------------------------
// §6.5 Bin Transfer (within one store) -> immediate bin_cards update
// ---------------------------------------------------------------------------

async function createBinTransfer(client, { itemId, fromBin, toBin, qty, transferredBy, actorName }) {
  const item = await getItemForUpdate(client, itemId);
  if (fromBin === toBin) throw new AppError('Source and destination bins must be different.', 400);
  if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) throw new AppError('Bin transfer quantity must be positive.', 400);

  const { rows: sourceBin } = await client.query('SELECT balance FROM bin_cards WHERE bin = $1 AND store_id = $2 AND item_id = $3 FOR UPDATE', [fromBin, item.store_id, item.id]);
  if (!sourceBin[0] || Number(sourceBin[0].balance) < Number(qty)) throw new AppError('Source bin does not have enough stock for this transfer.', 400);
  const transferDate = new Date();
  const { nextRef } = require('../utils/refGenerator');
  const transferRef = await nextRef(client, 'BTR');
  await upsertBinCard(client, { bin: fromBin, storeId: item.store_id, itemId: item.id, delta: -Number(qty), date: transferDate, reference: transferRef, type: 'Transfer-Out', actorName });
  await upsertBinCard(client, { bin: toBin, storeId: item.store_id, itemId: item.id, delta: Number(qty), date: transferDate, reference: transferRef, type: 'Transfer-In', actorName });

  const { rows } = await client.query(
    `INSERT INTO bin_transfers (item_id, from_bin, to_bin, qty, date, transferred_by)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, $5) RETURNING *`,
    [itemId, fromBin, toBin, qty, transferredBy]
  );

  await logAudit(client, {
    userName: actorName,
    action: `Transferred ${qty} unit(s) of item ${item.code} from ${fromBin} to ${toBin}`,
    module: 'Stock Transfer'
  });

  return rows[0];
}

async function approveStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  if (session.status !== 'Submitted') throw new AppError(`Only a submitted stock-taking session can be approved; current status is ${session.status}.`, 409);
  await client.query("UPDATE stock_taking_sessions SET status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, sessionId]);
  await logAudit(client, { userName: actorName, action: `Approved stock-taking ${session.session_ref}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: sessionId, entityReference: session.session_ref });
}

async function postStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  if (session.status !== 'Approved') throw new AppError(`Only an approved stock-taking session can be posted; current status is ${session.status}.`, 409);
  const { rows: lines } = await client.query('SELECT sti.*, i.name, i.bin, i.store_id, i.unit_price FROM stock_taking_items sti JOIN items i ON i.id = sti.item_id WHERE sti.session_id = $1 FOR UPDATE', [sessionId]);
  const { nextRef } = require('../utils/refGenerator');
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id);
    const countedQty = line.recount_physical_qty == null ? Number(line.physical_qty) : Number(line.recount_physical_qty);
    const variance = countedQty - Number(item.qty_on_hand);
    if (Math.abs(variance) < 0.0001) continue;
    if (!line.reason) throw new AppError(`A reason is required for the variance on "${line.name}".`, 400);
    const reference = session.session_ref;
    if (variance > 0) {
      await addStockLot(client, { itemId: item.id, receivedDate: session.count_date, unitPrice: item.unit_price, qty: variance, sourceRef: reference });
    } else {
      await consumeFifo(client, item.id, Math.abs(variance));
    }
    const newQty = Number(item.qty_on_hand) + variance;
    await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);
    await insertStockTransaction(client, { itemId: item.id, date: session.count_date, type: 'Adjustment', ref: reference, qtyIn: variance > 0 ? variance : 0, qtyOut: variance < 0 ? Math.abs(variance) : 0, unitPrice: item.unit_price, balance: newQty, actorName, storeId: item.store_id, bin: line.bin || item.bin, reason: line.reason, sourceType: 'Stock Taking', sourceId: String(sessionId) });
    await upsertBinCard(client, { bin: line.bin || item.bin, storeId: item.store_id, itemId: item.id, delta: variance, date: session.count_date, reference, type: 'Adjustment', actorName, reason: line.reason });
    await client.query('UPDATE stock_taking_items SET adjustment_ref = $1 WHERE id = $2', [reference, line.id]);
  }
  await client.query("UPDATE stock_taking_sessions SET status = 'Closed', closed_by = $1, closed_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, sessionId]);
  await logAudit(client, { userName: actorName, action: `Posted stock-taking ${session.session_ref}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: sessionId, entityReference: session.session_ref });
}

// ---------------------------------------------------------------------------
// §6.7 Disposal approval -> stock decreases
// ---------------------------------------------------------------------------

async function decideDisposal(client, { disposalId, decision, actorName }) {
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [disposalId]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  assertTransition('disposal', disposal.status, decision === 'Approved' ? 'Approved' : 'Rejected');

  await client.query('UPDATE disposals SET status = $1, updated_at = NOW() WHERE id = $2', [decision, disposalId]);
  await logAudit(client, { userName: actorName, action: `${decision} disposal ${disposal.disposal_ref}`, module: 'Disposal Management' });
}

async function executeDisposal(client, { disposalId, actorName }) {
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [disposalId]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  assertTransition('disposal', disposal.status, 'Executed');

  const item = await getItemForUpdate(client, disposal.item_id);
  if (Number(item.qty_on_hand) < Number(disposal.qty)) {
    throw new AppError('Not enough stock on hand to dispose of this quantity.', 400);
  }

  const fifoUnitPrice = await consumeFifo(client, item.id, disposal.qty);
  const newQty = Number(item.qty_on_hand) - Number(disposal.qty);
  await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);

  await insertStockTransaction(client, {
    itemId: item.id,
    date: disposal.date_flagged,
    type: 'Disposal',
    ref: disposal.disposal_ref,
    qtyOut: disposal.qty,
    unitPrice: fifoUnitPrice,
    balance: newQty,
    actorName,
    storeId: item.store_id,
    bin: item.bin,
    sourceType: 'Disposal',
    sourceId: disposal.disposal_ref
  });

  await upsertBinCard(client, {
    bin: item.bin,
    storeId: item.store_id,
    itemId: item.id,
    delta: -Number(disposal.qty),
    date: disposal.date_flagged,
    reference: disposal.disposal_ref,
    type: 'Disposal',
    actorName
  });

  await client.query("UPDATE disposals SET status = 'Executed', updated_at = NOW() WHERE id = $1", [disposalId]);
  await logAudit(client, { userName: actorName, action: `Executed disposal ${disposal.disposal_ref}`, module: 'Disposal Management' });
}

module.exports = {
  createPreliminaryIssueVoucher,
  approveIssueVoucher,
  amendIssueVoucher,
  postIssueVoucher,
  recordGoodsReceiptEvaluation,
  generateGrn,
  postGrn,
  decideRequisition,

  decideMaterialReturn,
  receiveMaterialReturn,
  decideMaterialTransfer,
  createBinTransfer,
  approveStockTaking,
  postStockTaking,
  decideDisposal,
  executeDisposal
};
