const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { mapBinCard, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');

// Read-only — rows are created/updated as a side effect of stockService.js.
const list = asyncHandler(async (req, res) => {
  const visibility = await getUserStoreVisibility(req.user, { query });
  let sql = `
    SELECT bc.*, s.name AS store_name, i.name AS item_name
    FROM bin_cards bc
    LEFT JOIN stores s ON s.id = bc.store_id
    LEFT JOIN items i ON i.id = bc.item_id
  `;
  const params = [];
  if (visibility.storeFilter && !visibility.canViewAllStores) {
    sql += ' WHERE bc.store_id = $1';
    params.push(visibility.storeFilter.id);
  }
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
