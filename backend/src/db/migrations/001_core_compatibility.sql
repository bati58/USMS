-- Adds columns introduced after the original baseline without deleting data.
ALTER TABLE items ADD COLUMN IF NOT EXISTS expiry_tracked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT 'Consumable';
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS supporting_document_ref TEXT;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS condition_on_arrival TEXT NOT NULL DEFAULT 'New';
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_supplier ON goods_receipts(supplier_id);
