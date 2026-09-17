const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const hasDatabase = Boolean(process.env.DATABASE_URL);

test('institution item master has store-level inventory coverage', { skip: !hasDatabase }, async () => {
    const { pool } = require('../src/config/db');
    try {
        const { rows: duplicateCodes } = await pool.query(
            'SELECT code FROM items GROUP BY code HAVING COUNT(*) > 1'
        );
        const { rows: missingMainInventory } = await pool.query(
            `SELECT i.id
       FROM items i
       WHERE NOT EXISTS (
         SELECT 1
         FROM item_inventory ii
         JOIN stores s ON s.id = ii.store_id
         WHERE ii.item_id = i.id AND s.type = 'Main Store'
       )`
        );
        const { rows: storeBoundCategories } = await pool.query(
            'SELECT id FROM categories WHERE store_id IS NOT NULL'
        );
        const { rows: inventoryRows } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM item_inventory'
        );

        assert.equal(duplicateCodes.length, 0);
        assert.equal(missingMainInventory.length, 0);
        assert.equal(storeBoundCategories.length, 0);
        assert.ok(Number(inventoryRows[0].count) >= 1);
    } finally {
        await pool.end();
    }
});
