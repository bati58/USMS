const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { mapIssueVoucher, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');
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

async function assertVoucherStoreAccess(user, voucherId, dbClient = { query }) {
  const { rows } = await dbClient.query(
    `SELECT r.store_id
     FROM issue_vouchers iv
     LEFT JOIN requisitions r ON r.sr_ref = iv.sr_ref
     WHERE iv.id = $1`,
    [voucherId]
  );
  if (!rows[0]) throw new AppError('Issue voucher not found.', 404);
  await assertUserCanAccessStoreRecord(user, rows[0].store_id, dbClient);
}

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = 'WHERE 1 = 1';
    } else if (visibility.assignedStoreId) {
      scope = 'WHERE r.store_id = $1';
      params = [visibility.assignedStoreId];
    }
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

  if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
    const visibility = await getUserStoreVisibility(req.user, { query });
    if (visibility.canViewAllStores) {
      scope = '';
    } else if (visibility.assignedStoreId) {
      scope = ' AND r.store_id = $2';
      params.push(visibility.assignedStoreId);
    } else {
      throw new AppError('You are not assigned to any store scope.', 403);
    }
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

// POST /api/issue-vouchers — Storekeeper creates the preliminary voucher from
// an approved requisition; posting remains a separate final issue action.
const create = asyncHandler(async (req, res) => {
  const { srRef } = req.body;
  if (!srRef) throw new AppError('srRef (the approved requisition reference) is required.', 400);

  const result = await withTransaction(async (client) => {
    const { rows: requisitionRows } = await client.query('SELECT store_id FROM requisitions WHERE sr_ref = $1', [srRef]);
    if (!requisitionRows[0]) throw new AppError('The referenced requisition was not found.', 404);
    await assertUserCanAccessStoreRecord(req.user, requisitionRows[0].store_id, client);
    // The Storekeeper prepares the preliminary voucher from an approved requisition.
    const { id, sivRef } = await stockService.createPreliminaryIssueVoucher(client, {
      srRef,
      issuedBy: req.user.name,
      actorName: req.user.name
    });
    // AUTHORIZED REVIEW: the Store Head must authorize the voucher before issue.
    await notify(client, {
      role: 'Store Head',
      title: 'Issue Voucher Awaiting Authorization',
      message: `Issue voucher ${sivRef} (from requisition ${srRef}) was prepared and needs your authorization.`,
      type: 'info',
      route: '/issue-vouchers',
      entityType: 'issue_voucher',
      entityId: String(id)
    });
    return fetchWithLines(id, client);
  });

  res.status(201).json(result);
});

const approve = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    await assertVoucherStoreAccess(req.user, req.params.id, client);
    await stockService.approveIssueVoucher(client, { voucherId: req.params.id, actorName: req.user.name });
    const { rows } = await client.query('SELECT siv_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    const { rows: voucherRows } = await client.query(
      `SELECT iv.*, r.store_id
       FROM issue_vouchers iv
       LEFT JOIN requisitions r ON r.sr_ref = iv.sr_ref
       WHERE iv.id = $1`,
      [req.params.id]
    );
    await notify(client, {
      role: 'Storekeeper',
      storeId: voucherRows[0]?.store_id,
      title: 'Issue Voucher Approved',
      message: `SIV ${rows[0]?.siv_ref} has been approved and is ready for posting.`,
      type: 'success',
      route: '/issue-vouchers',
      entityType: 'issue_voucher',
      entityId: req.params.id
    });
  });
  res.json(await fetchWithLines(req.params.id));
});

const post = asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    await assertVoucherStoreAccess(req.user, req.params.id, client);
    await stockService.postIssueVoucher(client, { voucherId: req.params.id, actorName: req.user.name });
    const { rows } = await client.query('SELECT siv_ref, sr_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    const sivRef = rows[0]?.siv_ref;
    const srRef = rows[0]?.sr_ref;
    await notify(client, {
      role: 'Security Officer',
      title: 'Issue Voucher Posted',
      message: `SIV ${sivRef} has been posted and stock movement is complete.`,
      type: 'success',
      route: `/issue-vouchers/${req.params.id}`,
      entityType: 'issue_voucher',
      entityId: req.params.id
    });

    // FULFILLED / COMPLETE: notify the original requester that their requisition was issued.
    if (srRef) {
      const { rows: reqRows } = await client.query('SELECT requested_by FROM requisitions WHERE sr_ref = $1', [srRef]);
      const requestedBy = reqRows[0]?.requested_by;
      if (requestedBy) {
        const { rows: userRows } = await client.query('SELECT id FROM users WHERE name = $1 AND active = true LIMIT 1', [requestedBy]);
        if (userRows[0]) {
          await notify(client, {
            userId: userRows[0].id,
            title: 'Requisition Fulfilled',
            message: `Your requisition ${srRef} has been issued (voucher ${sivRef}) and is now fulfilled.`,
            type: 'success',
            route: '/requisitions',
            entityType: 'requisition',
            entityId: srRef
          });
        }
      }
    }
  });
  res.json(await fetchWithLines(req.params.id));
});

const amend = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    await assertVoucherStoreAccess(req.user, req.params.id, client);
    await stockService.amendIssueVoucher(client, { voucherId: req.params.id, items: req.body.items, reason: req.body.reason, actorName: req.user.name });

    // Amend is the Store Head's revise-and-resubmit step (status -> 'Pending Approval').
    // Persist a notification for the PAO (the authorizer) so the event does not live only in the browser (Phase 5).
    const { rows } = await client.query('SELECT siv_ref FROM issue_vouchers WHERE id = $1', [req.params.id]);
    await notify(client, {
      role: 'Property Administration Officer',
      title: 'Issue Voucher Awaiting Authorization',
      message: `Issue voucher ${rows[0]?.siv_ref} was amended and is pending your authorization.`,
      type: 'info',
      route: '/issue-vouchers',
      entityType: 'issue_voucher',
      entityId: req.params.id
    });

    return fetchWithLines(req.params.id, client);
  });
  res.json(result);
});

module.exports = { list, getOne, create, approve, amend, post };
