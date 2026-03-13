-- Agrupar órdenes de corte por producto
-- En lugar de 1 orden = 1 chapa, ahora 1 orden = N chapas del mismo producto

-- Agregar campo para cantidad cortada (parcial)
ALTER TABLE cut_orders
ADD COLUMN IF NOT EXISTS quantity_cut INTEGER DEFAULT 0;

-- Agregar comentarios
COMMENT ON COLUMN cut_orders.quantity_requested IS 'Cantidad total solicitada (ej: 10 chapas de 3m)';
COMMENT ON COLUMN cut_orders.quantity_cut IS 'Cantidad ya cortada (ej: 8 de 10)';

-- La lógica será:
-- - quantity_requested: total a cortar (ej: 10)
-- - quantity_cut: ya cortadas (ej: 8)
-- - Pendiente: quantity_requested - quantity_cut (ej: 2)
-- - Estado 'completada' cuando quantity_cut >= quantity_requested
