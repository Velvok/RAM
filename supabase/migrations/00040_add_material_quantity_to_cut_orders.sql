-- Agregar columna para cantidad de chapas asignadas a cada orden de corte
-- Esto permite asignar múltiples chapas del mismo material a una orden

ALTER TABLE cut_orders 
ADD COLUMN IF NOT EXISTS material_quantity INTEGER DEFAULT 1;

-- Comentario explicativo
COMMENT ON COLUMN cut_orders.material_quantity IS 'Cantidad de chapas del material asignado para esta orden de corte';
