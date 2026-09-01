const { query } = require('../config/db');

async function notify(client, { userId, role, title, message, type = 'info', route = '/', entityType = null, entityId = null }) {
  if (userId) {
    await client.query(
      'INSERT INTO notifications (user_id, title, message, type, route, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, title, message, type, route, entityType, entityId]
    );
  } else if (role) {
    await client.query(
      'INSERT INTO notifications (user_id, title, message, type, route, entity_type, entity_id) SELECT id, $1, $2, $3, $4, $5, $6 FROM users WHERE role = $7 AND active = true',
      [title, message, type, route, entityType, entityId, role]
    );
  }
}

module.exports = { notify };
