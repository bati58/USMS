const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { mapBinTransfer, resolveItemId } = require('./_helpers');
const stockService = require('../services/stockService');

const list = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT bt.*, i.name AS item_name
    FROM bin_transfers bt JOIN items i ON i.id = bt.item_id
    ORDER BY bt.id DESC
  `);
  res.json(rows.map(mapBinTransfer));
});

// POST /api/bin-transfers — Backend-SRS §6.5, immediate effect, no approval step
const create = asyncHandler(async (req, res) => {
  const { item, fromBin, toBin, qty, transferredBy } = req.body;
  if (!item || !fromBin || !toBin || !qty) {
    throw new AppError('item, fromBin, toBin, and qty are required.', 400);
  }

  const result = await withTransaction(async (client) => {
    const itemId = await resolveItemId(item, client);
    if (!itemId) throw new AppError(`Unknown item: "${item}".`, 400);

    const row = await stockService.createBinTransfer(client, {
      itemId,
      fromBin,
      toBin,
      qty,
      transferredBy: transferredBy || req.user.name,
      actorName: req.user.name
    });

    const { rows } = await client.query(
      'SELECT bt.*, i.name AS item_name FROM bin_transfers bt JOIN items i ON i.id = bt.item_id WHERE bt.id = $1',
      [row.id]
    );
    return mapBinTransfer(rows[0]);
  });

  res.status(201).json(result);
});

module.exports = { list, create };
