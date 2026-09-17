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
async function addStockLot(client, { itemId, storeId = null, receivedDate, unitPrice, qty, sourceRef }) {
  await client.query(
    `INSERT INTO stock_lots (item_id, store_id, received_date, unit_price, qty_received, qty_remaining, source_ref)
     VALUES ($1, $2, $3, $4, $5, $5, $6)`,
    [itemId, storeId, receivedDate, unitPrice, qty, sourceRef]
  );
}

// Consumes `qty` from the oldest available lots first (FIFO). Returns the
// weighted average unit price of what was actually consumed, for recording
// on the stock_transactions row. Throws if there isn't enough stock.
async function consumeFifo(client, itemId, qty, storeId = null) {
  const storeClause = storeId == null ? '' : ' AND sl.store_id = $2';
  const itemParams = storeId == null ? [itemId] : [itemId, storeId];
  const inventorySelect = storeId == null
    ? 'i.qty_on_hand, i.unit_price'
    : 'COALESCE(ii.qty_on_hand, i.qty_on_hand) AS qty_on_hand, COALESCE(ii.unit_price, i.unit_price) AS unit_price';
  const inventoryJoin = storeId == null
    ? ''
    : ' LEFT JOIN item_inventory ii ON ii.item_id = i.id AND ii.store_id = $2';
  const { rows: itemRows } = await client.query(
    `SELECT ${inventorySelect},
            COALESCE(SUM(sl.qty_remaining), 0) AS fifo_remaining
     FROM items i
     ${inventoryJoin}
     LEFT JOIN stock_lots sl ON sl.item_id = i.id AND sl.qty_remaining > 0${storeClause}
     WHERE i.id = $1
     GROUP BY i.id${storeId == null ? '' : ', ii.qty_on_hand, ii.unit_price'}`,
    itemParams
  );
  const item = itemRows[0];
  const untrackedQty = Math.max(0, Number(item?.qty_on_hand || 0) - Number(item?.fifo_remaining || 0));
  if (untrackedQty > 0.0001) {
    await addStockLot(client, {
      itemId,
      storeId,
      receivedDate: new Date(),
      unitPrice: Number(item.unit_price || 0),
      qty: untrackedQty,
      sourceRef: 'SYSTEM-QUANTITY-ADJUSTMENT'
    });
  }

  const { rows: lots } = await client.query(
    `SELECT id, unit_price, qty_remaining
     FROM stock_lots sl
     WHERE item_id = $1 AND qty_remaining > 0${storeClause}
     ORDER BY received_date ASC, id ASC
     FOR UPDATE`,
    itemParams
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

async function getItemForUpdate(client, itemId, storeId = null) {
  const { rows } = await client.query(
    storeId == null
      ? 'SELECT * FROM items WHERE id = $1 FOR UPDATE'
      : `SELECT i.*, ii.qty_on_hand AS inventory_qty_on_hand, ii.bin AS inventory_bin,
                ii.location_id AS inventory_location_id, ii.unit_price AS inventory_unit_price
         FROM items i JOIN item_inventory ii ON ii.item_id = i.id AND ii.store_id = $2
         WHERE i.id = $1 FOR UPDATE OF ii`,
    storeId == null ? [itemId] : [itemId, storeId]
  );
  if (!rows[0]) throw new AppError(`Item ${itemId} not found.`, 404);
  if (storeId != null) {
    rows[0].qty_on_hand = rows[0].inventory_qty_on_hand;
    rows[0].bin = rows[0].inventory_bin;
    rows[0].location_id = rows[0].inventory_location_id;
    rows[0].unit_price = rows[0].inventory_unit_price;
    rows[0].store_id = storeId;
  }
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

async function ensureSourceBinCard(client, { bin, storeId, itemId, balance, date }) {
  if (!bin) return;
  const { rows } = await client.query(
    'SELECT id, balance FROM bin_cards WHERE bin = $1 AND store_id = $2 AND item_id = $3 FOR UPDATE',
    [bin, storeId, itemId]
  );
  if (rows[0]) return;
  await client.query(
    `INSERT INTO bin_cards (bin, store_id, item_id, last_movement, balance)
     VALUES ($1, $2, $3, $4, $5)`,
    [bin, storeId, itemId, date, balance]
  );
}

// ---------------------------------------------------------------------------
// §6.1 Goods Receipt approval -> stock increases
// ---------------------------------------------------------------------------

async function recordGoodsReceiptEvaluation(client, { grnId, decision, evaluationNote, findings, condition, evidence, items = [], evaluatedBy, actorName, actorRole }) {
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
  await logAudit(client, {
    userName: actorName,
    userRole: actorRole,
    action: `${decision} evaluation for ${receipt.grn_ref}`,
    module: 'Technical Evaluation',
    entityType: 'goods_receipt',
    entityId: grnId,
    entityReference: receipt.grn_ref,
    beforeData: { status: receipt.status },
    afterData: { status: nextStatus, evaluationStatus: decision }
  });
}

async function generateGrn(client, { grnId, generatedBy, actorName, actorRole }) {
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
  await logAudit(client, {
    userName: actorName,
    userRole: actorRole,
    action: `Generated ${grnNumber}`,
    module: 'GRN',
    entityType: 'grn',
    entityId: grnRows[0].id,
    entityReference: grnNumber,
    beforeData: { status: receipt.status },
    afterData: { status: 'GRN Generated' }
  });
}

async function postGrn(client, { grnId, actorName, actorRole }) {
  const { rows: receiptRows } = await client.query('SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE', [grnId]);
  const receipt = receiptRows[0];
  if (!receipt) throw new AppError('Goods receipt not found.', 404);
  assertTransition('goodsReceipt', receipt.status, 'Posted');
  const { rows: grnRows } = await client.query('SELECT * FROM grns WHERE goods_receipt_id = $1 FOR UPDATE', [grnId]);
  if (!grnRows[0]) throw new AppError('Generate the GRN before posting stock.', 409);
  const { rows: lines } = await client.query('SELECT * FROM grn_items WHERE grn_id = $1', [grnRows[0].id]);
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id, receipt.store_id);
    const accepted = Number(line.qty);
    const newQty = Number(item.qty_on_hand) + accepted;
    await client.query('UPDATE item_inventory SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE item_id = $3 AND store_id = $4', [newQty, line.unit_price, item.id, receipt.store_id]);
    if (Number(item.store_id) === Number(receipt.store_id)) {
      await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE id = $3', [newQty, line.unit_price, item.id]);
    }
    await addStockLot(client, { itemId: item.id, storeId: receipt.store_id, receivedDate: receipt.received_date, unitPrice: line.unit_price, qty: accepted, sourceRef: grnRows[0].grn_number });
    await insertStockTransaction(client, { itemId: item.id, date: receipt.received_date, type: 'Receipt', ref: grnRows[0].grn_number, qtyIn: accepted, unitPrice: line.unit_price, balance: newQty, actorName, storeId: receipt.store_id, bin: item.bin, sourceType: 'GRN', sourceId: grnRows[0].grn_number });
    await upsertBinCard(client, { bin: item.bin, storeId: receipt.store_id, itemId: item.id, delta: accepted, date: receipt.received_date, reference: grnRows[0].grn_number, type: 'Receipt', actorName });
  }
  await client.query("UPDATE goods_receipts SET status = 'Posted', updated_at = NOW() WHERE id = $1", [grnId]);
  await logAudit(client, {
    userName: actorName,
    userRole: actorRole,
    action: `Posted ${grnRows[0].grn_number}`,
    module: 'GRN',
    entityType: 'grn',
    entityId: grnRows[0].id,
    entityReference: grnRows[0].grn_number,
    beforeData: { status: receipt.status },
    afterData: { status: 'Posted' }
  });
}

// ---------------------------------------------------------------------------
// §6.2 Requisition approval (no stock change) + Issue Voucher (stock decreases)
// ---------------------------------------------------------------------------

async function createPreliminaryIssueVoucher(client, { srRef, items = null, issuedBy, actorName, actorRole }) {
  const { rows: reqRows } = await client.query(
    `SELECT r.*, s.type AS destination_store_type, s.name AS destination_store_name, requester.role AS requester_role
     FROM requisitions r
     JOIN stores s ON s.id = r.store_id
     LEFT JOIN users requester ON requester.name = r.requested_by AND requester.active = TRUE
    WHERE r.sr_ref = $1 FOR UPDATE OF r`,
    [srRef]
  );
  const requisition = reqRows[0];
  if (!requisition) throw new AppError('Requisition not found.', 404);
  if (requisition.requester_role === 'Storekeeper') {
    throw new AppError(
      `Requisition ${srRef} was created by a Storekeeper. Fulfil it through Material Transfer, not an Issue Voucher.`,
      409
    );
  }
  if (!['Approved', 'Partially Approved', 'Ready for Issue'].includes(requisition.status)) {
    throw new AppError('Only an approved requisition can generate an issue voucher.', 400);
  }

  const { rows: lines } = await client.query(
    'SELECT ri.*, i.name AS item_name FROM requisition_items ri JOIN items i ON i.id = ri.item_id WHERE ri.requisition_id = $1',
    [requisition.id]
  );
  if (Array.isArray(items) && items.length !== lines.length) {
    throw new AppError('Issue quantities must be provided exactly once for every approved requisition line.', 400);
  }
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
    const requestedLine = Array.isArray(items)
      ? items.find((entry) => entry.item === line.item_name || String(entry.itemId) === String(line.item_id))
      : null;
    if (Array.isArray(items) && !requestedLine) throw new AppError(`Issue quantity is missing for "${line.item_name}".`, 400);
    const issueQty = requestedLine ? Number(requestedLine.qtyIssued ?? requestedLine.qty) : (line.qty_approved == null ? Number(line.qty) : Number(line.qty_approved));
    const approvedQty = line.qty_approved == null ? Number(line.qty) : Number(line.qty_approved);
    if (!Number.isFinite(issueQty) || issueQty <= 0 || issueQty > approvedQty) {
      throw new AppError(`Issue quantity for "${line.item_name}" must be greater than zero and no more than the approved quantity (${approvedQty}).`, 400);
    }
    const { rows: stockRows } = await client.query(
      'SELECT qty_on_hand FROM item_inventory WHERE item_id = $1 AND store_id = $2',
      [line.item_id, requisition.issuing_store_id || requisition.store_id]
    );
    if (Number(stockRows[0]?.qty_on_hand || 0) < issueQty) {
      throw new AppError(`Insufficient stock for "${line.item_name}". Available: ${stockRows[0]?.qty_on_hand || 0}; requested: ${issueQty}.`, 400);
    }
    if (issueQty > 0) {
      await client.query(
        'INSERT INTO issue_voucher_items (issue_voucher_id, item_id, qty, unit_price) VALUES ($1, $2, $3, 0)',
        [voucherRows[0].id, line.item_id, issueQty]
      );
    }
  }
  await logAudit(client, { userName: actorName, userRole: actorRole, action: `Created preliminary ${sivRef}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherRows[0].id, entityReference: sivRef, afterData: { status: 'Preliminary' } });
  return { id: voucherRows[0].id, sivRef };
}

async function approveIssueVoucher(client, { voucherId, actorName, actorRole }) {
  const { rows } = await client.query('SELECT * FROM issue_vouchers WHERE id = $1 FOR UPDATE', [voucherId]);
  const voucher = rows[0];
  if (!voucher) throw new AppError('Issue voucher not found.', 404);
  assertTransition('issueVoucher', voucher.status, 'Approved');
  await client.query('UPDATE issue_vouchers SET status = \'Approved\', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2', [actorName, voucherId]);
  await logAudit(client, { userName: actorName, userRole: actorRole, action: `Approved ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref, beforeData: { status: voucher.status }, afterData: { status: 'Approved' } });
}

