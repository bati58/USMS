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

async function startServer() {
  try {
    const { rows } = await query('SELECT NOW() AS connected_at');
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
