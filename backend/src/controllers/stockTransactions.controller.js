const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { mapStockTransaction, getUserStoreVisibility } = require('./_helpers');

// Read-only — every row here is created as a side effect of stockService.js,
// never directly (Backend-SRS §4.2). Supports ?item=<name> filtering, used
// by the Stock Card detail view.
const list = asyncHandler(async (req, res) => {
  const visibility = await getUserStoreVisibility(req.user, { query });
  const { item } = req.query;
  let sql = `
    SELECT st.*, i.name AS item_name, s.name AS store_name
    FROM stock_transactions st
    JOIN items i ON i.id = st.item_id
    LEFT JOIN stores s ON s.id = st.store_id
  `;
  const params = [];
  const conditions = [];
  if (item) {
    conditions.push(`i.name = $${params.length + 1}`);
    params.push(item);
  }
  if (visibility.storeFilter && !visibility.canViewAllStores) {
    conditions.push(`st.store_id = $${params.length + 1}`);
    params.push(visibility.storeFilter.id);
  }
  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY st.date DESC, st.id DESC';

  const { rows } = await query(sql, params);
  res.json(rows.map(mapStockTransaction));
});

module.exports = { list };
