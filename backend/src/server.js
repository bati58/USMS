const app = require('./app');
const { query, pool } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    const { rows } = await query('SELECT NOW() AS connected_at');
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
    await pool.end().catch((shutdownError) => {
      console.error(`Database pool cleanup failed: ${shutdownError.message}`);
    });
    process.exitCode = 1;
  }
}

startServer();
