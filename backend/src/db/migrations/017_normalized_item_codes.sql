-- Item codes are institution-wide identifiers; ignore accidental surrounding whitespace.
UPDATE items SET code = BTRIM(code), name = BTRIM(name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_items_normalized_code ON items (LOWER(BTRIM(code)));
