const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapGoodsReceipt, resolveStoreId, resolveItemId, resolveSupplierId } = require('./_helpers');
const stockService = require('../services/stockService');
const { assertTransition } = require('../utils/workflow');
const { notify } = require('../utils/notify');
const { canAct } = require('../utils/permissions');

const SELECT = `
  SELECT g.*, s.name AS store_name
  FROM goods_receipts g
  LEFT JOIN stores s ON s.id = g.store_id
`;

async function fetchWithLines(id, dbClient = { query }, extraWhere = '', extraParams = []) {
  const { rows } = await dbClient.query(`${SELECT} WHERE g.id = $1${extraWhere}`, [id, ...extraParams]);
  if (!rows[0]) return null;
  const { rows: lines } = await dbClient.query(
    `SELECT gi.*, i.name AS item_name FROM goods_receipt_items gi JOIN items i ON i.id = gi.item_id WHERE gi.goods_receipt_id = $1`,
    [id]
  );
  return mapGoodsReceipt(rows[0], lines);
}

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Technical Evaluation Committee') {
    scope = "WHERE g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected')";
  } else if (req.user.role === 'Store Head' && req.user.store) {
    scope = 'WHERE s.name = $1';
    params = [req.user.store];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY g.id DESC`, params);
  const results = [];
  for (const row of rows) {
    const { rows: lines } = await query(
      `SELECT gi.*, i.name AS item_name FROM goods_receipt_items gi JOIN items i ON i.id = gi.item_id WHERE gi.goods_receipt_id = $1`,
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
    scope = " AND g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected')";
  } else if (req.user.role === 'Store Head' && req.user.store) {
    scope = ' AND s.name = $2';
    params.push(req.user.store);
  }

  const { rows } = await query(`${SELECT} WHERE g.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Goods receipt not found.', 404);
  const grn = await fetchWithLines(
    req.params.id,
    { query },
    req.user.role === 'Technical Evaluation Committee' ? " AND g.status IN ('Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected')" : ''
  );
  if (!grn) throw new AppError('Goods receipt not found.', 404);
  res.json(grn);
});

// POST /api/goods-receipts — Backend-SRS §6.1 step 1 (Draft only, no stock change)
const create = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can create or edit a goods receipt draft.', 403);
  }

  const { supplier, poRef, receivedDate, receivedBy, store, items } = req.body;
  if (!supplier || !receivedDate || !store || !Array.isArray(items) || items.length === 0) {
    throw new AppError('supplier, receivedDate, store, and at least one item are required.', 400);
  }

  const result = await withTransaction(async (client) => {
    const storeId = await resolveStoreId(store, client);
    const supplierId = await resolveSupplierId(supplier, client);
    const grnRef = await nextRef(client, 'GRN');

    const { rows } = await client.query(
      `INSERT INTO goods_receipts (grn_ref, supplier, supplier_id, po_ref, received_date, received_by, store_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Draft') RETURNING id`,
      [grnRef, supplier, supplierId, poRef || null, receivedDate, receivedBy || req.user.name, storeId]
    );
    const grnId = rows[0].id;

    for (const line of items) {
      const itemId = await resolveItemId(line.item, client, storeId);
      if (!itemId) throw new AppError(`Unknown item on this receipt: "${line.item}".`, 400);
      await client.query(
        'INSERT INTO goods_receipt_items (goods_receipt_id, item_id, qty, unit_price) VALUES ($1,$2,$3,$4)',
        [grnId, itemId, line.qty, line.unitPrice]
      );
    }

    await notify(client, {
      role: 'Security Officer',
      title: 'External delivery awaiting gate verification',
      message: `${grnRef} from ${supplier} for ${store} has arrived at the ASTU gate and requires Security verification before the receiving process continues.`,
      type: 'info',
      route: '/gate-pass',
      entityType: 'goods_receipt',
      entityId: grnId
    });

    await logAudit(client, { userName: req.user.name, action: `Created ${grnRef}`, module: 'Goods Receipt' });
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
      actorName: req.user.name
    });
    const { rows } = await client.query(
      `SELECT g.grn_ref, s.head_of_store, u.id AS store_head_id
       FROM goods_receipts g
       LEFT JOIN stores s ON s.id = g.store_id
       LEFT JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
       WHERE g.id = $1`,
      [req.params.id]
    );
    const isAccepted = decision === 'Approved' || decision === 'Partially Approved';
    await notify(client, {
      userId: isAccepted ? undefined : rows[0]?.store_head_id,
      role: isAccepted ? 'Storekeeper' : rows[0]?.store_head_id ? undefined : 'Property Administration Officer',
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
    await stockService.generateGrn(client, {
      grnId: req.params.id,
      generatedBy: req.user.name,
      actorName: req.user.name
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const postStock = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can post accepted stock into inventory.', 403);
  }

  await withTransaction((client) => stockService.postGrn(client, { grnId: req.params.id, actorName: req.user.name }));
  res.json(await fetchWithLines(req.params.id));
});

const setStatus = asyncHandler(async (req, res) => {
  const allowed = ['Draft', 'Submitted', 'Pending', 'Pending Evaluation', 'Under Evaluation'];
  if (!allowed.includes(req.body.status)) throw new AppError('Invalid goods receipt workflow status.', 400);

  if (req.body.status === 'Submitted' && req.user.role !== 'Storekeeper') {
    throw new AppError('Only the Storekeeper can submit a goods receipt for review.', 403);
  }
  if (req.body.status === 'Pending Evaluation' && !canAct('goods-receipts-notify-tec', req.user.role)) {
    throw new AppError('Only the Store Head can notify the Technical Evaluation Committee.', 403);
  }
  if (req.body.status === 'Under Evaluation' && req.user.role !== 'Technical Evaluation Committee') {
    throw new AppError('Only the Technical Evaluation Committee can start an evaluation.', 403);
  }
  await withTransaction(async (client) => {
    const { rows: currentRows } = await client.query(
      `SELECT g.status, g.grn_ref, g.store_id, s.name AS store_name, u.id AS store_head_id
       FROM goods_receipts g
       LEFT JOIN stores s ON s.id = g.store_id
       LEFT JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
      WHERE g.id = $1 FOR UPDATE OF g`,
      [req.params.id]
    );
    if (!currentRows[0]) throw new AppError('Goods receipt not found.', 404);
    assertTransition('goodsReceipt', currentRows[0].status, req.body.status);
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
        userId: currentRows[0].store_head_id,
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
        message: `${currentRows[0].grn_ref} from ${currentRows[0].store_name || 'supplier'} has arrived at the ASTU gate and requires Security verification before the receiving process continues.`,
        type: 'info',
        route: '/gate-pass',
        entityType: 'goods_receipt',
        entityId: req.params.id
      });
    }

    if (req.body.status === 'Pending Evaluation') {
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
  const { rows: check } = await query('SELECT status FROM goods_receipts WHERE id = $1', [req.params.id]);
  if (!check[0]) throw new AppError('Goods receipt not found.', 404);
  if (!['Draft', 'Submitted', 'Pending', 'Pending Evaluation'].includes(check[0].status)) throw new AppError('Cannot delete a goods receipt that has already been processed.', 400);

  const { rows } = await query('DELETE FROM goods_receipts WHERE id = $1 RETURNING grn_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted ${rows[0].grn_ref}`, module: 'Goods Receipt' });
  res.status(204).send();
});

module.exports = { list, getOne, create, evaluate, generateGrn, postStock, setStatus, remove };
