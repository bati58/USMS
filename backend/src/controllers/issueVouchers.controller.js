const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { mapIssueVoucher } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT iv.*, r.store_id, s.name AS store_name
  FROM issue_vouchers iv
  LEFT JOIN requisitions r ON r.sr_ref = iv.sr_ref
  LEFT JOIN stores s ON s.id = r.store_id
`;

async function fetchWithLines(id, dbClient = { query }) {
  const { rows } = await dbClient.query(`${SELECT} WHERE iv.id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: lines } = await dbClient.query(
    `SELECT ivi.*, i.name AS item_name FROM issue_voucher_items ivi JOIN items i ON i.id = ivi.item_id WHERE ivi.issue_voucher_id = $1`,
    [id]
  );
  return mapIssueVoucher(rows[0], lines);
}

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = 'WHERE s.name = $1';
    params = [req.user.store];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY iv.id DESC`, params);
  const results = [];
  for (const row of rows) {
    const { rows: lines } = await query(
      `SELECT ivi.*, i.name AS item_name FROM issue_voucher_items ivi JOIN items i ON i.id = ivi.item_id WHERE ivi.issue_voucher_id = $1`,
      [row.id]
    );
    results.push(mapIssueVoucher(row, lines));
  }
  res.json(results);
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = ' AND s.name = $2';
    params.push(req.user.store);
  }

  const v = await fetchWithLines(req.params.id, {
    query: async (sql, values) => {
      const { rows } = await query(`${SELECT} WHERE iv.id = $1${scope}`, params);
      return { rows };
    }
  });
  if (!v) throw new AppError('Issue voucher not found.', 404);
  res.json(v);
});

// POST /api/issue-vouchers — Backend-SRS §6.2 steps 3-4 (generates from an
// approved requisition; decrements stock via FIFO)
const create = asyncHandler(async (req, res) => {
  const { srRef } = req.body;
  if (!srRef) throw new AppError('srRef (the approved requisition reference) is required.', 400);

  const result = await withTransaction(async (client) => {
    const { id } = await stockService.createPreliminaryIssueVoucher(client, {
      srRef,
      issuedBy: req.user.name,
      actorName: req.user.name
    });
    return fetchWithLines(id, client);
  });

  res.status(201).json(result);
});

const approve = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    await stockService.approveIssueVoucher(client, { voucherId: req.params.id, actorName: req.user.name });
    const { rows } = await client.query('SELECT siv_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    await notify(client, {
      role: 'Storekeeper',
      title: 'Issue Voucher Approved',
      message: `SIV ${rows[0]?.siv_ref} has been approved and is ready for posting.`,
      type: 'success',
      route: `/issue-vouchers/${req.params.id}`,
      entityType: 'issue_voucher',
      entityId: req.params.id
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const post = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    await stockService.postIssueVoucher(client, { voucherId: req.params.id, actorName: req.user.name });
    const { rows } = await client.query('SELECT siv_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    await notify(client, {
      role: 'Security Officer',
      title: 'Issue Voucher Posted',
      message: `SIV ${rows[0]?.siv_ref} has been posted and stock movement is complete.`,
      type: 'success',
      route: `/issue-vouchers/${req.params.id}`,
      entityType: 'issue_voucher',
      entityId: req.params.id
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const amend = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    await stockService.amendIssueVoucher(client, { voucherId: req.params.id, items: req.body.items, reason: req.body.reason, actorName: req.user.name });

    // Amend is the storekeeper's submit-for-approval step (status -> 'Pending Approval').
    // Persist a notification for the approver so the event does not live only in the browser (Phase 5).
    const { rows } = await client.query('SELECT siv_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    await notify(client, {
      role: 'Store Head',
      title: 'Issue Voucher Awaiting Approval',
      message: `Issue voucher ${rows[0]?.siv_ref} is pending your approval.`,
      type: 'info',
      route: `/issue-vouchers/${req.params.id}`,
      entityType: 'issue_voucher',
      entityId: req.params.id
    });

    return fetchWithLines(req.params.id, client);
  });
  res.json(result);
});

module.exports = { list, getOne, create, approve, amend, post };
