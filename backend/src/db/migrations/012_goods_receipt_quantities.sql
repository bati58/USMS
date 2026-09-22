-- Make Goods Receipt quantities explicit without changing the existing qty
-- column, which remains the received-quantity compatibility field.

ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS expected_qty NUMERIC(14,2);
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS received_qty NUMERIC(14,2);
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS posted_qty NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE goods_receipt_items
SET expected_qty = COALESCE(expected_qty, qty),
    received_qty = COALESCE(received_qty, qty),
    posted_qty = COALESCE(posted_qty, 0);

ALTER TABLE goods_receipt_items
  DROP CONSTRAINT IF EXISTS goods_receipt_items_quantity_check;

ALTER TABLE goods_receipt_items
  ADD CONSTRAINT goods_receipt_items_quantity_check
  CHECK (
    (expected_qty IS NULL OR expected_qty >= 0)
    AND (received_qty IS NULL OR received_qty > 0)
    AND posted_qty >= 0
    AND (received_qty IS NULL OR posted_qty <= received_qty)
  );