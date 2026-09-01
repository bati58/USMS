const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { mapDisposal, resolveStoreId, resolveItemId } = require('./_helpers');
const { notify } = require('../utils/notify');
const stockService = require('../services/stockService');

const SELECT = `
  SELECT d.*, s.name AS store_name, i.name AS item_name
  FROM disposals d
  LEFT JOIN stores s ON s.id = d.store_id
  LEFT JOIN items i ON i.id = d.item_id
`;

const list = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = 'WHERE s.name = $1';
    params = [req.user.store];
  }

  const { rows } = await query(`${SELECT} ${scope} ORDER BY d.id DESC`, params);
  res.json(rows.map(mapDisposal));
});

const getOne = asyncHandler(async (req, res) => {
  let scope = '';
  let params = [req.params.id];

  if (req.user.role === 'Store Head' && req.user.store) {
    scope = ' AND s.name = $2';
    params.push(req.user.store);
  }

  const { rows } = await query(`${SELECT} WHERE d.id = $1${scope}`, params);
  if (!rows[0]) throw new AppError('Disposal request not found.', 404);
  res.json(mapDisposal(rows[0]));
});

// POST /api/disposals — Backend-SRS §6.7 step 1 (Pending, no stock change)
const create = asyncHandler(async (req, res) => {
  const { item, store, qty, reason, dateFlagged } = req.body;
  if (!item || !store || !qty) throw new AppError('item, store, and qty are required.', 400);

  const result = await withTransaction(async (client) => {
    const itemId = await resolveItemId(item, client);
    if (!itemId) throw new AppError(`Unknown item: "${item}".`, 400);
    const storeId = await resolveStoreId(store, client);
    const disposalRef = await nextRef(client, 'DSP');

    const { rows } = await client.query(
      `INSERT INTO disposals (disposal_ref, item_id, store_id, qty, reason, date_flagged, status)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),'Pending') RETURNING id`,
      [disposalRef, itemId, storeId, qty, reason || null, dateFlagged || null]
    );

    await logAudit(client, { userName: req.user.name, action: `Flagged ${disposalRef} for disposal`, module: 'Disposal Management' });

    const { rows: full } = await client.query(`${SELECT} WHERE d.id = $1`, [rows[0].id]);
    return mapDisposal(full[0]);
  });

  res.status(201).json(result);
});

const update = asyncHandler(async (req, res) => {
  const { item, store, qty, reason, dateFlagged } = req.body;
  const itemId = item !== undefined ? await resolveItemId(item) : undefined;
  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;

  const { rows } = await query(
    `UPDATE disposals SET
       item_id = COALESCE($1, item_id), store_id = COALESCE($2, store_id),
       qty = COALESCE($3, qty), reason = COALESCE($4, reason),
       date_flagged = COALESCE($5, date_flagged), updated_at = NOW()
     WHERE id = $6 AND status IN ('Pending', 'Flagged', 'Requested', 'Pending Review')
     RETURNING id`,
    [itemId, storeId, qty, reason, dateFlagged, req.params.id]
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
    await stockService.decideDisposal(client, { disposalId: req.params.id, decision, actorName: req.user.name });

    // Phase 5: persist the approval so the executor is notified server-side, not only in the browser.
    if (decision === 'Approved') {
      const { rows } = await client.query('SELECT disposal_ref FROM disposals WHERE id = $1', [req.params.id]);
      await notify(client, {
        role: 'Store Head',
        title: 'Disposal Approved',
        message: `Disposal ${rows[0]?.disposal_ref} was approved and is ready to execute.`,
        type: 'success',
        route: `/disposals/${req.params.id}`,
        entityType: 'disposal',
        entityId: req.params.id
      });
    }
  });

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const execute = asyncHandler(async (req, res) => {
  await withTransaction((client) =>
    stockService.executeDisposal(client, { disposalId: req.params.id, actorName: req.user.name })
  );

  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [req.params.id]);
  res.json(mapDisposal(rows[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows: check } = await query('SELECT status FROM disposals WHERE id = $1', [req.params.id]);
  if (!check[0]) throw new AppError('Disposal request not found.', 404);
  if (!['Pending', 'Flagged', 'Requested', 'Pending Review'].includes(check[0].status)) throw new AppError('Cannot delete a disposal request that has already been processed.', 400);

  const { rows } = await query('DELETE FROM disposals WHERE id = $1 RETURNING disposal_ref', [req.params.id]);
  await logAudit(query, { userName: req.user.name, action: `Deleted disposal ${rows[0].disposal_ref}`, module: 'Disposal Management' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, decide, execute, remove };
