-- Introduce store-level balances without deleting or rewriting legacy item rows.
CREATE TABLE IF NOT EXISTS item_inventory (
  id             SERIAL PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  store_id       INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  location_id    INTEGER REFERENCES locations(id) ON DELETE RESTRICT,
  bin            TEXT,
  qty_on_hand    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  unit_price     NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_level      NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_level      NUMERIC(14,2) NOT NULL DEFAULT 0,
  reorder_level  NUMERIC(14,2) NOT NULL DEFAULT 0,
  expiry_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_date    DATE,
  batch_no       TEXT,
  item_condition TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, store_id)
);

INSERT INTO item_inventory (item_id, store_id, location_id, bin, qty_on_hand, unit_price,
                            min_level, max_level, reorder_level, expiry_tracked, expiry_date,
                            batch_no, item_condition)
SELECT id, store_id, location_id, bin, qty_on_hand, unit_price,
       min_level, max_level, reorder_level, expiry_tracked, expiry_date,
       batch_no, item_condition
FROM items
ON CONFLICT (item_id, store_id) DO NOTHING;

-- Every catalog item must be requestable from Main Store, even when its
-- current Main Store balance is zero.
INSERT INTO item_inventory (item_id, store_id, qty_on_hand, unit_price, min_level, max_level, reorder_level)
SELECT i.id, s.id, 0, i.unit_price, i.min_level, i.max_level, i.reorder_level
FROM items i
JOIN stores s ON s.type = 'Main Store' AND s.active = TRUE
ON CONFLICT (item_id, store_id) DO NOTHING;

-- Categories classify items institution-wide. Keep store_id nullable for old
-- records, but remove its value so new consumers do not treat it as ownership.
UPDATE categories SET store_id = NULL WHERE store_id IS NOT NULL;

ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
UPDATE stock_lots sl SET store_id = i.store_id FROM items i WHERE sl.item_id = i.id AND sl.store_id IS NULL;

-- Collapse legacy per-store copies into one item-master row while preserving
-- every foreign-key reference and the store-specific balances in item_inventory.
CREATE TEMP TABLE item_master_map ON COMMIT DROP AS
SELECT id, MIN(id) OVER (PARTITION BY code) AS canonical_id
FROM items;

UPDATE item_inventory ii
SET item_id = map.canonical_id
FROM item_master_map map
WHERE ii.item_id = map.id AND map.id <> map.canonical_id;

UPDATE goods_receipt_items x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE grn_items x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE stock_transactions x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE bin_cards x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE bin_card_movements x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE requisition_items x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE issue_voucher_items x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE issue_voucher_amendments x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE material_returns x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE material_transfers x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE disposals x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE stock_taking_items x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE user_cards x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;
UPDATE stock_lots x SET item_id = map.canonical_id FROM item_master_map map WHERE x.item_id = map.id AND map.id <> map.canonical_id;

DELETE FROM items i
USING item_master_map map
WHERE i.id = map.id AND map.id <> map.canonical_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_items_institution_code ON items(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_institution_code ON categories(code);