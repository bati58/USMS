-- Material transfers are Main Store dispatches received into a destination
-- store BIN. Keep destination_bin as a display compatibility field.

ALTER TABLE material_transfers
  ADD COLUMN IF NOT EXISTS destination_location_id INTEGER REFERENCES locations(id) ON DELETE RESTRICT;

UPDATE material_transfers mt
SET destination_location_id = l.id
FROM locations l
WHERE mt.destination_location_id IS NULL
  AND mt.to_store_id = l.store_id
  AND l.type = 'BIN'
  AND LOWER(l.code) = LOWER(mt.destination_bin)
  AND mt.destination_bin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_transfers_destination_location
  ON material_transfers(destination_location_id);