-- Migración: Sistema de órdenes principales y subórdenes
-- Permite agrupar órdenes de corte generadas por cambios de material

-- Agregar columna para relacionar subórdenes con orden principal
ALTER TABLE cut_orders 
ADD COLUMN parent_cut_order_id UUID REFERENCES cut_orders(id) ON DELETE SET NULL;

-- Índice para búsquedas rápidas de subórdenes
CREATE INDEX idx_cut_orders_parent ON cut_orders(parent_cut_order_id);

-- Comentarios para documentación
COMMENT ON COLUMN cut_orders.parent_cut_order_id IS 'ID de la orden de corte principal cuando esta es una suborden generada por cambio de material';
