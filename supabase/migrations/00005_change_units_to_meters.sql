-- Cambiar unidades de kg a metros (m) para chapas
-- Las cantidades ahora representan metros lineales en vez de kilogramos

-- 1. Actualizar comentarios de columnas en products
COMMENT ON COLUMN products.unit IS 'Unidad de medida: m (metros) para chapas';

-- 2. Actualizar comentarios en orders
COMMENT ON COLUMN orders.total_weight IS 'Peso total del pedido en metros (m)';

-- 3. Actualizar comentarios en order_lines
COMMENT ON COLUMN order_lines.quantity IS 'Cantidad en metros (m)';

-- 4. Actualizar comentarios en cut_orders
COMMENT ON COLUMN cut_orders.quantity_requested IS 'Cantidad solicitada en metros (m)';
COMMENT ON COLUMN cut_orders.quantity_cut IS 'Cantidad cortada en metros (m)';

-- 5. Actualizar comentarios en inventory
COMMENT ON COLUMN inventory.stock_total IS 'Stock total en metros (m)';
COMMENT ON COLUMN inventory.stock_reservado IS 'Stock reservado en metros (m)';
COMMENT ON COLUMN inventory.stock_en_proceso IS 'Stock en proceso en metros (m)';
COMMENT ON COLUMN inventory.stock_disponible IS 'Stock disponible en metros (m) - Calculado automáticamente';

-- 6. Actualizar comentarios en remnants
COMMENT ON COLUMN remnants.quantity IS 'Cantidad del recorte en metros (m)';

-- 7. Actualizar comentarios en stock_movements
COMMENT ON COLUMN stock_movements.quantity IS 'Cantidad del movimiento en metros (m)';

-- Nota: Los valores numéricos no se modifican, solo cambia la interpretación de la unidad
-- Si necesitas convertir valores existentes (ej: de kg a m usando densidad), 
-- deberás crear una migración adicional con la lógica de conversión específica
