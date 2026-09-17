ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_status_check;

ALTER TABLE goods_receipts
  ADD CONSTRAINT goods_receipts_status_check
  CHECK (status IN ('Draft','Submitted','Store Head Review','Pending','Pending Evaluation','Under Evaluation','Accepted','Partially Accepted','Approved','Rejected','GRN Generated','Posted'));