const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  application_name: process.env.PG_APPLICATION_NAME || 'stock-management-api',
  max: Number(process.env.PG_POOL_MAX || 2),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 3000),
  maxUses: Number(process.env.PG_MAX_USES || 500)
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

// Run a callback inside a transaction. The callback receives a client and
// must use it (not the pool) for every query, so all statements share the
// same transaction. Commits on success, rolls back on any thrown error.
async function withTransaction(callback) {
  let client;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      if (err?.code !== '53300' || attempt === 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
