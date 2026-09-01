-- =============================================================================
-- Demo seed data — mirrors frontend/src/services/seed.js exactly, so the
-- numbers on screen don't change the moment the frontend is pointed at this
-- real API. Passwords for every seeded user: "sms1234" (bcrypt-hashed below).
-- Run with: npm run db:seed  (after npm run db:schema)
-- =============================================================================

-- Password hash below is bcrypt("sms1234", 10) — same for every demo user.
-- Generate your own with: node -e "console.log(require('bcryptjs').hashSync('sms1234',10))"
-- and replace if you want a different demo password.

INSERT INTO users (name, username, password_hash, role, email, active) VALUES
  ('Abel Tesfaye',   'admin',       '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Administrator', 'admin@sms.local', TRUE),
  ('Meron Getachew', 'pao',         '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Property Administration Officer', 'pao@sms.local', TRUE),
  ('Yonas Bekele',   'storehead',   '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Store Head', 'storehead@sms.local', TRUE),
  ('Sara Alemu',     'storekeeper', '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Storekeeper', 'storekeeper@sms.local', TRUE),
  ('Kaleb Mulugeta', 'clerk',       '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Stock Clerk', 'clerk@sms.local', TRUE),
  ('Dr. Fikru Wolde','tec',         '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Technical Evaluation Committee', 'tec@sms.local', TRUE),
  ('Hana Girma',     'depthead',    '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Department Head', 'depthead@sms.local', TRUE),
  ('Biniam Assefa',  'accountant',  '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Accountant', 'accountant@sms.local', TRUE),
  ('Samuel Tadesse', 'security',    '$2a$10$fF.Qgf.cGWoI8R7KsGJHkuOA42j/R49By3m3JX7MSnhzt1W6w/Ytq', 'Security Officer', 'security@sms.local', TRUE)
ON CONFLICT (username) DO NOTHING;

UPDATE users
SET department = 'Software Engineering', updated_at = NOW()
WHERE username = 'depthead' AND (department IS NULL OR department = '');

