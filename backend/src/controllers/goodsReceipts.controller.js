const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapGoodsReceipt, resolveStoreId, resolveStoreHeadForStore, resolveItemId, resolveSupplierId, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');
const stockService = require('../services/stockService');
const { assertTransition } = require('../utils/workflow');
const { notify } = require('../utils/notify');
const { canAct } = require('../utils/permissions');

async function assertMainStoreOperator(user, dbClient) {
  const { rows } = await dbClient.query(
    `SELECT s.id
     FROM store_user_assignments a
     JOIN stores s ON s.id = a.store_id
     WHERE s.active = TRUE AND s.type = 'Main Store' AND a.user_id = $1 AND a.assignment_role = 'Storekeeper' AND a.active = TRUE
     LIMIT 1`,
    [user.id]
  );
  if (!rows[0]) throw new AppError('External goods receipts can only be processed by the Main Store Storekeeper assigned to that store.', 403);
}

const SELECT = `
    SELECT g.*, g.received_date::text AS received_date, s.name AS store_name,
      grn.grn_number AS official_grn_ref, grn.generated_by AS official_grn_generated_by,
      grn.generated_at AS official_grn_generated_at
  FROM goods_receipts g
  LEFT JOIN stores s ON s.id = g.store_id
  LEFT JOIN grns grn ON grn.goods_receipt_id = g.id
`;

async function fetchWithLines(id, dbClient = { query }, extraWhere = '', extraParams = []) {
  const { rows } = await dbClient.query(`${SELECT} WHERE g.id = $1${extraWhere}`, [id, ...extraParams]);
  if (!rows[0]) return null;
  const { rows: lines } = await dbClient.query(
    `SELECT gi.*, i.name AS item_name, COALESCE(c.name, 'Uncategorized') AS category_name
     FROM goods_receipt_items gi
     JOIN items i ON i.id = gi.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE gi.goods_receipt_id = $1`,
    [id]
  );
  return mapGoodsReceipt(rows[0], lines);
}

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Technical Evaluation Committee') {
    scope = "WHERE g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted')";
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE g.store_id = $1';
      params = [visibility.assignedStoreId];
    }
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY g.id DESC`, params);
  const results = [];
  for (const row of rows) {
    const { rows: lines } = await query(
      `SELECT gi.*, i.name AS item_name, COALESCE(c.name, 'Uncategorized') AS category_name
       FROM goods_receipt_items gi
       JOIN items i ON i.id = gi.item_id
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE gi.goods_receipt_id = $1`,
      [row.id]
    );
    results.push(mapGoodsReceipt(row, lines));
  }
  res.json(results);
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Technical Evaluation Committee') {
    scope = " AND g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted')";
  } else if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND g.store_id = $2';
      params.push(visibility.assignedStoreId);
    } else {
      throw new AppError('You are not assigned to any store scope.', 403);
    }
  }

  const { rows } = await query(`${SELECT} WHERE g.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Goods receipt not found.', 404);

  if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
  }

  const grn = await fetchWithLines(
    req.params.id,
    { query },
    req.user.role === 'Technical Evaluation Committee' ? " AND g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted')" : ''
  );
  if (!grn) throw new AppError('Goods receipt not found.', 404);
  res.json(grn);
});

