require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const migrationsDirectory = path.resolve(__dirname, 'migrations');

function migrationFiles() {
    return fs.readdirSync(migrationsDirectory)
        .filter((file) => /^\d+_.+\.sql$/.test(file))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

async function migrate() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

    const { rows } = await pool.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    let pending = 0;

    for (const file of migrationFiles()) {
        const version = file.split('_', 1)[0];
        if (applied.has(version)) continue;
        pending += 1;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [version, file]
            );
            await client.query('COMMIT');
            applied.add(version);
            console.log(`Applied migration ${file}`);
        } catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            throw new Error(`Migration ${file} failed: ${error.message}`);
        } finally {
            client.release();
        }
    }

    if (pending === 0) {
        console.log('No pending migrations.');
    }
}

migrate()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
