-- Agregar nuevo estado 'pendiente_confirmacion' para órdenes de corte
-- Este estado se usa cuando se reasigna una chapa desde admin y el operario debe confirmar la recogida

-- Agregar nuevo valor al ENUM cut_order_status
ALTER TYPE cut_order_status ADD VALUE IF NOT EXISTS 'pendiente_confirmacion';

-- Agregar columna para guardar el pedido de origen de la reasignación
ALTER TABLE cut_orders ADD COLUMN IF NOT EXISTS reassigned_from_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE cut_orders ADD COLUMN IF NOT EXISTS reassigned_from_cut_order_id UUID REFERENCES cut_orders(id) ON DELETE SET NULL;

-- Comentarios
COMMENT ON COLUMN cut_orders.reassigned_from_order_id IS 'ID del pedido desde donde se reasignó esta chapa';
COMMENT ON COLUMN cut_orders.reassigned_from_cut_order_id IS 'ID de la orden de corte desde donde se reasignó esta chapa';
