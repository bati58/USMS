const { query } = require('../config/db');

async function resolveNotificationRecipients({ db = query, userId, role, storeId = null, department = null, userIds = [] } = {}) {
  if (userId) return [{ userId: Number(userId) }];

  const explicitIds = Array.isArray(userIds) ? userIds.map((id) => Number(id)).filter(Boolean) : [];
  if (explicitIds.length) return explicitIds.map((id) => ({ userId: id }));

  if (!role) return [];

  const seen = new Set();
  const addRecipient = (id) => {
    if (id) seen.add(Number(id));
  };

  if (['Store Head', 'Storekeeper'].includes(role) && storeId) {
    const actorColumn = role === 'Store Head' ? 'head_of_store' : 'storekeeper';
    const { rows: storeRows } = await db.query(
      `SELECT ${actorColumn} AS actor_name FROM stores WHERE id = $1 AND active = TRUE LIMIT 1`,
      [storeId]
    );
    const actorName = storeRows[0]?.actor_name;
    if (actorName) {
      const { rows: userRows } = await db.query(
        'SELECT id FROM users WHERE name = $1 AND role = $2 AND active = TRUE LIMIT 1',
        [actorName, role]
      );
      if (userRows[0]) addRecipient(userRows[0].id);
    }
  }

  if (role === 'Department Head' && department) {
    const { rows: deptRows } = await db.query(
      `SELECT u.id
       FROM users u
       JOIN departments d ON d.head_user_id = u.id
       WHERE u.role = $1 AND u.active = TRUE AND d.name = $2 AND d.active = TRUE
       LIMIT 1`,
      [role, department]
    );
    if (deptRows[0]) addRecipient(deptRows[0].id);
  }

  if (seen.size === 0 && role) {
    const { rows } = await db.query(
      'SELECT id FROM users WHERE role = $1 AND active = TRUE ORDER BY id ASC',
      [role]
    );
    rows.forEach((row) => addRecipient(row.id));
  }

  return Array.from(seen).map((userId) => ({ userId }));
}

async function notify(client, { userId, role, title, message, type = 'info', route = '/', entityType = null, entityId = null, storeId = null, department = null, userIds = [] }) {
  const recipients = await resolveNotificationRecipients({ db: client, userId, role, storeId, department, userIds });

  for (const recipient of recipients) {
    await client.query(
      'INSERT INTO notifications (user_id, title, message, type, route, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [recipient.userId, title, message, type, route, entityType, entityId]
    );
  }
}

module.exports = { notify, resolveNotificationRecipients };
