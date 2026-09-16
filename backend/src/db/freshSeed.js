require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const protectedTables = new Set(['users', 'items', 'stores', 'suppliers']);
const cleanupOrder = [
    'notifications',
    'audit_logs',
    'stock_taking_items',
    'stock_taking_sessions',
    'business_rules',
    'user_cards',
    'requisition_approvals',
    'requisition_items',
    'material_transfers',
    'requisitions',
    'issue_voucher_amendments',
    'issue_voucher_items',
    'issue_vouchers',
    'disposals',
    'material_returns',
    'fixed_assets',
    'grn_items',
    'grns',
    'goods_receipt_items',
    'goods_receipts',
    'stock_lots',
    'stock_transactions',
    'bin_card_movements',
    'bin_cards',
    'bin_transfers',
    'locations',
    'categories',
    'departments',
    'store_user_assignments',
    'ref_sequences'
];

async function getExistingTables(client) {
    const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name
  `);

    return new Set(rows.map((row) => row.table_name));
}

async function countRows(client, tableName) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS total FROM ${tableName}`);
    return Number(rows[0].total || 0);
}

async function runSqlFile(client, fileName) {
    const fullPath = path.resolve(__dirname, fileName);
    const sql = fs.readFileSync(fullPath, 'utf8');
    await client.query(sql);
}

async function getCounts(client, tables) {
    const result = {};
    for (const table of tables) {
        result[table] = await countRows(client, table).catch(() => 0);
    }
    return result;
}

async function main() {
    let client;

    try {
        client = await pool.connect();
        const existingTables = await getExistingTables(client);
        const cleanupTables = cleanupOrder.filter((table) => existingTables.has(table) && !protectedTables.has(table));

        const protectedBefore = await getCounts(client, [...protectedTables].filter((table) => existingTables.has(table)));
        console.log('Protected tables to keep:', Object.entries(protectedBefore).map(([table, count]) => `${table}=${count}`).join(', '));

        await runSqlFile(client, 'schema.sql');

        await client.query('BEGIN');
        try {
            if (existingTables.has('items')) {
                await client.query('UPDATE items SET category_id = NULL, location_id = NULL WHERE category_id IS NOT NULL OR location_id IS NOT NULL');
            }
            if (existingTables.has('users')) {
                await client.query('UPDATE users SET department_id = NULL WHERE department_id IS NOT NULL');
            }

            for (const table of cleanupTables) {
                await client.query(`DELETE FROM ${table}`);
                console.log(`Cleared ${table}`);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }

        await runSqlFile(client, 'seed.sql');

        const protectedAfter = await getCounts(client, [...protectedTables].filter((table) => existingTables.has(table)));
        console.log('Protected tables after cleanup:', Object.entries(protectedAfter).map(([table, count]) => `${table}=${count}`).join(', '));
        console.log('Fresh master-data reseed completed successfully. Protected tables were preserved.');
    } catch (error) {
        console.error('Fresh seed operation failed.');
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        client?.release();
        await pool.end();
    }
}

main();
