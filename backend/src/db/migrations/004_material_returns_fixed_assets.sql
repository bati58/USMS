-- Adds material-return workflow fields and fixed-asset GRN linkage.
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS source_grn_ref TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_approved NUMERIC(14,2);
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_received NUMERIC(14,2);
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_accepted NUMERIC(14,2);
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS qty_rejected NUMERIC(14,2);
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluated_by TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluation_findings TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS evaluation_recommendation TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_by TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_at TIMESTAMP;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_condition TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS receiving_remarks TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_material_returns_store ON material_returns(store_id);
