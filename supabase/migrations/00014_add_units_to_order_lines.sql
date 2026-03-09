-- Agregar campos para manejar unidades en order_lines
-- Ejemplo: 5 chapas de 6m = units: 5, length_meters: 6, quantity: 30

ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS units INTEGER;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS length_meters DECIMAL(10,2);

-- Comentarios
COMMENT ON COLUMN order_lines.units IS 'Cantidad de unidades (chapas)';
COMMENT ON COLUMN order_lines.length_meters IS 'Longitud en metros de cada unidad';
COMMENT ON COLUMN order_lines.quantity IS 'Total en metros (units * length_meters)';

-- Ejemplo de datos:
-- units: 5, length_meters: 6, quantity: 30 = "5 chapas de 6m"
