-- =============================================================================
-- Stock Management System — PostgreSQL schema (consolidated)
-- Run with:  npm run db:schema
-- =============================================================================

-- ---------- Reference number sequences (§6.8) ----------
CREATE TABLE IF NOT EXISTS ref_sequences (
  prefix    TEXT PRIMARY KEY,
  year      INTEGER NOT NULL,
  next_val  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (prefix, year)
);

-- ---------- users (§5.1) ----------
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  username              TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL,
  email                 TEXT,
  department            TEXT,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- stores (§5.2) ----------
CREATE TABLE IF NOT EXISTS stores (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL,
  location       TEXT,
  head_of_store  TEXT,
  description    TEXT,
  contact_info   TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- categories (§5.3) ----------
CREATE TABLE IF NOT EXISTS categories (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  store_id     INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- items (§5.4) ----------
CREATE TABLE IF NOT EXISTS items (
  id             SERIAL PRIMARY KEY,
  code           TEXT NOT NULL,
  name           TEXT NOT NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  store_id       INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  bin            TEXT,
  unit           TEXT NOT NULL,
  min_level      NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_level      NUMERIC(14,2) NOT NULL DEFAULT 0,
  reorder_level  NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty_on_hand    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  unit_price     NUMERIC(14,2) NOT NULL DEFAULT 0,
  expiry_date    DATE,
  batch_no       TEXT,
  item_condition TEXT,
  location_id    INTEGER,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (code, store_id)
);
CREATE INDEX IF NOT EXISTS idx_items_store ON items(store_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);

-- ---------- structured store locations ----------
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  parent_id   INTEGER REFERENCES locations(id) ON DELETE RESTRICT,
  type        TEXT NOT NULL CHECK (type IN ('SECTION', 'RACK', 'SHELF', 'BIN')),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, parent_id, code)
);
CREATE INDEX IF NOT EXISTS idx_locations_store ON locations(store_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);

-- Add FK for items.location_id after locations table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_location_id_fkey') THEN
    ALTER TABLE items ADD CONSTRAINT items_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------- suppliers ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  contact      TEXT,
  address      TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ---------- departments ----------
