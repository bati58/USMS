-- Adds requisition workflow fields and performs the one-time legacy backfill.
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Normal';
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS issuing_store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
UPDATE requisitions SET reason = 'Legacy requisition' WHERE reason IS NULL;
ALTER TABLE requisitions ALTER COLUMN reason SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requisitions_department ON requisitions(department_id);
UPDATE requisitions r
SET issuing_store_id = CASE
  WHEN requester.role = 'Storekeeper' THEN main_store.id
  ELSE r.store_id
END
FROM users requester
LEFT JOIN stores main_store ON main_store.type = 'Main Store' AND main_store.active = TRUE
WHERE r.issuing_store_id IS NULL
  AND requester.name = r.requested_by
  AND requester.active = TRUE;
