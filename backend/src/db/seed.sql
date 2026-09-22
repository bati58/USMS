-- =============================================================================
-- Role-based demo seed for the refactored architecture.
-- This seed intentionally keeps workflows clean: only base actors, departments,
-- functional stores, assignments, and master/reference data. No operational
-- transactions are created here.
-- Run with: npm run db:seed
-- =============================================================================

INSERT INTO users (name, username, password_hash, role, email, active) VALUES
  ('Abel Tesfaye',   'admin',       '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Administrator', 'admin@sms.local', TRUE),
  ('Meron Getachew', 'pao',         '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Property Administration Officer', 'pao@sms.local', TRUE),
  ('Yonas Bekele',   'storehead',   '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Store Head', 'storehead@sms.local', TRUE),
  ('Sara Alemu',     'storekeeper', '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Storekeeper', 'storekeeper@sms.local', TRUE),
  ('Kaleb Mulugeta', 'clerk',       '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Stock Clerk', 'clerk@sms.local', TRUE),
  ('Dr. Fikru Wolde','tec',         '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Technical Evaluation Committee', 'tec@sms.local', TRUE),
  ('Hana Girma',     'depthead',    '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Department Head', 'depthead@sms.local', TRUE),
  ('Biniam Assefa',  'accountant',  '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Accountant', 'accountant@sms.local', TRUE),
  ('Samuel Tadesse',  'security',    '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Security Officer', 'security@sms.local', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Normalize the legacy Disposal Committee demo account to the canonical login.
UPDATE users
SET name = 'Disposal Committee',
    username = 'disposal',
    email = 'disposal@sms.local',
    role = 'Disposal Committee',
    active = TRUE,
    updated_at = NOW()
WHERE (username = 'bati' OR email = 'batijano58@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'disposal');

INSERT INTO users (name, username, password_hash, role, email, active) VALUES
  ('Disposal Committee', 'disposal', '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq', 'Disposal Committee', 'disposal@sms.local', TRUE)
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Keep the development demo actors on the documented shared password even
-- when the seed is run against an existing database.
UPDATE users
SET password_hash = '$2a$10$KR4J5q./5aeuMqhMNrUZcerIwKfoyFfhPWFI7TAbro.vJ1tuOSrUq',
    failed_login_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE username IN ('admin', 'pao', 'storehead', 'storekeeper', 'clerk', 'tec', 'depthead', 'accountant', 'security', 'disposal');

UPDATE users
SET department = 'Software Engineering', updated_at = NOW()
WHERE username = 'depthead' AND (department IS NULL OR department = '');

-- Department master data: departments remain organizational units, not stores.
INSERT INTO departments (code, name, head_user_id, active, created_at, updated_at)
VALUES
  ('DEPT-SWE', 'Software Engineering', (SELECT id FROM users WHERE username = 'depthead'), TRUE, NOW(), NOW()),
  ('DEPT-CS',  'Computer Science', NULL, TRUE, NOW(), NOW()),
  ('DEPT-MEE', 'Mechanical Engineering', NULL, TRUE, NOW(), NOW()),
  ('DEPT-CHE', 'Chemical Engineering', NULL, TRUE, NOW(), NOW()),
  ('DEPT-CIV', 'Civil Engineering', NULL, TRUE, NOW(), NOW()),
  ('DEPT-EEE', 'Electrical Engineering', NULL, TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  head_user_id = EXCLUDED.head_user_id,
  active = EXCLUDED.active,
  updated_at = NOW();

UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.username = 'depthead'
  AND d.code = 'DEPT-SWE';

-- Functional stores following the refactored store model.
INSERT INTO stores (name, code, type, category, location, description, contact_info, active, created_at, updated_at)
VALUES
  ('Main Store', 'STR-MAIN', 'Main Store', 'Main', 'Central Warehouse', 'Institutional receiving and distribution store.', 'Warehouse Office', TRUE, NOW(), NOW()),
  ('Department Store', 'STR-DEPT', 'Other Store', 'Department', 'Academic Building Store', 'Shared departmental inventory serving academic units.', 'Academic Store Office', TRUE, NOW(), NOW()),
  ('Laboratory Store', 'STR-LAB', 'Other Store', 'Laboratory', 'Science Complex Lab Area', 'Central laboratory materials and consumables store.', 'Lab Services Office', TRUE, NOW(), NOW()),
  ('Cafe Store', 'STR-CAF', 'Other Store', 'Cafe', 'Student Center', 'Catering and cafeteria consumables store.', 'Cafeteria Office', TRUE, NOW(), NOW()),
  ('Specialized Store', 'STR-SPEC', 'Other Store', 'Specialized', 'Service Block', 'Specialized maintenance and facilities materials.', 'Facilities Office', TRUE, NOW(), NOW()),
  ('Pharmacy Store', 'STR-PHA', 'Other Store', 'Pharmacy', 'Health Services Building', 'Medicines and health supplies with expiry tracking.', 'Pharmacy Office', TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  description = EXCLUDED.description,
  contact_info = EXCLUDED.contact_info,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Store assignments follow the actual role-per-store model.
INSERT INTO store_user_assignments (store_id, user_id, assignment_role, active, effective_from, updated_at)
SELECT s.id, u.id, 'Store Head', TRUE, CURRENT_DATE, NOW()
FROM stores s
JOIN users u ON u.username = 'storehead'
WHERE s.code IN ('STR-MAIN', 'STR-DEPT', 'STR-LAB', 'STR-CAF', 'STR-SPEC', 'STR-PHA')
ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING;

INSERT INTO store_user_assignments (store_id, user_id, assignment_role, active, effective_from, updated_at)
SELECT s.id, u.id, 'Storekeeper', TRUE, CURRENT_DATE, NOW()
FROM stores s
JOIN users u ON u.username = 'storekeeper'
WHERE s.code IN ('STR-MAIN', 'STR-DEPT', 'STR-LAB', 'STR-CAF', 'STR-SPEC', 'STR-PHA')
ON CONFLICT (store_id, user_id, assignment_role) DO NOTHING;

-- Shared master data.
INSERT INTO suppliers (code, name, contact, address, active, created_at, updated_at)
VALUES
  ('SUP-001', 'Ethio Office Supplies PLC', '+251 11 111 2233', 'Bole, Addis Ababa', TRUE, NOW(), NOW()),
  ('SUP-002', 'National Lab Equipment Importers', '+251 11 445 6677', 'Kirkos, Addis Ababa', TRUE, NOW(), NOW()),
  ('SUP-003', 'Addis Hardware Trading', '+251 11 889 0011', 'Merkato, Addis Ababa', TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  contact = EXCLUDED.contact,
  address = EXCLUDED.address,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO categories (code, name, store_id, description, active, created_at, updated_at)
SELECT v.code, v.name, v.store_id, v.description, v.active, NOW(), NOW()
FROM (VALUES
  ('CAT-ADM', 'Office Supplies', NULL, 'General office consumables', TRUE),
  ('CAT-ACC', 'Academic Supplies', NULL, 'General academic classroom and lab support materials', TRUE),
  ('CAT-LAB', 'Laboratory Materials', NULL, 'Scientific consumables and lab reagents', TRUE),
  ('CAT-CAF', 'Catering Supplies', NULL, 'Food service and kitchen materials', TRUE),
  ('CAT-FAC', 'Maintenance Materials', NULL, 'Facilities and repair materials', TRUE),
  ('CAT-PHA', 'Pharmacy Supplies', NULL, 'Medicines and health supplies tracked by expiry date', TRUE)
) AS v(code, name, store_id, description, active)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.code = v.code
);

UPDATE categories
SET name = CASE WHEN name IS NULL OR name = '' THEN 'Updated Category' ELSE name END,
    description = CASE WHEN description IS NULL OR description = '' THEN 'General category' ELSE description END,
    updated_at = NOW()
WHERE code IN ('CAT-ADM', 'CAT-ACC', 'CAT-LAB', 'CAT-CAF', 'CAT-FAC', 'CAT-PHA');

INSERT INTO items (code, name, category_id, store_id, bin, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price, expiry_tracked, expiry_date, batch_no, created_at, updated_at)
VALUES
  ('ITM-001', 'A4 Photocopy Paper', (SELECT id FROM categories WHERE code = 'CAT-ADM'), (SELECT id FROM stores WHERE code = 'STR-MAIN'), 'A-01', 'ream', 50, 500, 100, 0, 220, NOW(), NOW()),
  ('ITM-002', 'Marker Pen Set', (SELECT id FROM categories WHERE code = 'CAT-ADM'), (SELECT id FROM stores WHERE code = 'STR-MAIN'), 'A-02', 'box', 20, 100, 30, 0, 150, NOW(), NOW()),
  ('ITM-003', 'Lab Reagent Bottles', (SELECT id FROM categories WHERE code = 'CAT-LAB'), (SELECT id FROM stores WHERE code = 'STR-LAB'), 'LAB-01', 'bottle', 10, 80, 20, 0, 480, TRUE, CURRENT_DATE + INTERVAL '180 days', 'LAB-2026-001', NOW(), NOW()),
  ('ITM-004', 'Rice 25kg', (SELECT id FROM categories WHERE code = 'CAT-CAF'), (SELECT id FROM stores WHERE code = 'STR-CAF'), 'CAF-01', 'bag', 15, 120, 25, 0, 450, TRUE, CURRENT_DATE + INTERVAL '120 days', 'CAF-2026-001', NOW(), NOW()),
  ('ITM-005', 'PVC Pipe 2 inch', (SELECT id FROM categories WHERE code = 'CAT-FAC'), (SELECT id FROM stores WHERE code = 'STR-SPEC'), 'SPEC-01', 'pcs', 12, 90, 20, 0, 360, FALSE, NULL, NULL, NOW(), NOW()),
  ('PHA-001', 'Paracetamol 500mg Tablets', (SELECT id FROM categories WHERE code = 'CAT-PHA'), (SELECT id FROM stores WHERE code = 'STR-PHA'), 'PHA-01', 'box', 20, 200, 40, 0, 85, TRUE, CURRENT_DATE + INTERVAL '365 days', 'PHA-2026-001', NOW(), NOW())
ON CONFLICT (code, store_id) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  bin = EXCLUDED.bin,
  unit = EXCLUDED.unit,
  min_level = EXCLUDED.min_level,
  max_level = EXCLUDED.max_level,
  reorder_level = EXCLUDED.reorder_level,
  unit_price = EXCLUDED.unit_price,
  expiry_tracked = EXCLUDED.expiry_tracked,
  expiry_date = EXCLUDED.expiry_date,
  batch_no = EXCLUDED.batch_no,
  qty_on_hand = EXCLUDED.qty_on_hand,
  updated_at = NOW();

INSERT INTO item_inventory (item_id, store_id, bin, qty_on_hand, unit_price, min_level, max_level, reorder_level, expiry_tracked, expiry_date, batch_no)
SELECT i.id, i.store_id, i.bin, i.qty_on_hand, i.unit_price, i.min_level, i.max_level, i.reorder_level, i.expiry_tracked, i.expiry_date, i.batch_no
FROM items i
ON CONFLICT (item_id, store_id) DO UPDATE SET
  bin = EXCLUDED.bin,
  qty_on_hand = EXCLUDED.qty_on_hand,
  unit_price = EXCLUDED.unit_price,
  min_level = EXCLUDED.min_level,
  max_level = EXCLUDED.max_level,
  reorder_level = EXCLUDED.reorder_level,
  expiry_tracked = EXCLUDED.expiry_tracked,
  expiry_date = EXCLUDED.expiry_date,
  batch_no = EXCLUDED.batch_no,
  updated_at = NOW();

INSERT INTO item_inventory (item_id, store_id, qty_on_hand, unit_price, min_level, max_level, reorder_level)
SELECT i.id, s.id, 0, i.unit_price, i.min_level, i.max_level, i.reorder_level
FROM items i
JOIN stores s ON s.code = 'STR-MAIN'
ON CONFLICT (item_id, store_id) DO NOTHING;

-- Department-specific storage is represented with locations/bins under Department Store.
INSERT INTO locations (store_id, parent_id, type, code, name, active, created_at, updated_at)
VALUES
  ((SELECT id FROM stores WHERE code = 'STR-DEPT'), NULL, 'SECTION', 'DEP-SEC-01', 'Software Engineering Section', TRUE, NOW(), NOW()),
  ((SELECT id FROM stores WHERE code = 'STR-DEPT'), (SELECT id FROM locations WHERE store_id = (SELECT id FROM stores WHERE code = 'STR-DEPT') AND code = 'DEP-SEC-01'), 'BIN', 'DEP-SWE-01', 'SWE-01', TRUE, NOW(), NOW()),
  ((SELECT id FROM stores WHERE code = 'STR-DEPT'), (SELECT id FROM locations WHERE store_id = (SELECT id FROM stores WHERE code = 'STR-DEPT') AND code = 'DEP-SEC-01'), 'BIN', 'DEP-SWE-02', 'SWE-02', TRUE, NOW(), NOW()),
  ((SELECT id FROM stores WHERE code = 'STR-DEPT'), NULL, 'SECTION', 'DEP-SEC-02', 'Mechanical Engineering Section', TRUE, NOW(), NOW()),
  ((SELECT id FROM stores WHERE code = 'STR-DEPT'), (SELECT id FROM locations WHERE store_id = (SELECT id FROM stores WHERE code = 'STR-DEPT') AND code = 'DEP-SEC-02'), 'BIN', 'DEP-MEE-01', 'MEE-01', TRUE, NOW(), NOW())
ON CONFLICT (store_id, parent_id, code) DO NOTHING;

-- Keep the business-rule seed aligned with the refactor architecture.
INSERT INTO business_rules (rule_name, rule_category, rule_value, rule_type, description, min_value, max_value, allowed_values, is_active, updated_by, updated_at, created_at)
VALUES
  ('SHELF_LIFE_WARNING_DAYS', 'Inventory', '90', 'integer', 'Days before expiry when an item is flagged for attention.', '0', '3650', NULL, TRUE, 'admin', NOW(), NOW())
ON CONFLICT (rule_name) DO UPDATE SET
  rule_value = EXCLUDED.rule_value,
  rule_type = EXCLUDED.rule_type,
  description = EXCLUDED.description,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  allowed_values = EXCLUDED.allowed_values,
  is_active = EXCLUDED.is_active,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- Reference sequences start from a clean baseline for future operational entries.
INSERT INTO ref_sequences (prefix, year, next_val)
VALUES
  ('GRN', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('SR', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('SIV', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('SRN', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('TRF', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('DSP', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1),
  ('FA', EXTRACT(YEAR FROM CURRENT_DATE)::int, 1)
ON CONFLICT (prefix, year) DO NOTHING;
