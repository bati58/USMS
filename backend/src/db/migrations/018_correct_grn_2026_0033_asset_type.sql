-- Correct the accidentally posted Digital Laboratory Balance receipt.
DO $$
DECLARE
  receipt_id INTEGER;
BEGIN
  SELECT g.id INTO receipt_id
  FROM goods_receipts g
  JOIN grns gr ON gr.goods_receipt_id = g.id
  JOIN goods_receipt_items gri ON gri.goods_receipt_id = g.id
  JOIN items i ON i.id = gri.item_id
  WHERE gr.grn_number = 'GRN-2026-0033'
    AND g.status = 'Posted'
    AND g.material_type = 'Consumable'
    AND i.name = 'Digital Laboratory Balance';

  IF receipt_id IS NULL THEN
    RAISE EXCEPTION 'Expected posted Consumable Digital Laboratory Balance receipt was not found.';
  END IF;

  UPDATE goods_receipts
  SET material_type = 'Fixed Asset', updated_at = NOW()
  WHERE id = receipt_id;

  INSERT INTO audit_logs (
    user_name, action, module, entity_type, entity_id, entity_reference,
    description, before_data, after_data
  ) VALUES (
    'System correction',
    'Reclassified posted receipt as Fixed Asset',
    'Goods Receipt',
    'goods_receipt',
    receipt_id,
    'GRN-2026-0033',
    'Corrected material type for fixed asset registration.',
    '{"materialType":"Consumable"}'::jsonb,
    '{"materialType":"Fixed Asset"}'::jsonb
  );
END $$;