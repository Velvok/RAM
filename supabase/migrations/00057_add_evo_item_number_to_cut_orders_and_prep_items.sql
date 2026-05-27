ALTER TABLE cut_orders ADD COLUMN IF NOT EXISTS evo_item_number TEXT;
ALTER TABLE preparation_items ADD COLUMN IF NOT EXISTS evo_item_number TEXT;
