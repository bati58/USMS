-- Establish Phase 1 Item Master and store-inventory invariants.
-- Legacy store-specific columns remain until all application references migrate.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM items
    GROUP BY code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce global item codes: duplicate item codes require manual review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM categories
    GROUP BY code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce global category codes: duplicate category codes require manual review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM item_inventory ii
    JOIN locations l ON l.id = ii.location_id
    WHERE ii.store_id <> l.store_id
  ) THEN
    RAISE EXCEPTION 'Cannot enforce inventory location ownership: cross-store inventory locations require review';
  END IF;
END $$;

ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE categories
SET store_id = NULL
WHERE store_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_items_institution_code
  ON items(code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_institution_code
  ON categories(code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_id_store
  ON locations(id, store_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_inventory_location_store_fkey'
  ) THEN
    ALTER TABLE item_inventory
      ADD CONSTRAINT item_inventory_location_store_fkey
      FOREIGN KEY (location_id, store_id)
      REFERENCES locations (id, store_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Every global item remains available to the Main Store catalog, even when
-- its current balance is zero.
INSERT INTO item_inventory (item_id, store_id, qty_on_hand, unit_price, min_level, max_level, reorder_level)
SELECT i.id, s.id, 0, i.unit_price, i.min_level, i.max_level, i.reorder_level
FROM items i
JOIN stores s ON s.type = 'Main Store' AND s.active = TRUE
ON CONFLICT (item_id, store_id) DO NOTHING;