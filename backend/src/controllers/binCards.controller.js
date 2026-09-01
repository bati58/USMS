const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { mapBinCard } = require('./_helpers');

// Read-only — rows are created/updated as a side effect of stockService.js.
const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT bc.*, s.name AS store_name, i.name AS item_name
    FROM bin_cards bc
    LEFT JOIN stores s ON s.id = bc.store_id
    LEFT JOIN items i ON i.id = bc.item_id
    ORDER BY bc.bin
  `);
  res.json(rows.map(mapBinCard));
});

const movements = asyncHandler(async (req, res) => {
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