// POST /api/goods-receipts — Backend-SRS §6.1 step 1 (Draft only, no stock change)
const create = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can create or edit a goods receipt draft.', 403);
  }

  const { supplier, poRef, materialType, type, supportingDocumentRef, conditionOnArrival, receivedDate, store, items } = req.body;
  const receivedMaterialType = materialType || type;
  if (!supplier?.trim()) throw new AppError('Supplier is required.', 400);
  if (!poRef?.trim()) throw new AppError('PO or donation reference is required.', 400);
  if (!receivedDate || Number.isNaN(Date.parse(receivedDate))) throw new AppError('A valid received date is required.', 400);
  if (!store?.trim()) throw new AppError('Receiving store is required.', 400);
  if (!['Consumable', 'Fixed Asset'].includes(receivedMaterialType)) throw new AppError('Material type must be Consumable or Fixed Asset.', 400);
  if (!['New', 'Good', 'Damaged'].includes(conditionOnArrival || 'New')) throw new AppError('Arrival condition must be New, Good, or Damaged.', 400);
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one received item is required.', 400);
  }
  items.forEach((line, index) => {
    if (!line.item?.trim()) throw new AppError(`Item is required on line ${index + 1}.`, 400);
    if (!Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0) throw new AppError(`Quantity must be greater than zero on line ${index + 1}.`, 400);
    if (line.expectedQty !== undefined && (!Number.isFinite(Number(line.expectedQty)) || Number(line.expectedQty) < 0)) throw new AppError(`Expected quantity must be zero or greater on line ${index + 1}.`, 400);
    if (!Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) throw new AppError(`Unit price must be zero or greater on line ${index + 1}.`, 400);
  });

  if (!supplier || !receivedDate || !store || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Goods receipt details are incomplete.', 400);
  }

  const result = await withTransaction(async (client) => {
    await assertMainStoreOperator(req.user, client);
    const storeId = await resolveStoreId(store, client);
    const { rows: storeRows } = await client.query(
      `SELECT id, type FROM stores WHERE id = $1 AND active = TRUE`,
      [storeId]
    );
    if (storeRows[0]?.type !== 'Main Store') {
      throw new AppError('External goods receipts must be received into the Main Store.', 403);
    }
    const supplierId = await resolveSupplierId(supplier, client);
    const grnRef = await nextRef(client, 'GRN');

    const { rows } = await client.query(
      `INSERT INTO goods_receipts (grn_ref, supplier, supplier_id, po_ref, material_type, supporting_document_ref, condition_on_arrival, received_date, received_by, store_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Draft') RETURNING id`,
      [grnRef, supplier.trim(), supplierId, poRef.trim(), receivedMaterialType, supportingDocumentRef?.trim() || null, conditionOnArrival || 'New', receivedDate, req.user.name, storeId]
    );
    const grnId = rows[0].id;

    for (const line of items) {
      const itemId = await resolveItemId(line.item, client, storeId);
      if (!itemId) throw new AppError(`Unknown item on this receipt: "${line.item}".`, 400);
      await client.query(
        `INSERT INTO goods_receipt_items
         (goods_receipt_id, item_id, qty, unit_price, expected_qty, received_qty)
         VALUES ($1, $2, $3, $4, $5, $3)`,
        [grnId, itemId, line.qty, line.unitPrice, line.expectedQty == null ? line.qty : line.expectedQty]
      );
    }

    await logAudit(client, {
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: `Created ${grnRef}`,
      module: 'Goods Receipt',
      entityType: 'goods_receipt',
      entityId: grnId,
      entityReference: grnRef,
      beforeData: {},
      afterData: { status: 'Draft' }
    });
    return fetchWithLines(grnId, client);
  });

  res.status(201).json(result);
});

