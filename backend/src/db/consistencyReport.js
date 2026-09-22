require('dotenv').config();

const { pool } = require('../config/db');

const checks = [
    {
        name: 'duplicate_item_codes',
        sql: `
            SELECT code, COUNT(*)::int AS record_count, ARRAY_AGG(id ORDER BY id) AS item_ids
            FROM items
            GROUP BY code
            HAVING COUNT(*) > 1
            ORDER BY code
        `
    },
    {
        name: 'duplicate_category_codes',
        sql: `
            SELECT code, COUNT(*)::int AS record_count, ARRAY_AGG(id ORDER BY id) AS category_ids
            FROM categories
            GROUP BY code
            HAVING COUNT(*) > 1
            ORDER BY code
        `
    },
    {
        name: 'items_without_main_store_inventory',
        sql: `
            SELECT i.id, i.code, i.name
            FROM items i
            WHERE NOT EXISTS (
                SELECT 1
                FROM item_inventory ii
                JOIN stores s ON s.id = ii.store_id
                WHERE ii.item_id = i.id
                  AND s.type = 'Main Store'
                  AND s.active = TRUE
            )
            ORDER BY i.id
        `
    },
    {
        name: 'locations_with_cross_store_parent',
        sql: `
            SELECT child.id, child.code, child.store_id, child.parent_id, parent.store_id AS parent_store_id
            FROM locations child
            JOIN locations parent ON parent.id = child.parent_id
            WHERE child.store_id <> parent.store_id
            ORDER BY child.id
        `
    },
    {
        name: 'inventory_with_cross_store_location',
        sql: `
            SELECT ii.id, ii.item_id, ii.store_id, ii.location_id, l.store_id AS location_store_id
            FROM item_inventory ii
            JOIN locations l ON l.id = ii.location_id
            WHERE ii.store_id <> l.store_id
            ORDER BY ii.id
        `
    },
    {
        name: 'bin_totals_not_matching_store_inventory',
        sql: `
            SELECT ii.item_id, ii.store_id, ii.qty_on_hand AS store_qty,
                   COALESCE(SUM(bc.balance), 0) AS bin_qty
            FROM item_inventory ii
            LEFT JOIN bin_cards bc
              ON bc.item_id = ii.item_id
             AND bc.store_id = ii.store_id
            GROUP BY ii.item_id, ii.store_id, ii.qty_on_hand
            HAVING COALESCE(SUM(bc.balance), 0) <> ii.qty_on_hand
            ORDER BY ii.store_id, ii.item_id
        `
    },
    {
        name: 'fifo_totals_above_store_inventory',
        sql: `
            SELECT ii.item_id, ii.store_id, ii.qty_on_hand AS store_qty,
                   COALESCE(SUM(sl.qty_remaining), 0) AS fifo_qty
            FROM item_inventory ii
            LEFT JOIN stock_lots sl
              ON sl.item_id = ii.item_id
             AND sl.store_id = ii.store_id
            GROUP BY ii.item_id, ii.store_id, ii.qty_on_hand
            HAVING COALESCE(SUM(sl.qty_remaining), 0) > ii.qty_on_hand
            ORDER BY ii.store_id, ii.item_id
        `
    }
];

async function main() {
    const report = {};

    try {
        for (const check of checks) {
            const { rows } = await pool.query(check.sql);
            report[check.name] = rows;
        }

        console.log(JSON.stringify({
            generatedAt: new Date().toISOString(),
            checks: report
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(`Consistency report failed: ${error.message}`);
    process.exitCode = 1;
});