async function amendIssueVoucher(client, { voucherId, items = [], reason, actorName, actorRole }) {
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
    if (qty > Number(lineRows[0].qty)) throw new AppError(`Amended quantity for "${lineRows[0].item_name}" cannot exceed the approved quantity (${lineRows[0].qty}).`, 400);
    await client.query('INSERT INTO issue_voucher_amendments (issue_voucher_id, item_id, previous_qty, amended_qty, reason, amended_by) VALUES ($1, $2, $3, $4, $5, $6)', [voucherId, lineRows[0].item_id, lineRows[0].qty, qty, reason || null, actorName]);
    await client.query('UPDATE issue_voucher_items SET qty = $1 WHERE id = $2', [qty, lineRows[0].id]);
  }
  await client.query("UPDATE issue_vouchers SET status = 'Pending Approval', updated_at = NOW() WHERE id = $1", [voucherId]);
  await logAudit(client, { userName: actorName, userRole: actorRole, action: `Amended ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref, beforeData: { status: voucher.status }, afterData: { status: 'Pending Approval' }, metadata: { reason } });
}

async function postIssueVoucher(client, { voucherId, actorName, actorRole }) {
  const { rows: voucherRows } = await client.query(
    `SELECT iv.*, r.issuing_store_id, r.store_id AS requisition_store_id
     FROM issue_vouchers iv
     LEFT JOIN requisitions r ON r.sr_ref = iv.sr_ref
     WHERE iv.id = $1 FOR UPDATE OF iv`,
    [voucherId]
  );
  const voucher = voucherRows[0];
  if (!voucher) throw new AppError('Issue voucher not found.', 404);
  assertTransition('issueVoucher', voucher.status, 'Posted');
  const issuingStoreId = voucher.issuing_store_id || voucher.requisition_store_id;
  if (!issuingStoreId) throw new AppError('The issuing store could not be resolved for this voucher.', 409);
  const { rows: lines } = await client.query('SELECT ivi.*, i.name, i.bin, i.store_id, i.unit FROM issue_voucher_items ivi JOIN items i ON i.id = ivi.item_id WHERE ivi.issue_voucher_id = $1', [voucherId]);
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id, issuingStoreId);
    const issueQty = Number(line.qty);
    if (Number(item.qty_on_hand) < issueQty) throw new AppError(`Not enough stock of "${item.name}" to issue ${issueQty} ${item.unit}(s).`, 400);
    const fifoUnitPrice = await consumeFifo(client, item.id, issueQty, issuingStoreId);
    const newQty = Number(item.qty_on_hand) - issueQty;
    await client.query(
      'UPDATE item_inventory SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE item_id = $3 AND store_id = $4',
      [newQty, fifoUnitPrice, item.id, issuingStoreId]
    );
    if (Number(item.store_id) === Number(issuingStoreId)) {
      await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE id = $3', [newQty, fifoUnitPrice, item.id]);
    }
    await client.query('UPDATE issue_voucher_items SET unit_price = $1 WHERE id = $2', [fifoUnitPrice, line.id]);
    await insertStockTransaction(client, { itemId: item.id, date: voucher.date, type: 'Issue', ref: voucher.siv_ref, qtyOut: issueQty, unitPrice: fifoUnitPrice, balance: newQty, actorName, storeId: issuingStoreId, bin: item.bin, sourceType: 'SIV', sourceId: voucher.siv_ref });
    await upsertBinCard(client, { bin: item.bin, storeId: issuingStoreId, itemId: item.id, delta: -issueQty, date: voucher.date, reference: voucher.siv_ref, type: 'Issue', actorName });
  }
  await client.query("UPDATE issue_vouchers SET status = 'Posted', posted_by = $1, posted_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, voucherId]);
  await client.query("UPDATE requisitions SET status = 'Fulfilled', updated_at = NOW() WHERE sr_ref = $1", [voucher.sr_ref]);
  await logAudit(client, { userName: actorName, userRole: actorRole, action: `Posted ${voucher.siv_ref}`, module: 'Issue Voucher', entityType: 'issue_voucher', entityId: voucherId, entityReference: voucher.siv_ref, beforeData: { status: voucher.status }, afterData: { status: 'Posted' } });
}

async function decideRequisition(client, { requisitionId, decision, items = [], comments, actorName, actorRole }) {
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
    userRole: actorRole,
    action: `${decision} requisition ${req.sr_ref}`,
    module: 'Store Requisition',
    entityType: 'requisition',
    entityId: requisitionId,
    entityReference: req.sr_ref,
    beforeData: { status: req.status },
    afterData: { status: decision },
    metadata: comments ? { comments } : {}
  });
}

// Department-Head endorsement — two-stage approval, stage 1. Forwards a Submitted
// requisition to the PAO for final approval (Submitted -> Pending Approval). It records
// ONLY to audit_logs: a requisition_approvals row is written only for a decision in the
// schema CHECK set (Approved/Partially Approved/Rejected/Returned for Correction), which
// for this stage happens on reject/return via decideRequisition — never for the endorse.
async function endorseRequisition(client, { requisitionId, comments, actorName, actorRole }) {
  const { rows } = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [requisitionId]);
  const req = rows[0];
  if (!req) throw new AppError('Requisition not found.', 404);
  assertTransition('requisition', req.status, 'Pending Approval');
  await client.query("UPDATE requisitions SET status = 'Pending Approval', updated_at = NOW() WHERE id = $1", [requisitionId]);
  await logAudit(client, {
    userName: actorName,
    userRole: actorRole,
    action: `Endorsed requisition ${req.sr_ref} — forwarded to Property Administration Officer`,
    module: 'Store Requisition',
    entityType: 'requisition',
    entityId: String(requisitionId),
    entityReference: req.sr_ref,
    beforeData: { status: req.status },
    afterData: { status: 'Pending Approval' },
    metadata: comments ? { comments } : {}
  });
  return req;
}


// ---------------------------------------------------------------------------
// §6.3 Material Return approval -> stock increases
// ---------------------------------------------------------------------------

async function decideMaterialReturn(client, { returnId, decision, qtyApproved, findings, recommendation, reason, actorName }) {
  const { rows } = await client.query('SELECT * FROM material_returns WHERE id = $1 FOR UPDATE', [returnId]);
  const ret = rows[0];
  if (!ret) throw new AppError('Material return not found.', 404);

  if (decision === 'Submitted') {
    if (!['Returned for Correction'].includes(ret.status)) {
      throw new AppError('Only a return sent for correction can be resubmitted.', 409);
    }
    await client.query(
      `UPDATE material_returns SET status = 'Submitted', evaluated_by = $1, evaluated_at = NOW(),
       evaluation_findings = $2, evaluation_recommendation = $3, updated_at = NOW()
       WHERE id = $4`,
      [actorName, findings || null, recommendation || null, returnId]
    );
    await logAudit(client, { userName: actorName, action: `Resubmitted return ${ret.srn_ref}`, module: 'Material Return' });
    return;
  }

  const nextStatus = decision === 'Approved' ? 'Approved' : decision === 'Returned for Correction' ? 'Returned for Correction' : 'Rejected';
  assertTransition('materialReturn', ret.status, nextStatus);

  const approvedQty = decision === 'Approved' ? (qtyApproved == null ? Number(ret.qty) : Number(qtyApproved)) : 0;
  if (decision === 'Approved' && (!Number.isFinite(approvedQty) || approvedQty <= 0 || approvedQty > Number(ret.qty))) {
    throw new AppError('Approved return quantity must be a valid positive amount not exceeding the requested quantity.', 400);
  }
  if (decision === 'Rejected' && !reason) {
    throw new AppError('A rejection reason is required.', 400);
  }
  if (decision === 'Returned for Correction' && !reason) {
    throw new AppError('A correction reason is required.', 400);
  }

  await client.query(
    `UPDATE material_returns SET status = $1, qty_approved = $2, evaluated_by = $3,
       evaluated_at = NOW(), evaluation_findings = $4, evaluation_recommendation = $5,
       rejection_reason = $6, updated_at = NOW()
     WHERE id = $7`,
    [nextStatus, decision === 'Approved' ? approvedQty : 0, actorName, findings || null, recommendation || null, decision === 'Rejected' || decision === 'Returned for Correction' ? (reason || null) : null, returnId]
  );
  await logAudit(client, { userName: actorName, action: `${decision} return ${ret.srn_ref}`, module: 'Material Return' });
}

async function receiveMaterialReturn(client, { returnId, actualQty, acceptedQty, rejectedQty, condition, remarks, rejectionReason, actorName }) {
  const { rows } = await client.query('SELECT * FROM material_returns WHERE id = $1 FOR UPDATE', [returnId]);
  const ret = rows[0];
  if (!ret) throw new AppError('Material return not found.', 404);

  const approvedQty = Number(ret.qty_approved ?? ret.qty ?? 0);
  if (!Number.isFinite(approvedQty) || approvedQty <= 0) {
    throw new AppError('This return has not yet been approved for receiving.', 400);
  }

  const actualReceived = actualQty == null ? approvedQty : Number(actualQty);
  const accepted = acceptedQty == null ? actualReceived : Number(acceptedQty);
  const rejected = rejectedQty == null ? Math.max(0, actualReceived - accepted) : Number(rejectedQty);

  if (!Number.isFinite(actualReceived) || actualReceived < 0 || actualReceived > approvedQty) {
    throw new AppError('Received quantity cannot exceed the approved quantity.', 400);
  }
  if (!Number.isFinite(accepted) || accepted < 0 || accepted > actualReceived) {
    throw new AppError('Accepted quantity cannot exceed the actual received quantity.', 400);
  }
  if (!Number.isFinite(rejected) || rejected < 0 || rejected > actualReceived) {
    throw new AppError('Rejected quantity cannot exceed the actual received quantity.', 400);
  }
  if (Math.abs((accepted + rejected) - actualReceived) > 0.0001) {
    throw new AppError('Accepted and rejected quantities must total the actual received quantity.', 400);
  }

  const nextStatus = accepted <= 0 ? 'Return Rejected' : rejected > 0 && accepted > 0 ? 'Partially Accepted' : 'Fully Accepted';
  assertTransition('materialReturn', ret.status, 'Under Receiving');

  const returnStoreId = ret.store_id || null;
  const item = await getItemForUpdate(client, ret.item_id, returnStoreId);
  const newQty = Number(item.qty_on_hand) + accepted;

  if (accepted > 0) {
    if (returnStoreId) {
      await client.query('UPDATE item_inventory SET qty_on_hand = $1, updated_at = NOW() WHERE item_id = $2 AND store_id = $3', [newQty, item.id, returnStoreId]);
    }
    if (!returnStoreId || Number(item.store_id) === Number(returnStoreId)) {
      await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);
    }
    await addStockLot(client, {
      itemId: item.id,
      storeId: returnStoreId,
      receivedDate: ret.date,
      unitPrice: item.unit_price,
      qty: accepted,
      sourceRef: ret.srn_ref
    });
    await insertStockTransaction(client, {
      itemId: item.id,
      date: ret.date,
      type: 'Return',
      ref: ret.srn_ref,
      qtyIn: accepted,
      unitPrice: item.unit_price,
      balance: newQty,
      actorName,
      storeId: returnStoreId || item.store_id,
      bin: item.bin,
      sourceType: 'Material Return',
      sourceId: ret.srn_ref
    });
    await upsertBinCard(client, {
      bin: item.bin,
      storeId: returnStoreId || item.store_id,
      itemId: item.id,
      delta: accepted,
      date: ret.date,
      reference: ret.srn_ref,
      type: 'Material Return',
      actorName,
      reason: remarks || rejectionReason || ret.reason
    });
  }

  const finalStatus = nextStatus === 'Return Rejected' ? 'Return Rejected' : (nextStatus === 'Fully Accepted' ? 'Returned to Stock' : 'Returned to Stock');

  await client.query(
    `UPDATE material_returns SET status = $1, qty_received = $2, qty_accepted = $3, qty_rejected = $4,
       receiving_by = $5, receiving_at = NOW(), receiving_condition = $6, receiving_remarks = $7,
       rejection_reason = $8, updated_at = NOW()
     WHERE id = $9`,
    [finalStatus, actualReceived, accepted, rejected, actorName, condition || null, remarks || null, rejectionReason || null, returnId]
  );

  await logAudit(client, { userName: actorName, action: `Completed receiving for ${ret.srn_ref}`, module: 'Material Return' });
}

// ---------------------------------------------------------------------------
// §6.4 Material Transfer (store-to-store) approval -> dual stock update
// ---------------------------------------------------------------------------

async function decideMaterialTransfer(client, { transferId, decision, actorName, actorRole }) {
  const { rows } = await client.query('SELECT * FROM material_transfers WHERE id = $1 FOR UPDATE', [transferId]);
  const transfer = rows[0];
  if (!transfer) throw new AppError('Material transfer not found.', 404);
  assertTransition('materialTransfer', transfer.status, decision);

  if (decision === 'Dispatched') {
    const sourceItem = await getItemForUpdate(client, transfer.item_id, transfer.from_store_id);
    if (Number(sourceItem.qty_on_hand) < Number(transfer.qty)) {
      throw new AppError('Source store does not have enough stock for this transfer.', 400);
    }

    const fifoUnitPrice = await consumeFifo(client, sourceItem.id, transfer.qty, transfer.from_store_id);
    const newSourceQty = Number(sourceItem.qty_on_hand) - Number(transfer.qty);
    await client.query('UPDATE item_inventory SET qty_on_hand = $1, updated_at = NOW() WHERE item_id = $2 AND store_id = $3', [newSourceQty, sourceItem.id, transfer.from_store_id]);
    if (Number(sourceItem.store_id) === Number(transfer.from_store_id)) {
      await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newSourceQty, sourceItem.id]);
    }
    await ensureSourceBinCard(client, {
      bin: sourceItem.bin,
      storeId: transfer.from_store_id,
      itemId: sourceItem.id,
      balance: Number(sourceItem.qty_on_hand),
      date: transfer.date
    });

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
    const requestedBin = String(transfer.destination_bin || '').trim();
    const { rows: locationRows } = await client.query(
      `SELECT id, code, name FROM locations
       WHERE store_id = $1 AND type = 'BIN' AND active = TRUE
         AND (LOWER(code) = LOWER($2) OR LOWER(name) = LOWER($2))
       ORDER BY CASE WHEN LOWER(code) = LOWER($2) THEN 0 ELSE 1 END, id
       LIMIT 1`,
      [transfer.to_store_id, requestedBin]
    );
    if (!locationRows[0]) {
      throw new AppError(`Destination bin "${requestedBin}" does not exist in the destination store.`, 400);
    }
    const destinationLocation = locationRows[0];

    const { rows: destRows } = await client.query(
      `SELECT ii.*, i.name, i.code, i.unit, i.category_id, i.id AS item_id
       FROM item_inventory ii
       JOIN items i ON i.id = ii.item_id
       WHERE ii.item_id = $1 AND ii.store_id = $2
       FOR UPDATE OF ii`,
      [sourceItem.id, transfer.to_store_id]
    );
    let destItem = destRows[0];
    if (!destItem) {
      const { rows: created } = await client.query(
        `INSERT INTO item_inventory (item_id, store_id, bin, location_id, qty_on_hand, unit_price, min_level, max_level, reorder_level)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8) RETURNING *`,
        [sourceItem.id, transfer.to_store_id, destinationLocation.code, destinationLocation.id, sourceItem.unit_price, sourceItem.min_level, sourceItem.max_level, sourceItem.reorder_level]
      );
      destItem = { ...created[0], item_id: sourceItem.id };
    }

    const transferUnitPrice = transfer.transfer_unit_price == null ? Number(sourceItem.unit_price) : Number(transfer.transfer_unit_price);
    const destinationBin = destinationLocation.code;
    const newDestQty = Number(destItem.qty_on_hand) + Number(transfer.qty);
    await client.query('UPDATE item_inventory SET qty_on_hand = $1, unit_price = $2, bin = $3, location_id = $4, updated_at = NOW() WHERE item_id = $5 AND store_id = $6', [
      newDestQty,
      transferUnitPrice,
      destinationBin,
      destinationLocation.id,
      sourceItem.id,
      transfer.to_store_id
    ]);
    if (Number(sourceItem.store_id) === Number(transfer.to_store_id)) {
      await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, bin = $3, location_id = $4, updated_at = NOW() WHERE id = $5', [newDestQty, transferUnitPrice, destinationBin, destinationLocation.id, sourceItem.id]);
    }

    await addStockLot(client, {
      itemId: sourceItem.id,
      storeId: transfer.to_store_id,
      receivedDate: transfer.date,
      unitPrice: transferUnitPrice,
      qty: transfer.qty,
      sourceRef: transfer.transfer_ref
    });

    await insertStockTransaction(client, {
      itemId: sourceItem.id,
      date: transfer.date,
      type: 'Transfer-In',
      ref: transfer.transfer_ref,
      qtyIn: transfer.qty,
      unitPrice: transferUnitPrice,
      balance: newDestQty,
      actorName,
      storeId: transfer.to_store_id,
      bin: destinationBin,
      sourceType: 'Transfer',
      sourceId: transfer.transfer_ref
    });
    await upsertBinCard(client, {
      bin: destinationBin,
      storeId: transfer.to_store_id,
      itemId: sourceItem.id,
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

  if (decision === 'Received' && transfer.requisition_id) {
    const { rows: pendingLines } = await client.query(
      `SELECT 1
       FROM material_transfers
       WHERE requisition_id = $1 AND status <> 'Completed'
       LIMIT 1`,
      [transfer.requisition_id]
    );
    if (!pendingLines.length) {
      await client.query(
        `UPDATE requisitions
         SET status = 'Fulfilled', updated_at = NOW()
         WHERE id = $1 AND status IN ('Approved', 'Partially Approved', 'Ready for Issue')`,
        [transfer.requisition_id]
      );
    }
  }

  await logAudit(client, {
    userName: actorName,
    userRole: actorRole,
    action: `${decision} transfer ${transfer.transfer_ref}`,
    module: 'Material Transfer',
    entityType: 'material-transfer',
    entityId: transferId,
    entityReference: transfer.transfer_ref,
    beforeData: { status: transfer.status },
    afterData: { status: nextStatus }
  });
}

// ---------------------------------------------------------------------------
// §6.5 Bin Transfer (within one store) -> immediate bin_cards update
// ---------------------------------------------------------------------------

async function createBinTransfer(client, { itemId, fromBin, toBin, qty, transferredBy, actorName }) {
  const item = await getItemForUpdate(client, itemId);
  const sourceBinCode = String(fromBin || '').trim();
  const destinationBinCode = String(toBin || '').trim();
  if (sourceBinCode.toLowerCase() === destinationBinCode.toLowerCase()) throw new AppError('Source and destination bins must be different.', 400);
  if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) throw new AppError('Bin transfer quantity must be positive.', 400);
  if (!item.bin || sourceBinCode.toLowerCase() !== String(item.bin).trim().toLowerCase()) {
    throw new AppError(`The source bin must match the item's current bin (${item.bin || 'not assigned'}).`, 400);
  }

  const { rows: sourceBin } = await client.query('SELECT id, balance FROM bin_cards WHERE bin = $1 AND store_id = $2 AND item_id = $3 FOR UPDATE', [item.bin, item.store_id, item.id]);
  if (!sourceBin[0]) {
    await client.query(
      `INSERT INTO bin_cards (bin, store_id, item_id, last_movement, balance)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
      [item.bin, item.store_id, item.id, item.qty_on_hand]
    );
  } else if (Number(sourceBin[0].balance) < Number(qty)) {
    throw new AppError(`Source bin has only ${sourceBin[0].balance} ${item.unit}(s) available.`, 400);
  }
  const transferDate = new Date();
  const { nextRef } = require('../utils/refGenerator');
  const transferRef = await nextRef(client, 'BTR');
  await upsertBinCard(client, { bin: item.bin, storeId: item.store_id, itemId: item.id, delta: -Number(qty), date: transferDate, reference: transferRef, type: 'Transfer-Out', actorName });

  const { rows: destinationLocations } = await client.query(
    `SELECT id, code
     FROM locations
     WHERE store_id = $1 AND type = 'BIN' AND active = TRUE
       AND (LOWER(code) = LOWER($2) OR LOWER(name) = LOWER($2))
     ORDER BY CASE WHEN LOWER(code) = LOWER($2) THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [item.store_id, destinationBinCode]
  );
  const resolvedDestinationBin = destinationLocations[0]?.code || destinationBinCode;
  const resolvedDestinationLocationId = destinationLocations[0]?.id || null;
  await upsertBinCard(client, { bin: resolvedDestinationBin, storeId: item.store_id, itemId: item.id, delta: Number(qty), date: transferDate, reference: transferRef, type: 'Transfer-In', actorName });
  const transferBalance = Number(item.qty_on_hand);
  await insertStockTransaction(client, {
    itemId: item.id,
    date: transferDate,
    type: 'Transfer-Out',
    ref: transferRef,
    qtyOut: Number(qty),
    unitPrice: item.unit_price,
    balance: transferBalance,
    actorName,
    storeId: item.store_id,
    bin: item.bin,
    sourceType: 'Bin Transfer',
    sourceId: transferRef
  });
  await insertStockTransaction(client, {
    itemId: item.id,
    date: transferDate,
    type: 'Transfer-In',
    ref: transferRef,
    qtyIn: Number(qty),
    unitPrice: item.unit_price,
    balance: transferBalance,
    actorName,
    storeId: item.store_id,
    bin: resolvedDestinationBin,
    sourceType: 'Bin Transfer',
    sourceId: transferRef
  });
  await client.query(
    'UPDATE items SET bin = $1, location_id = COALESCE($2, location_id), updated_at = NOW() WHERE id = $3',
    [resolvedDestinationBin, resolvedDestinationLocationId, item.id]
  );
  await client.query(
    `UPDATE item_inventory
     SET bin = $1, location_id = COALESCE($2, location_id), updated_at = NOW()
     WHERE item_id = $3 AND store_id = $4`,
    [resolvedDestinationBin, resolvedDestinationLocationId, item.id, item.store_id]
  );

  const { rows } = await client.query(
    `INSERT INTO bin_transfers (item_id, from_bin, to_bin, qty, date, transferred_by)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, $5) RETURNING *`,
    [itemId, item.bin, resolvedDestinationBin, qty, transferredBy]
  );

  await logAudit(client, {
    userName: actorName,
    action: `Transferred ${qty} unit(s) of item ${item.code} from ${item.bin} to ${resolvedDestinationBin}`,
    module: 'Stock Transfer'
  });

  return rows[0];
}

