const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { mapStockTransaction } = require('./_helpers');

// Read-only — every row here is created as a side effect of stockService.js,
// never directly (Backend-SRS §4.2). Supports ?item=<name> filtering, used
// by the Stock Card detail view.
const list = asyncHandler(async (req, res) => {
  const { item } = req.query;
  let sql = `
    SELECT st.*, i.name AS item_name, s.name AS store_name
    FROM stock_transactions st
    JOIN items i ON i.id = st.item_id
    LEFT JOIN stores s ON s.id = st.store_id
  `;
  const params = [];
  if (item) {
    sql += ' WHERE i.name = $1';
    params.push(item);
  }
  sql += ' ORDER BY st.date DESC, st.id DESC';

  const { rows } = await query(sql, params);
  res.json(rows.map(mapStockTransaction));
});

module.exports = { list };
