-- Ensure every institution-wide item can be requested from Main Store at zero balance.
INSERT INTO item_inventory (item_id, store_id, qty_on_hand, unit_price, min_level, max_level, reorder_level)
SELECT i.id, s.id, 0, i.unit_price, i.min_level, i.max_level, i.reorder_level
FROM items i
JOIN stores s ON s.type = 'Main Store' AND s.active = TRUE
ON CONFLICT (item_id, store_id) DO NOTHING;