CREATE TABLE IF NOT EXISTS departments (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL UNIQUE,
  head_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- ---------- goods_receipts + line items (§5.5, §5.11) ----------
CREATE TABLE IF NOT EXISTS goods_receipts (
  id                        SERIAL PRIMARY KEY,
  grn_ref                   TEXT NOT NULL UNIQUE,
  supplier                  TEXT NOT NULL,
  supplier_id               INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  po_ref                    TEXT,
  received_date             DATE NOT NULL,
  received_by               TEXT,
  store_id                  INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status                    TEXT NOT NULL DEFAULT 'Pending'
                              CHECK (status IN ('Draft','Submitted','Pending','Pending Evaluation','Under Evaluation','Accepted','Partially Accepted','Approved','Rejected','GRN Generated','Posted')),
  evaluation_status         TEXT NOT NULL DEFAULT 'Pending',
  evaluation_date           DATE,
  evaluation_note           TEXT,
  evaluation_findings       TEXT,
  evaluation_condition      TEXT,
  evaluation_evidence       TEXT,
  evaluated_by              TEXT,
  gate_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  gate_verified_by          TEXT,
  gate_verified_at          TIMESTAMP,
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_supplier ON goods_receipts(supplier_id);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id                 SERIAL PRIMARY KEY,
  goods_receipt_id   INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty                NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  unit_price         NUMERIC(14,2) NOT NULL,
  qty_accepted       NUMERIC(14,2),
  qty_rejected       NUMERIC(14,2)
);

-- ---------- GRN documents ----------
CREATE TABLE IF NOT EXISTS grns (
  id                SERIAL PRIMARY KEY,
  grn_number        TEXT NOT NULL UNIQUE,
  goods_receipt_id  INTEGER NOT NULL UNIQUE REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  generated_by      TEXT NOT NULL,
  generated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  remarks           TEXT
);
CREATE TABLE IF NOT EXISTS grn_items (
  id          SERIAL PRIMARY KEY,
  grn_id      INTEGER NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty         NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  unit_price  NUMERIC(14,2) NOT NULL
);

-- ---------- stock_lots — FIFO costing layer (§6.6) ----------
CREATE TABLE IF NOT EXISTS stock_lots (
  id             SERIAL PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  received_date  DATE NOT NULL,
  unit_price     NUMERIC(14,2) NOT NULL,
  qty_received   NUMERIC(14,2) NOT NULL,
  qty_remaining  NUMERIC(14,2) NOT NULL CHECK (qty_remaining >= 0),
  source_ref     TEXT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lots_item_fifo ON stock_lots(item_id, received_date, id);

-- ---------- stock_transactions — Stock Card ledger (§5.6) ----------
CREATE TABLE IF NOT EXISTS stock_transactions (
  id          SERIAL PRIMARY KEY,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL CHECK (type IN ('Receipt','Issue','Return','Transfer-Out','Transfer-In','Adjustment','Disposal')),
  ref         TEXT NOT NULL,
  qty_in      NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty_out     NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance     NUMERIC(14,2) NOT NULL,
  actor_name  TEXT,
  store_id    INTEGER REFERENCES stores(id) ON DELETE RESTRICT,
  bin         TEXT,
  reason      TEXT,
  source_type TEXT,
  source_id   TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stocktxn_item_date ON stock_transactions(item_id, date);

-- ---------- bin_cards (§5.7) ----------
CREATE TABLE IF NOT EXISTS bin_cards (
  id             SERIAL PRIMARY KEY,
  bin            TEXT NOT NULL,
  store_id       INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  last_movement  DATE,
  balance        NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (bin, store_id, item_id)
);
CREATE TABLE IF NOT EXISTS bin_card_movements (
  id            SERIAL PRIMARY KEY,
  bin_card_id   INTEGER NOT NULL REFERENCES bin_cards(id) ON DELETE RESTRICT,
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference     TEXT NOT NULL,
  type          TEXT NOT NULL,
  qty_in        NUMERIC(14,2) NOT NULL DEFAULT 0,
  qty_out       NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance       NUMERIC(14,2) NOT NULL,
  actor_name    TEXT,
  reason        TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bin_movement_card_date ON bin_card_movements(bin_card_id, movement_date, id);

-- ---------- bin_transfers (§5.8) ----------
CREATE TABLE IF NOT EXISTS bin_transfers (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  from_bin        TEXT NOT NULL,
  to_bin          TEXT NOT NULL,
  qty             NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  transferred_by  TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- requisitions + line items (§5.9) ----------
CREATE TABLE IF NOT EXISTS requisitions (
  id              SERIAL PRIMARY KEY,
  sr_ref          TEXT NOT NULL UNIQUE,
  department      TEXT NOT NULL,
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  requested_by    TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Draft','Submitted','Pending','Pending Approval','Partially Approved','Approved','Ready for Issue','Partially Issued','Fulfilled','Rejected','Returned for Correction','Cancelled')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_req_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_department ON requisitions(department_id);

CREATE TABLE IF NOT EXISTS requisition_items (
  id               SERIAL PRIMARY KEY,
  requisition_id   INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  item_id          INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty              NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  qty_approved     NUMERIC(14,2) CHECK (qty_approved >= 0)
);
CREATE TABLE IF NOT EXISTS requisition_approvals (
  id              SERIAL PRIMARY KEY,
  requisition_id  INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE RESTRICT,
  decision        TEXT NOT NULL CHECK (decision IN ('Approved', 'Partially Approved', 'Rejected', 'Returned for Correction')),
  comments        TEXT,
  approved_by     TEXT NOT NULL,
  approved_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_requisition_approvals_req ON requisition_approvals(requisition_id, approved_at DESC);

-- ---------- issue_vouchers + line items (§5.10) ----------
CREATE TABLE IF NOT EXISTS issue_vouchers (
  id               SERIAL PRIMARY KEY,
  siv_ref          TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN ('SIV','ISIV')),
  sr_ref           TEXT NOT NULL,
  issued_to        TEXT,
  issued_by        TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'Issued'
                     CHECK (status IN ('Preliminary', 'Pending Approval', 'Approved', 'Posted', 'Issued', 'Rejected')),
  approved_by      TEXT,
  approved_at      TIMESTAMP,
  posted_by        TEXT,
  posted_at        TIMESTAMP,
  gate_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  gate_verified_by TEXT,
  gate_verified_at TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_voucher_items (
  id                 SERIAL PRIMARY KEY,
  issue_voucher_id   INTEGER NOT NULL REFERENCES issue_vouchers(id) ON DELETE CASCADE,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty                NUMERIC(14,2) NOT NULL,
  unit_price         NUMERIC(14,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS issue_voucher_amendments (
  id                SERIAL PRIMARY KEY,
  issue_voucher_id  INTEGER NOT NULL REFERENCES issue_vouchers(id) ON DELETE RESTRICT,
  item_id           INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  previous_qty      NUMERIC(14,2) NOT NULL,
  amended_qty       NUMERIC(14,2) NOT NULL CHECK (amended_qty > 0),
  reason            TEXT,
  amended_by        TEXT NOT NULL,
  amended_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_issue_amendments_voucher ON issue_voucher_amendments(issue_voucher_id, amended_at DESC);

-- ---------- fixed_assets (§5.12) ----------
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                SERIAL PRIMARY KEY,
  asset_tag         TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  category          TEXT,
  store_id          INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  assigned_to       TEXT,
  status            TEXT NOT NULL DEFAULT 'In Store'
                      CHECK (status IN ('Registered','In Store','Assigned','In Use','Maintenance','Under Repair','Lost','Damaged','Disposed')),
  acquisition_date  DATE,
  value             NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- material_returns / SRN (§5.13) ----------
CREATE TABLE IF NOT EXISTS material_returns (
  id                           SERIAL PRIMARY KEY,
  srn_ref                      TEXT NOT NULL UNIQUE,
  department                   TEXT NOT NULL,
  created_by                   TEXT,
  store_id                     INTEGER REFERENCES stores(id) ON DELETE RESTRICT,
  item_id                      INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty                          NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  reason                       TEXT,
  condition                    TEXT,
  original_issue_ref           TEXT,
  date                         DATE NOT NULL DEFAULT CURRENT_DATE,
  status                       TEXT NOT NULL DEFAULT 'Pending'
                                 CHECK (status IN ('Draft','Submitted','Pending','Pending Review','Approved','Rejected','Returned to Stock')),
  qty_approved                 NUMERIC(14,2),
  evaluated_by                 TEXT,
  evaluated_at                 TIMESTAMP,
  evaluation_findings          TEXT,
  evaluation_recommendation    TEXT,
  created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE material_returns ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_material_returns_store ON material_returns(store_id);

-- ---------- material_transfers — store to store (§5.14) ----------
CREATE TABLE IF NOT EXISTS material_transfers (
  id                   SERIAL PRIMARY KEY,
  transfer_ref         TEXT NOT NULL UNIQUE,
  from_store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  to_store_id          INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  item_id              INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty                  NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  status               TEXT NOT NULL DEFAULT 'Pending'
                         CHECK (status IN ('Draft','Submitted','Pending','Pending Approval','Approved','Dispatched','Received','Completed','Rejected','Returned for Correction')),
  destination_bin      TEXT,
  dispatched_by        TEXT,
  dispatched_at        TIMESTAMP,
  received_by          TEXT,
  received_at          TIMESTAMP,
  transfer_unit_price  NUMERIC(14,2),
  gate_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  gate_verified_by     TEXT,
  gate_verified_at     TIMESTAMP,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE material_transfers ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE material_transfers ADD COLUMN IF NOT EXISTS requested_by TEXT;
CREATE INDEX IF NOT EXISTS idx_material_transfers_department ON material_transfers(department);

-- ---------- disposals (§5.15) ----------
CREATE TABLE IF NOT EXISTS disposals (
  id             SERIAL PRIMARY KEY,
  disposal_ref   TEXT NOT NULL UNIQUE,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  store_id       INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  qty            NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  reason         TEXT,
  date_flagged   DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Flagged','Requested','Pending','Pending Review','Approved','Rejected','Returned for Correction','Executed','Completed')),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- audit_logs (§5.16) ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id               SERIAL PRIMARY KEY,
  user_name        TEXT NOT NULL,
  action           TEXT NOT NULL,
  module           TEXT NOT NULL,
  actor_id         TEXT,
  actor_role       TEXT,
  entity_type      TEXT,
  entity_id        TEXT,
  entity_reference TEXT,
  description      TEXT,
  outcome          TEXT NOT NULL DEFAULT 'SUCCESS',
  before_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  changes          JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ---------- user_cards ----------
CREATE TABLE IF NOT EXISTS user_cards (
  id             SERIAL PRIMARY KEY,
  user_name      TEXT NOT NULL,
  department     TEXT,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  issue_ref      TEXT NOT NULL,
  issue_date     DATE NOT NULL,
  qty            NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  status         TEXT NOT NULL DEFAULT 'In Use'
                   CHECK (status IN ('In Use','Maintenance','Lost','Damaged','Returned')),
  returned_date  DATE,
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- stock_taking ----------
CREATE TABLE IF NOT EXISTS stock_taking_sessions (
  id           SERIAL PRIMARY KEY,
  session_ref  TEXT NOT NULL UNIQUE,
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  count_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'Draft'
                 CHECK (status IN ('Draft','Submitted','Pending Approval','Approved','Posted','Closed','Rejected','Recount Required')),
  created_by   TEXT NOT NULL,
  assigned_to  TEXT,
  approved_by  TEXT,
  approved_at  TIMESTAMP,
  closed_by    TEXT,
  closed_at    TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_taking_items (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER NOT NULL REFERENCES stock_taking_sessions(id) ON DELETE RESTRICT,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  bin             TEXT,
  system_qty      NUMERIC(14,2) NOT NULL,
  physical_qty    NUMERIC(14,2) NOT NULL CHECK (physical_qty >= 0),
  variance        NUMERIC(14,2) NOT NULL,
  reason          TEXT,
  counter         TEXT,
  verified_by     TEXT,
  adjustment_ref  TEXT,
  UNIQUE (session_id, item_id, bin)
);
ALTER TABLE stock_taking_sessions ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE stock_taking_items ADD COLUMN IF NOT EXISTS recount_physical_qty NUMERIC(14,2);
ALTER TABLE stock_taking_items ADD COLUMN IF NOT EXISTS recount_variance NUMERIC(14,2);
ALTER TABLE stock_taking_items ADD COLUMN IF NOT EXISTS recounted_by TEXT;
ALTER TABLE stock_taking_items ADD COLUMN IF NOT EXISTS recounted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_stock_taking_assigned_to ON stock_taking_sessions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_stock_taking_status ON stock_taking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stock_taking_items_session ON stock_taking_items(session_id);

-- ---------- configurable business rules ----------
CREATE TABLE IF NOT EXISTS business_rules (
  id             SERIAL PRIMARY KEY,
  rule_name      TEXT NOT NULL UNIQUE,
  rule_category  TEXT NOT NULL,
  rule_value     TEXT NOT NULL,
  rule_type      TEXT NOT NULL CHECK (rule_type IN ('integer', 'decimal', 'boolean', 'text', 'enum')),
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  min_value      TEXT,
  max_value      TEXT,
  allowed_values TEXT,
  updated_by     TEXT,
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_rules_category ON business_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_business_rules_name ON business_rules(rule_name);

-- ---------- persisted workflow notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info'
                CHECK (type IN ('info', 'success', 'warning', 'error')),
  route       TEXT NOT NULL DEFAULT '/',
  entity_type TEXT,
  entity_id   TEXT,
  read_at     TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
