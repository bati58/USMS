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
    const { rows: storeRows } = await db.query(
      `SELECT u.id
       FROM store_user_assignments a
       JOIN users u ON u.id = a.user_id
       WHERE a.store_id = $1 AND a.assignment_role = $2 AND a.active = TRUE
         AND u.role = $2 AND u.active = TRUE
       LIMIT 1`,
      [storeId, role]
    );
    if (storeRows[0]) addRecipient(storeRows[0].id);
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

  if (seen.size === 0 && role && !storeId && !department) {
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
      `INSERT INTO notifications (user_id, title, message, type, route, entity_type, entity_id)
       SELECT $1, $2, $3, $4, $5, $6, $7
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1 AND title = $2 AND message = $3 AND type = $4
           AND route = $5 AND entity_type IS NOT DISTINCT FROM $6
           AND entity_id IS NOT DISTINCT FROM $7
       )`,
      [recipient.userId, title, message, type, route, entityType, entityId]
    );
  }
}

module.exports = { notify, resolveNotificationRecipients };
