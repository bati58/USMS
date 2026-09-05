const app = require('./app');
const { query } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

async function ensureMaterialReturnsColumns() {
  const statements = [
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_approved NUMERIC(14,2)',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_received NUMERIC(14,2)',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_accepted NUMERIC(14,2)',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_rejected NUMERIC(14,2)',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluated_by TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluation_findings TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluation_recommendation TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_by TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_at TIMESTAMP',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_condition TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_remarks TEXT',
    'ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS rejection_reason TEXT'
  ];

  for (const statement of statements) {
    await query(statement);
  }
}

async function ensureStoreColumns() {
  const statements = [
    'ALTER TABLE stores ADD COLUMN IF NOT EXISTS department TEXT',
    'ALTER TABLE stores ADD COLUMN IF NOT EXISTS storekeeper TEXT'
  ];

  for (const statement of statements) {
    await query(statement);
  }
}

async function ensureRequisitionColumns() {
  await query('ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS issuing_store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT');
  await query(`
    UPDATE requisitions r
    SET issuing_store_id = CASE
      WHEN requester.role = 'Storekeeper' THEN main_store.id
      ELSE r.store_id
    END
    FROM users requester
    LEFT JOIN stores main_store ON main_store.type = 'Main Store' AND main_store.active = TRUE
    WHERE r.issuing_store_id IS NULL
      AND requester.name = r.requested_by
      AND requester.active = TRUE
  `);
}

async function startServer() {
  try {
    const { rows } = await query('SELECT NOW() AS connected_at');
    await ensureStoreColumns();
    await ensureRequisitionColumns();
    await ensureMaterialReturnsColumns();
    const server = app.listen(PORT, () => {
      console.log(`Stock Management System API listening on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`PostgreSQL connected at ${rows[0].connected_at.toISOString()}`);
    });

    function shutdown(signal) {
      server.close(() => {
        console.log(`Received ${signal}; API server stopped.`);
        process.exit(0);
      });
    }

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Unable to connect to PostgreSQL. The API was not started.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

startServer();