-- Technology-university academic departments used by requisitions.
INSERT INTO departments (code, name, active) VALUES
  ('DEPT-CS',   'Computer Science', TRUE),
  ('DEPT-SE',   'Software Engineering', TRUE),
  ('DEPT-ECE',  'Electronics and Communication Engineering', TRUE),
  ('DEPT-PCE',  'Power and Control Engineering', TRUE),
  ('DEPT-ME',   'Mechanical Engineering', TRUE),
  ('DEPT-CHE',  'Chemical Engineering', TRUE),
  ('DEPT-MTE',  'Materials Engineering', TRUE),
  ('DEPT-CE',   'Civil Engineering', TRUE),
  ('DEPT-AM',   'Applied Mathematics', TRUE),
  ('DEPT-AP',   'Applied Physics', TRUE),
  ('DEPT-IE',   'Industrial Engineering', TRUE),
  ('DEPT-PH',   'Pharmacy', TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = NOW();

INSERT INTO stores (name, code, type, location, head_of_store, active) VALUES
  ('Main Store', 'STR-MAIN', 'Main Store', 'Central Warehouse', 'Yonas Bekele', TRUE),
  ('Electrical Engineering Dept. Store', 'STR-EEE', 'Department Store', 'EEE Building', 'Sara Alemu', TRUE),
  ('Mechanical Engineering Dept. Store', 'STR-MEE', 'Department Store', 'MEE Building', 'Kaleb Mulugeta', TRUE),
  ('Chemical Engineering Dept. Store', 'STR-CHE', 'Department Store', 'CHE Building', 'Hana Girma', TRUE),
  ('Cafeteria Store', 'STR-CAF', 'Cafe Store', 'Student Cafeteria', 'Biniam Assefa', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (code, name, store_id, description)
SELECT seed.code, seed.name, seed.store_id, seed.description
FROM (VALUES
  ('4402', 'Office Supplies', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Stationery and general office consumables'),
  ('4405', 'Educational Supplies', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Teaching and laboratory materials'),
  ('4411', 'Research & Development Supplies', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Equipment and materials for R&D labs'),
  ('4414', 'Spare Parts', (SELECT id FROM stores WHERE code='STR-MEE'), 'Workshop and machine spare parts'),
  ('4406', 'Food Items', (SELECT id FROM stores WHERE code='STR-CAF'), 'Cafeteria consumables')
) AS seed(code, name, store_id, description)
WHERE NOT EXISTS (
  SELECT 1 FROM categories existing WHERE existing.code = seed.code
);

INSERT INTO items (code, name, category_id, store_id, bin, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price) VALUES
  ('4402-001-001', 'A4 Photocopy Paper (White)', (SELECT id FROM categories WHERE code='4402' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-MAIN'), 'A-01', 'ream', 50, 500, 100, 320, 220),
  ('4402-002-004', 'Ballpoint Pen (Blue)', (SELECT id FROM categories WHERE code='4402' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-MAIN'), 'A-02', 'box', 20, 200, 40, 18, 150),
  ('4405-001-002', 'Digital Multimeter', (SELECT id FROM categories WHERE code='4405' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-EEE'), 'E-05', 'pcs', 5, 60, 10, 34, 1850),
  ('4411-003-001', 'Arduino Uno R3 Board', (SELECT id FROM categories WHERE code='4411' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-MAIN'), 'B-11', 'pcs', 10, 100, 20, 62, 950),
  ('4414-002-007', 'Ball Bearing 6205-ZZ', (SELECT id FROM categories WHERE code='4414' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-MEE'), 'M-03', 'pcs', 30, 300, 60, 45, 180),
  ('4406-001-005', 'Cooking Oil (5L)', (SELECT id FROM categories WHERE code='4406' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-CAF'), 'C-01', 'litre', 40, 400, 80, 75, 900)
ON CONFLICT (code, store_id) DO NOTHING;

-- Configurable system rules used by the admin settings page and operational UI.
INSERT INTO business_rules (rule_name, rule_category, rule_value, rule_type, description, min_value, max_value, allowed_values)
VALUES
  ('SHELF_LIFE_WARNING_DAYS', 'Inventory', '90', 'integer', 'Number of days before expiry when an item is flagged for attention.', '0', '3650', NULL)
ON CONFLICT (rule_name) DO NOTHING;

-- Seed a FIFO lot for every item matching its current qty_on_hand, so FIFO
-- issuing works correctly from the very first transaction after seeding.
INSERT INTO stock_lots (item_id, received_date, unit_price, qty_received, qty_remaining, source_ref)
SELECT id, CURRENT_DATE - INTERVAL '10 days', unit_price, qty_on_hand, qty_on_hand, 'SEED-OPENING-BALANCE'
FROM items
WHERE NOT EXISTS (
  SELECT 1 FROM stock_lots existing
  WHERE existing.item_id = items.id
    AND existing.source_ref = 'SEED-OPENING-BALANCE'
);

INSERT INTO bin_cards (bin, store_id, item_id, last_movement, balance)
SELECT bin, store_id, id, CURRENT_DATE - INTERVAL '5 days', qty_on_hand FROM items WHERE bin IS NOT NULL
ON CONFLICT (bin, store_id, item_id) DO NOTHING;

-- Approved suppliers/donors. Goods receipts may only reference a registered
-- supplier — the Goods Receipt form offers these as a dropdown.
INSERT INTO suppliers (code, name, contact, address, active) VALUES
  ('SUP-001', 'Ethio Office Supplies PLC',        '+251 11 111 2233', 'Bole, Addis Ababa',    TRUE),
  ('SUP-002', 'National Lab Equipment Importers', '+251 11 445 6677', 'Kirkos, Addis Ababa',  TRUE),
  ('SUP-003', 'Addis Hardware Trading',           '+251 11 889 0011', 'Merkato, Addis Ababa', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO goods_receipts (grn_ref, supplier, supplier_id, po_ref, received_date, received_by, store_id, status, evaluation_note, evaluated_by) VALUES
  ('GRN-2026-0001', 'Ethio Office Supplies PLC',        (SELECT id FROM suppliers WHERE code='SUP-001'), 'PO-2026-014', '2026-08-05', 'Sara Alemu', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Approved', 'Quantity and quality verified against packing slip. Accepted.', 'Dr. Fikru Wolde'),
  ('GRN-2026-0002', 'National Lab Equipment Importers', (SELECT id FROM suppliers WHERE code='SUP-002'), 'PO-2026-021', '2026-08-11', 'Sara Alemu', (SELECT id FROM stores WHERE code='STR-EEE'), 'Under Evaluation', NULL, NULL),
  ('GRN-2026-0003', 'Addis Hardware Trading',           (SELECT id FROM suppliers WHERE code='SUP-003'), 'PO-2026-028', '2026-08-13', 'Kaleb Mulugeta', (SELECT id FROM stores WHERE code='STR-MEE'), 'Pending', NULL, NULL)
ON CONFLICT (grn_ref) DO NOTHING;

INSERT INTO goods_receipt_items (goods_receipt_id, item_id, qty, unit_price) VALUES
  ((SELECT id FROM goods_receipts WHERE grn_ref='GRN-2026-0001' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4402-001-001' ORDER BY id LIMIT 1), 100, 220),
  ((SELECT id FROM goods_receipts WHERE grn_ref='GRN-2026-0002' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4405-001-002' ORDER BY id LIMIT 1), 15, 1850),
  ((SELECT id FROM goods_receipts WHERE grn_ref='GRN-2026-0003' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4414-002-007' ORDER BY id LIMIT 1), 50, 180);

INSERT INTO requisitions (sr_ref, department, requested_by, date, store_id, status) VALUES
  ('SR-2026-0041', 'Electrical Engineering Dept.', 'Hana Girma', '2026-08-10', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Pending'),
  ('SR-2026-0040', 'Mechanical Engineering Dept.', 'Kaleb Mulugeta', '2026-08-08', (SELECT id FROM stores WHERE code='STR-MEE'), 'Approved')
ON CONFLICT (sr_ref) DO NOTHING;

INSERT INTO requisition_items (requisition_id, item_id, qty) VALUES
  ((SELECT id FROM requisitions WHERE sr_ref='SR-2026-0041' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4402-001-001' ORDER BY id LIMIT 1), 10),
  ((SELECT id FROM requisitions WHERE sr_ref='SR-2026-0041' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4402-002-004' ORDER BY id LIMIT 1), 5),
  ((SELECT id FROM requisitions WHERE sr_ref='SR-2026-0040' ORDER BY id LIMIT 1), (SELECT id FROM items WHERE code='4414-002-007' ORDER BY id LIMIT 1), 20);

INSERT INTO fixed_assets (asset_tag, name, category, store_id, assigned_to, status, acquisition_date, value) VALUES
  ('FA-2026-0102', 'HP LaserJet Printer M404', 'Office Equipment', (SELECT id FROM stores WHERE code='STR-MAIN'), 'Registrar Office', 'In Use', '2025-03-10', 18500),
  ('FA-2026-0155', 'Oscilloscope - Tektronix TBS1052B', 'Lab Equipment', (SELECT id FROM stores WHERE code='STR-EEE'), 'EEE Lab 2', 'In Use', '2024-11-02', 62000)
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO material_returns (srn_ref, department, item_id, qty, reason, date, status) VALUES
  ('SRN-2026-0011', 'Chemical Engineering Dept.', (SELECT id FROM items WHERE code='4405-001-002' ORDER BY id LIMIT 1), 2, 'Excess issued quantity', '2026-08-06', 'Pending')
ON CONFLICT (srn_ref) DO NOTHING;

INSERT INTO material_transfers (transfer_ref, from_store_id, to_store_id, item_id, qty, date, status) VALUES
  ('TRF-2026-0007', (SELECT id FROM stores WHERE code='STR-MAIN'), (SELECT id FROM stores WHERE code='STR-EEE'), (SELECT id FROM items WHERE code='4411-003-001' ORDER BY id LIMIT 1), 15, '2026-08-04', 'Approved')
ON CONFLICT (transfer_ref) DO NOTHING;

INSERT INTO disposals (disposal_ref, item_id, store_id, qty, reason, date_flagged, status) VALUES
  ('DSP-2026-0003', (SELECT id FROM items WHERE code='4402-001-001' ORDER BY id LIMIT 1), (SELECT id FROM stores WHERE code='STR-MAIN'), 3, 'Obsolete - beyond economical repair', '2026-07-20', 'Pending')
ON CONFLICT (disposal_ref) DO NOTHING;

INSERT INTO audit_logs (user_name, action, module) VALUES
  ('Sara Alemu', 'Created GRN-2026-0001', 'Goods Receipt'),
  ('Dr. Fikru Wolde', 'Approved evaluation for GRN-2026-0001', 'Technical Evaluation'),
  ('admin', 'Created user account for Biniam Assefa', 'User Management');

-- Seed the reference sequences so the first auto-generated ref after seeding
-- continues from where the demo data leaves off, e.g. next GRN is 0004.
INSERT INTO ref_sequences (prefix, year, next_val) VALUES
  ('GRN', 2026, 4), ('SR', 2026, 42), ('SIV', 2026, 10),
  ('SRN', 2026, 12), ('TRF', 2026, 8), ('DSP', 2026, 4), ('FA', 2026, 156)
ON CONFLICT (prefix, year) DO NOTHING;
