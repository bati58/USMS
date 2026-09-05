const app = require('./app');
const { query, pool } = require('./config/db');
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

async function ensureFixedAssetColumns() {
  await query('ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS source_grn_ref TEXT');
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

async function ensureStoreAssignmentTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS store_user_assignments (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      assignment_role TEXT NOT NULL CHECK (assignment_role IN ('Store Head', 'Storekeeper')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      effective_to DATE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (store_id, user_id, assignment_role),
      CHECK (effective_to IS NULL OR effective_to >= effective_from)
    )
  `);
  await query("CREATE UNIQUE INDEX IF NOT EXISTS uq_active_store_head_assignment ON store_user_assignments(store_id, assignment_role) WHERE active = TRUE AND assignment_role = 'Store Head'");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS uq_active_storekeeper_assignment ON store_user_assignments(store_id, assignment_role) WHERE active = TRUE AND assignment_role = 'Storekeeper'");
  await query('CREATE INDEX IF NOT EXISTS idx_store_assignments_user ON store_user_assignments(user_id, active)');
  await query(`
    INSERT INTO store_user_assignments (store_id, user_id, assignment_role)
    SELECT s.id, u.id, 'Store Head'
    FROM stores s JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
    WHERE s.active = TRUE AND s.head_of_store IS NOT NULL
    ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING
  `);
  await query(`
    INSERT INTO store_user_assignments (store_id, user_id, assignment_role)
    SELECT s.id, u.id, 'Storekeeper'
    FROM stores s JOIN users u ON u.name = s.storekeeper AND u.role = 'Storekeeper' AND u.active = TRUE
    WHERE s.active = TRUE AND s.storekeeper IS NOT NULL
    ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING
  `);
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
    await ensureStoreAssignmentTable();
    await ensureRequisitionColumns();
    await ensureMaterialReturnsColumns();
    await ensureFixedAssetColumns();
    const server = app.listen(PORT, () => {
      console.log(`Stock Management System API listening on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`PostgreSQL connected at ${rows[0].connected_at.toISOString()}`);
    });

    function shutdown(signal) {
      server.close(() => {
        pool.end()
          .then(() => {
            console.log(`Received ${signal}; API server stopped.`);
            process.exit(0);
          })
          .catch((error) => {
            console.error(`Received ${signal}; database pool shutdown failed: ${error.message}`);
            process.exit(1);
          });
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
