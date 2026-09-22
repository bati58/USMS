-- Add store and location identity to bin transfers while preserving legacy
-- bin-code columns for existing records and API responses.

ALTER TABLE bin_transfers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE bin_transfers ADD COLUMN IF NOT EXISTS from_location_id INTEGER REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE bin_transfers ADD COLUMN IF NOT EXISTS to_location_id INTEGER REFERENCES locations(id) ON DELETE RESTRICT;

UPDATE bin_transfers bt
SET store_id = i.store_id
FROM items i
WHERE bt.item_id = i.id
  AND bt.store_id IS NULL
  AND i.store_id IS NOT NULL;

UPDATE bin_transfers bt
SET from_location_id = l.id
FROM locations l
WHERE bt.from_location_id IS NULL
  AND bt.store_id = l.store_id
  AND l.type = 'BIN'
  AND LOWER(l.code) = LOWER(bt.from_bin);

UPDATE bin_transfers bt
SET to_location_id = l.id
FROM locations l
WHERE bt.to_location_id IS NULL
  AND bt.store_id = l.store_id
  AND l.type = 'BIN'
  AND LOWER(l.code) = LOWER(bt.to_bin);

CREATE INDEX IF NOT EXISTS idx_bin_transfers_store
  ON bin_transfers(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bin_transfers_locations
  ON bin_transfers(from_location_id, to_location_id);