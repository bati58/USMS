-- Introduces relational store assignments and safely backfills legacy names.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS storekeeper TEXT;
CREATE TABLE IF NOT EXISTS store_user_assignments (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignment_role TEXT NOT NULL CHECK (assignment_role IN ('Store Head', 'Storekeeper')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, user_id, assignment_role),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_store_head_assignment
  ON store_user_assignments(store_id, assignment_role)
  WHERE active = TRUE AND assignment_role = 'Store Head';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_storekeeper_assignment
  ON store_user_assignments(store_id, assignment_role)
  WHERE active = TRUE AND assignment_role = 'Storekeeper';
CREATE INDEX IF NOT EXISTS idx_store_assignments_user ON store_user_assignments(user_id, active);
INSERT INTO store_user_assignments (store_id, user_id, assignment_role)
SELECT s.id, u.id, 'Store Head'
FROM stores s JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
WHERE s.active = TRUE AND s.head_of_store IS NOT NULL
ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING;
INSERT INTO store_user_assignments (store_id, user_id, assignment_role)
SELECT s.id, u.id, 'Storekeeper'
FROM stores s JOIN users u ON u.name = s.storekeeper AND u.role = 'Storekeeper' AND u.active = TRUE
WHERE s.active = TRUE AND s.storekeeper IS NOT NULL
ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING;
