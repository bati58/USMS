-- Separate user-facing store category from the operational store type.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE stores
SET category = CASE
  WHEN type = 'Main Store' THEN 'Main Store'
  ELSE COALESCE(NULLIF(category, ''), type)
END
WHERE category IS NULL OR category = '';

UPDATE stores
SET type = CASE WHEN type = 'Main Store' THEN 'Main Store' ELSE 'Other Store' END;

ALTER TABLE stores ALTER COLUMN category SET DEFAULT 'General';
ALTER TABLE stores ALTER COLUMN category SET NOT NULL;