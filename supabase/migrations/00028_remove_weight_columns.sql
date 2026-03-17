-- Eliminar columnas relacionadas con peso (kg) de la base de datos
-- Ya que el sistema ahora trabaja solo con unidades y metros

-- 1. Eliminar columna total_weight de orders
ALTER TABLE orders DROP COLUMN IF EXISTS total_weight;

-- 2. Actualizar comentarios para reflejar que trabajamos con unidades
COMMENT ON COLUMN order_lines.quantity IS 'Cantidad en unidades';
COMMENT ON COLUMN products.unit IS 'Unidad de medida: m (metros) para chapas, unidades para productos';