// POST /api/goods-receipts/:id/evaluate — Backend-SRS §6.1 steps 2-4
const evaluate = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Technical Evaluation Committee') {
    throw new AppError('Only the Technical Evaluation Committee can evaluate goods receipts.', 403);
  }

  const { decision, evaluationNote, findings, condition, evidence, items } = req.body;
  if (!['Approved', 'Rejected', 'Partially Approved'].includes(decision)) {
    throw new AppError('decision must be "Approved", "Partially Approved", or "Rejected".', 400);
  }
  if (!String(evaluationNote || findings || '').trim()) {
    throw new AppError('Evaluation findings or a decision note is required.', 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Accepted quantities are required for every evaluated receipt.', 400);
  }

  await withTransaction(async (client) => {
    await stockService.recordGoodsReceiptEvaluation(client, {
      grnId: req.params.id,
      decision,
      evaluationNote,
      findings,
      condition,
      evidence,
      items,
      evaluatedBy: req.user.name,
      actorName: req.user.name,
      actorRole: req.user.role
    });
    const { rows } = await client.query(
      `SELECT g.grn_ref, g.store_id, s.head_of_store
       FROM goods_receipts g
       LEFT JOIN stores s ON s.id = g.store_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    const storeHeadId = rows[0]?.store_id ? await resolveStoreHeadForStore(rows[0].store_id, client) : null;
    const isAccepted = decision === 'Approved' || decision === 'Partially Approved';
    if (!storeHeadId && !isAccepted) {
      throw new AppError('No active Store Head is configured for the receiving store.', 409);
    }
    await notify(client, {
      userId: isAccepted ? undefined : storeHeadId || undefined,
      role: isAccepted ? 'Storekeeper' : undefined,
      storeId: rows[0]?.store_id || null,
      title: isAccepted ? 'Goods receipt accepted' : 'Goods receipt rejected',
      message: isAccepted
        ? `${rows[0]?.grn_ref || `Receipt ${req.params.id}`} was ${decision.toLowerCase()}. Generate the official GRN and post the accepted stock.`
        : `${rows[0]?.grn_ref || `Receipt ${req.params.id}`} was rejected by TEC. Review the evaluation outcome and arrange the next action.`,
      type: isAccepted ? 'success' : 'warning',
      route: isAccepted ? '/goods-receipt' : '/goods-receipt/evaluation',
      entityType: 'goods_receipt',
      entityId: req.params.id
    });
  });

  const grn = await fetchWithLines(req.params.id);
  res.json(grn);
});

const generateGrn = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can generate the official GRN for accepted stock.', 403);
  }

  await withTransaction(async (client) => {
    await assertMainStoreOperator(req.user, client);
    const { rows: receiptRows } = await client.query('SELECT store_id, grn_ref FROM goods_receipts WHERE id = $1', [req.params.id]);
    if (!receiptRows[0]) throw new AppError('Goods receipt not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, receiptRows[0].store_id, client);
    await stockService.generateGrn(client, {
      grnId: req.params.id,
      generatedBy: req.user.name,
      actorName: req.user.name,
      actorRole: req.user.role
    });
    await notify(client, {
      role: 'Store Head',
      storeId: receiptRows[0].store_id,
      title: 'Official GRN generated',
      message: `${receiptRows[0].grn_ref} has an official GRN ready for posting.`,
      type: 'success',
      route: '/grn-documents',
      entityType: 'goods_receipt',
      entityId: req.params.id
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const postStock = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can post accepted stock into inventory.', 403);
  }

  await withTransaction(async (client) => {
    await assertMainStoreOperator(req.user, client);
    const { rows: receiptRows } = await client.query('SELECT store_id, grn_ref FROM goods_receipts WHERE id = $1', [req.params.id]);
    if (!receiptRows[0]) throw new AppError('Goods receipt not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, receiptRows[0].store_id, client);
    await stockService.postGrn(client, { grnId: req.params.id, actorName: req.user.name, actorRole: req.user.role });
    await notify(client, {
      role: 'Store Head',
      storeId: receiptRows[0].store_id,
      title: 'Goods receipt stock posted',
      message: `${receiptRows[0].grn_ref} was posted to inventory successfully.`,
      type: 'success',
      route: '/stock-cards',
      entityType: 'goods_receipt',
      entityId: req.params.id
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const setStatus = asyncHandler(async (req, res) => {
  const allowed = ['Draft', 'Submitted', 'Store Head Review', 'Pending', 'Pending Evaluation', 'Under Evaluation'];
  if (!allowed.includes(req.body.status)) throw new AppError('Invalid goods receipt workflow status.', 400);

  if (req.body.status === 'Submitted' && req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can submit a goods receipt for review.', 403);
  }
  if (req.body.status === 'Pending Evaluation' && !canAct('goods-receipts-notify-tec', req.user.role)) {
    throw new AppError('Only the Store Head can notify the Technical Evaluation Committee.', 403);
  }
  if (req.body.status === 'Store Head Review' && req.user.role !== 'Store Head') {
    throw new AppError('Only the Store Head can start the goods receipt review.', 403);
  }
  if (req.body.status === 'Pending Evaluation' && req.user.role !== 'Store Head') {
    throw new AppError('Only the Store Head can send a receipt to technical evaluation.', 403);
  }
  if (req.body.status === 'Under Evaluation' && req.user.role !== 'Technical Evaluation Committee') {
    throw new AppError('Only the Technical Evaluation Committee can start an evaluation.', 403);
  }
  await withTransaction(async (client) => {
    const { rows: currentRows } = await client.query(
      `SELECT g.status, g.grn_ref, g.store_id, g.gate_verified, s.name AS store_name
       FROM goods_receipts g
       LEFT JOIN stores s ON s.id = g.store_id
       WHERE g.id = $1 FOR UPDATE OF g`,
      [req.params.id]
    );
    if (!currentRows[0]) throw new AppError('Goods receipt not found.', 404);
    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
      await assertUserCanAccessStoreRecord(req.user, currentRows[0].store_id, client);
    }
    if (req.body.status === 'Submitted') await assertMainStoreOperator(req.user, client);
    assertTransition('goodsReceipt', currentRows[0].status, req.body.status);
    const storeHeadId = currentRows[0]?.store_id ? await resolveStoreHeadForStore(currentRows[0].store_id, client) : null;
    await client.query(
      `UPDATE goods_receipts SET status = $1, updated_at = NOW() WHERE id = $2`,
      [req.body.status, req.params.id]
    );
    await logAudit(client, {
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: `Changed ${currentRows[0].grn_ref} status to ${req.body.status}`,
      module: 'Goods Receipt',
      entityType: 'goods_receipt',
      entityId: req.params.id,
      entityReference: currentRows[0].grn_ref,
      beforeData: { status: currentRows[0].status },
      afterData: { status: req.body.status }
    });
    if (req.body.status === 'Submitted') {
      await notify(client, {
        userId: storeHeadId || undefined,
        role: storeHeadId ? undefined : 'Store Head',
        storeId: currentRows[0].store_id,
        title: 'Goods receipt submitted for review',
        message: `${currentRows[0].grn_ref} for ${currentRows[0].store_name || 'your store'} was submitted by the Storekeeper and requires your review before technical evaluation.`,
        type: 'info',
        route: '/goods-receipt',
        entityType: 'goods_receipt',
        entityId: req.params.id
      });

      await notify(client, {
        role: 'Security Officer',
        title: 'External delivery awaiting gate verification',
        message: `${currentRows[0].grn_ref} for ${currentRows[0].store_name || 'the receiving store'} has arrived at the ASTU gate and requires Security verification before technical evaluation.`,
        type: 'info',
        route: '/gate-pass',
        entityType: 'goods_receipt',
        entityId: req.params.id
      });

    }

    if (req.body.status === 'Store Head Review') {
      await notify(client, {
        userId: storeHeadId || undefined,
        role: storeHeadId ? undefined : 'Store Head',
        storeId: currentRows[0].store_id,
        title: 'Goods receipt pending Store Head review',
        message: `${currentRows[0].grn_ref} is ready for your review before technical evaluation.`,
        type: 'info',
        route: '/goods-receipt',
        entityType: 'goods_receipt',
        entityId: req.params.id
      });
    }

    if (['Pending Evaluation', 'Under Evaluation'].includes(req.body.status)) {
      if (!currentRows[0].gate_verified) {
        throw new AppError('Security must verify the incoming delivery before it can be sent for technical evaluation.', 409);
      }
      await notify(client, {
        role: 'Technical Evaluation Committee',
        title: 'Goods receipt awaiting evaluation',
        message: `${currentRows[0].grn_ref} is ready for technical evaluation.`,
        type: 'warning',
        route: '/goods-receipt/evaluation',
        entityType: 'goods_receipt',
        entityId: req.params.id
      });
    }
  });

  res.json(await fetchWithLines(req.params.id));
});

const remove = asyncHandler(async (req, res) => {
  const { rows: check } = await query('SELECT status, store_id FROM goods_receipts WHERE id = $1', [req.params.id]);
  if (!check[0]) throw new AppError('Goods receipt not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, check[0].store_id, { query });
  if (!['Draft', 'Submitted', 'Store Head Review', 'Pending', 'Pending Evaluation'].includes(check[0].status)) throw new AppError('Cannot delete a goods receipt that has already been processed.', 400);

  const { rows } = await query('DELETE FROM goods_receipts WHERE id = $1 RETURNING grn_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted ${rows[0].grn_ref}`, module: 'Goods Receipt' });
  res.status(204).send();
});

module.exports = { list, getOne, create, evaluate, generateGrn, postStock, setStatus, remove };
