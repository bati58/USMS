// Insert one audit_logs row. Accepts either the pool or a transaction
// client as `db` so it can be called from inside a withTransaction block
// and share the same transaction (Backend-SRS §6.10 requires every
// state-changing action to log — this must never silently fail separately
// from the action it's logging).
async function logAudit(db, { userId, userName, userRole, action, module, entityType, entityId, entityReference, description, outcome = 'SUCCESS', beforeData = {}, afterData = {}, changes = [], metadata = {} }) {
  const execute = typeof db === 'function' ? db : db.query.bind(db);
  await execute(
    `INSERT INTO audit_logs
      (actor_id, user_name, actor_role, action, module, entity_type, entity_id, entity_reference, description, outcome, before_data, after_data, changes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [userId || null, userName || 'System', userRole || null, action, module, entityType || null, entityId || null, entityReference || null, description || action, outcome, beforeData, afterData, changes, metadata]
  );
}

module.exports = { logAudit };
