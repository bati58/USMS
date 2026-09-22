const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { mapBinCard, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');

// Read-only — rows are created/updated as a side effect of stockService.js.
const list = asyncHandler(async (req, res) => {
  const visibility = await getUserStoreVisibility(req.user, { query });
  let sql = `
        SELECT bc.*, l.id AS location_id, s.name AS store_name, i.name AS item_name,
          COALESCE(ii.qty_on_hand, i.qty_on_hand) AS item_qty_on_hand
    FROM bin_cards bc
    LEFT JOIN stores s ON s.id = bc.store_id
    LEFT JOIN items i ON i.id = bc.item_id
        LEFT JOIN locations l ON l.store_id = bc.store_id AND LOWER(l.code) = LOWER(bc.bin) AND l.type = 'BIN'
        LEFT JOIN item_inventory ii ON ii.item_id = bc.item_id AND ii.store_id = bc.store_id
  `;
  const params = [];
  const conditions = [];
  if (req.query.itemId) {
    conditions.push(`bc.item_id = $${params.length + 1}`);
    params.push(req.query.itemId);
  }
  if (visibility.storeFilter && !visibility.canViewAllStores) {
    conditions.push(`bc.store_id = $${params.length + 1}`);
    params.push(visibility.storeFilter.id);
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY bc.bin';
  const { rows } = await query(sql, params);
  res.json(rows.map(mapBinCard));
});

const movements = asyncHandler(async (req, res) => {
  const { rows: cardRows } = await query('SELECT store_id FROM bin_cards WHERE id = $1', [req.params.id]);
  if (!cardRows[0]) throw new AppError('Bin card not found.', 404);
  await assertUserCanAccessStoreRecord(req.user, cardRows[0].store_id, { query });
  const { rows } = await query(`
    SELECT bcm.*, i.name AS item_name, s.name AS store_name, bc.bin
    FROM bin_card_movements bcm
    JOIN bin_cards bc ON bc.id = bcm.bin_card_id
    JOIN items i ON i.id = bcm.item_id
    JOIN stores s ON s.id = bcm.store_id
    WHERE bcm.bin_card_id = $1
    ORDER BY bcm.movement_date DESC, bcm.id DESC
  `, [req.params.id]);
  res.json(rows);
});

module.exports = { list, movements };