async function approveStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  if (session.status !== 'Pending Approval') throw new AppError(`Only a reconciled stock-taking session can be approved; current status is ${session.status}.`, 409);
  await client.query("UPDATE stock_taking_sessions SET status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, sessionId]);
  await logAudit(client, { userName: actorName, action: `Approved stock-taking ${session.session_ref}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: sessionId, entityReference: session.session_ref });
}

async function verifyStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  assertTransition('stockTaking', session.status, 'Closed');
  const { rows: lines } = await client.query('SELECT physical_qty, recount_physical_qty, system_qty FROM stock_taking_items WHERE session_id = $1', [sessionId]);
  if (lines.some((line) => (line.recount_physical_qty ?? line.physical_qty) == null)) {
    throw new AppError('Every item must have a physical count before verification.', 400);
  }
  if (lines.some((line) => Math.abs(Number(line.recount_physical_qty ?? line.physical_qty) - Number(line.system_qty)) > 0.0001)) {
    throw new AppError('A variance exists. Request a recount or send the session for reconciliation.', 409);
  }
  await client.query("UPDATE stock_taking_sessions SET status = 'Closed', closed_by = $1, closed_at = NOW(), updated_at = NOW() WHERE id = $2", [actorName, sessionId]);
  await logAudit(client, { userName: actorName, action: `Verified stock-taking ${session.session_ref} with no variance`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: sessionId, entityReference: session.session_ref });
}

async function reconcileStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  assertTransition('stockTaking', session.status, 'Pending Approval');
  const { rows: lines } = await client.query('SELECT physical_qty, recount_physical_qty, system_qty FROM stock_taking_items WHERE session_id = $1', [sessionId]);
  if (lines.some((line) => (line.recount_physical_qty ?? line.physical_qty) == null)) {
    throw new AppError('Every item must have a physical count before reconciliation.', 400);
  }
  if (!lines.some((line) => Math.abs(Number(line.recount_physical_qty ?? line.physical_qty) - Number(line.system_qty)) > 0.0001)) {
    throw new AppError('No adjustment is required because there is no variance.', 409);
  }
  await client.query("UPDATE stock_taking_sessions SET status = 'Pending Approval', updated_at = NOW() WHERE id = $1", [sessionId]);
  await logAudit(client, { userName: actorName, action: `Sent stock-taking ${session.session_ref} for adjustment approval`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: sessionId, entityReference: session.session_ref });
}

async function postStockTaking(client, { sessionId, actorName }) {
  const { rows } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  const session = rows[0];
  if (!session) throw new AppError('Stock-taking session not found.', 404);
  if (session.status !== 'Approved') throw new AppError(`Only an approved stock-taking session can be posted; current status is ${session.status}.`, 409);
  const { rows: lines } = await client.query(
    `SELECT sti.*, i.name, i.unit, i.store_id AS legacy_store_id,
            ii.bin, ii.store_id, ii.unit_price
     FROM stock_taking_items sti
     JOIN items i ON i.id = sti.item_id
     JOIN stock_taking_sessions sts ON sts.id = sti.session_id
     JOIN item_inventory ii ON ii.item_id = sti.item_id AND ii.store_id = sts.store_id
     WHERE sti.session_id = $1 FOR UPDATE OF sti, ii`,
    [sessionId]
  );
  if (lines.some((line) => line.physical_qty == null)) {
    throw new AppError('Every item must have a physical count before the session can be posted.', 400);
  }
  const { nextRef } = require('../utils/refGenerator');
  for (const line of lines) {
    const item = await getItemForUpdate(client, line.item_id, session.store_id);
    const countedQty = line.recount_physical_qty == null ? Number(line.physical_qty) : Number(line.recount_physical_qty);
    const variance = countedQty - Number(item.qty_on_hand);
    if (Math.abs(variance) < 0.0001) continue;
    if (!line.reason) throw new AppError(`A reason is required for the variance on "${line.name}".`, 400);
    const reference = session.session_ref;
    if (variance > 0) {
      await addStockLot(client, { itemId: item.id, storeId: session.store_id, receivedDate: session.count_date, unitPrice: item.unit_price, qty: variance, sourceRef: reference });
    } else {
      await consumeFifo(client, item.id, Math.abs(variance), session.store_id);
    }
    const newQty = Number(item.qty_on_hand) + variance;
    await client.query('UPDATE item_inventory SET qty_on_hand = $1, updated_at = NOW() WHERE item_id = $2 AND store_id = $3', [newQty, item.id, session.store_id]);
    if (Number(line.legacy_store_id) === Number(session.store_id)) {
      await client.query('UPDATE items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2', [newQty, item.id]);
    }
    await insertStockTransaction(client, { itemId: item.id, date: session.count_date, type: 'Adjustment', ref: reference, qtyIn: variance > 0 ? variance : 0, qtyOut: variance < 0 ? Math.abs(variance) : 0, unitPrice: item.unit_price, balance: newQty, actorName, storeId: session.store_id, bin: line.bin || item.bin, reason: line.reason, sourceType: 'Stock Taking', sourceId: String(sessionId) });
    await upsertBinCard(client, { bin: line.bin || item.bin, storeId: session.store_id, itemId: item.id, delta: variance, date: session.count_date, reference, type: 'Adjustment', actorName, reason: line.reason });
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
  const nextStatus = decision === 'Returned for Correction' ? 'Returned for Correction' : decision;
  assertTransition('disposal', disposal.status, nextStatus);

  await client.query(
    `UPDATE disposals SET status = $1,
       approved_by = CASE WHEN $1 IN ('Approved', 'Rejected') THEN $2 ELSE approved_by END,
       approved_at = CASE WHEN $1 IN ('Approved', 'Rejected') THEN NOW() ELSE approved_at END,
       updated_at = NOW() WHERE id = $3`,
    [nextStatus, actorName, disposalId]
  );
  await logAudit(client, { userName: actorName, action: `${decision} disposal ${disposal.disposal_ref}`, module: 'Disposal Management' });
}

async function executeDisposal(client, { disposalId, actorName, disposalDate, disposalMethod, witness }) {
  if (!String(disposalMethod || '').trim() || !String(witness || '').trim()) {
    throw new AppError('Disposal method and witness are required to execute a disposal.', 400);
  }
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [disposalId]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  const executedStatus = disposal.status === 'Ready for Disposal' ? 'Disposed' : 'Executed';
  assertTransition('disposal', disposal.status, executedStatus);

  const item = await getItemForUpdate(client, disposal.item_id, disposal.store_id);
  if (Number(item.qty_on_hand) < Number(disposal.qty)) {
    throw new AppError('Not enough stock on hand to dispose of this quantity.', 400);
  }

  const fifoUnitPrice = await consumeFifo(client, item.id, disposal.qty, disposal.store_id);
  const newQty = Number(item.qty_on_hand) - Number(disposal.qty);
  await client.query(
    'UPDATE item_inventory SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE item_id = $3 AND store_id = $4',
    [newQty, fifoUnitPrice, item.id, disposal.store_id]
  );
  if (Number(item.store_id) === Number(disposal.store_id)) {
    await client.query('UPDATE items SET qty_on_hand = $1, unit_price = $2, updated_at = NOW() WHERE id = $3', [newQty, fifoUnitPrice, item.id]);
  }

  await insertStockTransaction(client, {
    itemId: item.id,
    date: disposal.date_flagged,
    type: 'Disposal',
    ref: disposal.disposal_ref,
    qtyOut: disposal.qty,
    unitPrice: fifoUnitPrice,
    balance: newQty,
    actorName,
    storeId: disposal.store_id,
    bin: item.bin,
    sourceType: 'Disposal',
    sourceId: disposal.disposal_ref
  });

  await upsertBinCard(client, {
    bin: item.bin,
    storeId: disposal.store_id,
    itemId: item.id,
    delta: -Number(disposal.qty),
    date: disposal.date_flagged,
    reference: disposal.disposal_ref,
    type: 'Disposal',
    actorName
  });

  await client.query(
    `UPDATE disposals SET status = $6, executed_by = $1, executed_at = NOW(),
       disposal_date = COALESCE($2, CURRENT_DATE), disposal_method = $3, witness = $4, updated_at = NOW()
     WHERE id = $5`,
    [actorName, disposalDate || null, disposalMethod || null, witness || null, disposalId, executedStatus]
  );
  await logAudit(client, { userName: actorName, action: `Executed disposal ${disposal.disposal_ref}`, module: 'Disposal Management' });
}

async function completeDisposal(client, { disposalId, actorName }) {
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [disposalId]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  assertTransition('disposal', disposal.status, 'Completed');

  await client.query(
    `UPDATE disposals SET status = 'Completed', updated_at = NOW() WHERE id = $1`,
    [disposalId]
  );
  await logAudit(client, { userName: actorName, action: `Confirmed disposal completion ${disposal.disposal_ref}`, module: 'Disposal Management' });
}

async function closeDisposal(client, { disposalId, actorName }) {
  const { rows } = await client.query('SELECT * FROM disposals WHERE id = $1 FOR UPDATE', [disposalId]);
  const disposal = rows[0];
  if (!disposal) throw new AppError('Disposal request not found.', 404);
  assertTransition('disposal', disposal.status, 'Closed');

  await client.query(
    `UPDATE disposals SET status = 'Closed', updated_at = NOW() WHERE id = $1`,
    [disposalId]
  );
  await logAudit(client, { userName: actorName, action: `Closed disposal ${disposal.disposal_ref}`, module: 'Disposal Management' });
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
  endorseRequisition,

  decideMaterialReturn,
  receiveMaterialReturn,
  decideMaterialTransfer,
  createBinTransfer,
  approveStockTaking,
  verifyStockTaking,
  reconcileStockTaking,
  postStockTaking,
  decideDisposal,
  executeDisposal,
  completeDisposal,
  closeDisposal
};
