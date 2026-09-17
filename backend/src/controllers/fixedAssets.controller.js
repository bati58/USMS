const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');
const { nextRef } = require('../utils/refGenerator');
const { mapFixedAsset, resolveStoreId, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');

const SELECT = `
  SELECT fa.*, fa.acquisition_date::text AS acquisition_date, s.name AS store_name
  FROM fixed_assets fa
  LEFT JOIN stores s ON s.id = fa.store_id
`;
const ASSET_STATUSES = ['Registered', 'In Store', 'Assigned', 'In Use', 'Maintenance', 'Under Repair', 'Lost', 'Damaged', 'Disposed'];

const list = asyncHandler(async (req, res) => {
  const visibility = await getUserStoreVisibility(req.user, { query });
  let sql = `${SELECT}`;
  const params = [];
  if (visibility.storeFilter && !visibility.canViewAllStores) {
    sql += ' WHERE fa.store_id = $1';
    params.push(visibility.storeFilter.id);
  }
  sql += ' ORDER BY fa.id DESC';
  const { rows } = await query(sql, params);
  res.json(rows.map(mapFixedAsset));
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE fa.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
  res.json(mapFixedAsset(rows[0]));
});

const create = asyncHandler(async (req, res) => {
  const { assetTag, name, category, assignedTo, status, acquisitionDate, value, sourceGrnRef } = req.body;
  if (!sourceGrnRef || !assignedTo) throw new AppError('sourceGrnRef and assignedTo are required.', 400);
  if (status !== undefined && status !== null && !ASSET_STATUSES.includes(status)) {
    throw new AppError(`Invalid fixed asset status: ${status}.`, 400);
  }
  if (value !== undefined && value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new AppError('Asset value must be a valid non-negative number.', 400);
  }

  const result = await withTransaction(async (client) => {
    const { rows: receiptRows } = await client.query(
      `SELECT g.material_type, g.status, g.received_date, g.store_id, s.name AS store_name,
            gri.item_id, i.name AS item_name, c.name AS category_name, gri.unit_price
     FROM goods_receipts g
     JOIN goods_receipt_items gri ON gri.goods_receipt_id = g.id
     JOIN items i ON i.id = gri.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     JOIN stores s ON s.id = g.store_id
     WHERE (g.grn_ref = $1 OR EXISTS (SELECT 1 FROM grns gr WHERE gr.goods_receipt_id = g.id AND gr.grn_number = $1))
       AND ($2::text IS NULL OR i.name = $2)
       AND g.material_type = 'Fixed Asset' AND g.status = 'Posted'
       LIMIT 1`,
      [sourceGrnRef, name || null]
    );
    if (!receiptRows[0]) throw new AppError('Select a posted Fixed Asset GRN before registering the asset.', 400);

    const receipt = receiptRows[0];
    const storeId = receipt.store_id;
    await assertUserCanAccessStoreRecord(req.user, storeId, client);
    const generatedAssetTag = assetTag?.trim() || await nextRef(client, 'FA');

    const { rows } = await client.query(
      `INSERT INTO fixed_assets (asset_tag, name, category, store_id, assigned_to, status, acquisition_date, value, source_grn_ref)
        VALUES ($1,$2,$3,$4,$5,COALESCE($6,'In Store'),$7,COALESCE($8::numeric,$9::numeric),$10) RETURNING id`,
      [generatedAssetTag, name || receipt.item_name, category || receipt.category_name || 'Uncategorized', storeId, assignedTo, status, acquisitionDate || receipt.received_date, value === '' ? null : value, receipt.unit_price, sourceGrnRef]
    );

    await logAudit(client, { userName: req.user.name, action: `Registered asset ${generatedAssetTag}`, module: 'Fixed Assets' });

    const { rows: full } = await client.query(`${SELECT} WHERE fa.id = $1`, [rows[0].id]);
    return mapFixedAsset(full[0]);
  });
  res.status(201).json(result);
});

const update = asyncHandler(async (req, res) => {
  const { assetTag, name, category, store, assignedTo, status, acquisitionDate, value } = req.body;
  if (status !== undefined && status !== null && !ASSET_STATUSES.includes(status)) {
    throw new AppError(`Invalid fixed asset status: ${status}.`, 400);
  }
  if (value !== undefined && value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new AppError('Asset value must be a valid non-negative number.', 400);
  }
  const { rows: currentRows } = await query('SELECT store_id FROM fixed_assets WHERE id = $1', [req.params.id]);
  if (!currentRows[0]) throw new AppError('Fixed asset not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, currentRows[0].store_id, { query });

  // If trying to update store, validate access first
  if (store !== undefined) {
    const storeId = await resolveStoreId(store);
    await assertUserCanAccessStoreRecord(req.user, storeId, { query });
  }

  const storeId = store !== undefined ? await resolveStoreId(store) : undefined;

  const { rows } = await query(
    `UPDATE fixed_assets SET
       asset_tag = COALESCE($1, asset_tag), name = COALESCE($2, name), category = COALESCE($3, category),
       store_id = COALESCE($4, store_id), assigned_to = COALESCE($5, assigned_to),
       status = COALESCE($6, status), acquisition_date = COALESCE($7, acquisition_date),
      value = COALESCE($8::numeric, value), updated_at = NOW()
     WHERE id = $9 RETURNING id`,
    [assetTag, name, category, storeId, assignedTo, status, acquisitionDate, value, req.params.id]
  );
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);

  // Verify access to the retrieved record
  const { rows: current } = await query(`${SELECT} WHERE fa.id = $1`, [rows[0].id]);
  if (current[0]) {
    await assertUserCanAccessStoreRecord(req.user, current[0].store_id, { query });
  }

  await logAudit(query, { userName: req.user.name, action: `Updated asset ${assetTag || rows[0].id}`, module: 'Fixed Assets' });

  const { rows: full } = await query(`${SELECT} WHERE fa.id = $1`, [rows[0].id]);
  res.json(mapFixedAsset(full[0]));
});

const remove = asyncHandler(async (req, res) => {
  const { rows: currentRows } = await query('SELECT store_id FROM fixed_assets WHERE id = $1', [req.params.id]);
  if (!currentRows[0]) throw new AppError('Fixed asset not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, currentRows[0].store_id, { query });
  const { rows } = await query('DELETE FROM fixed_assets WHERE id = $1 RETURNING asset_tag', [req.params.id]);
  if (!rows[0]) throw new AppError('Fixed asset not found.', 404);
  await logAudit(query, { userName: req.user.name, action: `Deleted asset ${rows[0].asset_tag}`, module: 'Fixed Assets' });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
