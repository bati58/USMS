-- Add a Pharmacy Store demo record and expiry-tracked stock for development.
INSERT INTO stores (name, code, type, category, location, description, contact_info, active, created_at, updated_at)
VALUES ('Pharmacy Store', 'STR-PHA', 'Other Store', 'Pharmacy', 'Health Services Building', 'Medicines and health supplies with expiry tracking.', 'Pharmacy Office', TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  description = EXCLUDED.description,
  contact_info = EXCLUDED.contact_info,
  active = EXCLUDED.active,
  updated_at = NOW();

UPDATE store_user_assignments
SET active = FALSE, effective_to = CURRENT_DATE, updated_at = NOW()
WHERE store_id = (SELECT id FROM stores WHERE code = 'STR-PHA')
  AND assignment_role IN ('Store Head', 'Storekeeper')
  AND active = TRUE;

INSERT INTO store_user_assignments (store_id, user_id, assignment_role, active, effective_from, updated_at)
SELECT s.id, u.id, 'Store Head', TRUE, CURRENT_DATE, NOW()
FROM stores s JOIN users u ON u.username = 'storehead'
WHERE s.code = 'STR-PHA'
ON CONFLICT (store_id, user_id, assignment_role) DO UPDATE SET
  active = TRUE,
  effective_to = NULL,
  updated_at = NOW();

INSERT INTO store_user_assignments (store_id, user_id, assignment_role, active, effective_from, updated_at)
SELECT s.id, u.id, 'Storekeeper', TRUE, CURRENT_DATE, NOW()
FROM stores s JOIN users u ON u.username = 'storekeeper'
WHERE s.code = 'STR-PHA'
ON CONFLICT (store_id, user_id, assignment_role) DO UPDATE SET
  active = TRUE,
  effective_to = NULL,
  updated_at = NOW();

INSERT INTO categories (code, name, store_id, description, active, created_at, updated_at)
VALUES ('CAT-PHA', 'Pharmacy Supplies', NULL, 'Medicines and health supplies tracked by expiry date', TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO items (code, name, category_id, store_id, bin, unit, min_level, max_level, reorder_level, qty_on_hand, unit_price, expiry_tracked, expiry_date, batch_no, created_at, updated_at)
SELECT 'PHA-001', 'Paracetamol 500mg Tablets', c.id, s.id, 'PHA-01', 'box', 20, 200, 40, 0, 85, TRUE, CURRENT_DATE + INTERVAL '365 days', 'PHA-2026-001', NOW(), NOW()
FROM categories c
JOIN stores s ON s.code = 'STR-PHA'
WHERE c.code = 'CAT-PHA'
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
  updated_at = NOW();

INSERT INTO item_inventory (item_id, store_id, bin, qty_on_hand, unit_price, min_level, max_level, reorder_level, expiry_tracked, expiry_date, batch_no)
SELECT i.id, i.store_id, i.bin, i.qty_on_hand, i.unit_price, i.min_level, i.max_level, i.reorder_level, i.expiry_tracked, i.expiry_date, i.batch_no
FROM items i
WHERE i.code = 'PHA-001' AND i.store_id = (SELECT id FROM stores WHERE code = 'STR-PHA')
ON CONFLICT (item_id, store_id) DO UPDATE SET
  bin = EXCLUDED.bin,
  unit_price = EXCLUDED.unit_price,
  min_level = EXCLUDED.min_level,
  max_level = EXCLUDED.max_level,
  reorder_level = EXCLUDED.reorder_level,
  expiry_tracked = EXCLUDED.expiry_tracked,
  expiry_date = EXCLUDED.expiry_date,
  batch_no = EXCLUDED.batch_no,
  updated_at = NOW();
