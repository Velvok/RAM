-- Agregar campo quantity_delivered a cut_orders y preparation_items
-- Para trackear cuántas unidades ya fueron entregadas/retiradas por el cliente

-- Agregar quantity_delivered a cut_orders
ALTER TABLE cut_orders 
ADD COLUMN IF NOT EXISTS quantity_delivered INTEGER NOT NULL DEFAULT 0;

-- Agregar quantity_delivered a preparation_items
ALTER TABLE preparation_items 
ADD COLUMN IF NOT EXISTS quantity_delivered INTEGER NOT NULL DEFAULT 0;

-- Agregar constraint para asegurar que quantity_delivered no sea mayor que quantity_cut
ALTER TABLE cut_orders
ADD CONSTRAINT cut_orders_quantity_delivered_check 
CHECK (quantity_delivered >= 0 AND quantity_delivered <= quantity_cut);

-- Agregar constraint para asegurar que quantity_delivered no sea mayor que quantity_prepared
ALTER TABLE preparation_items
ADD CONSTRAINT preparation_items_quantity_delivered_check 
CHECK (quantity_delivered >= 0 AND quantity_delivered <= quantity_prepared);

-- Comentarios
COMMENT ON COLUMN cut_orders.quantity_delivered IS 'Cantidad de piezas ya entregadas/retiradas por el cliente';
COMMENT ON COLUMN preparation_items.quantity_delivered IS 'Cantidad de items ya entregados/retirados por el cliente';
