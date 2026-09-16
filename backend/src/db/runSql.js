// Tiny helper to run a .sql file against DATABASE_URL.
// Usage: node src/db/runSql.js src/db/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node src/db/runSql.js <path-to-sql-file>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await pool.query(sql);
    console.log(`Ran ${file} successfully.`);
  } catch (error) {
    console.error(`Failed running ${file}:`, error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
