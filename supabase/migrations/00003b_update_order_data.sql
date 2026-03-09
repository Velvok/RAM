-- ============================================
-- PASO 2: Actualizar datos y agregar columnas
-- ============================================
-- IMPORTANTE: Ejecuta esto DESPUÉS del PASO 1

-- 1. Actualizar pedidos existentes al nuevo esquema
-- Los pedidos que están 'ingresado' pasan a 'nuevo'
UPDATE orders SET status = 'nuevo' WHERE status = 'ingresado';

-- Los pedidos que están 'generado', 'pendiente_aprobacion' o 'lanzado' pasan a 'aprobado'
UPDATE orders SET status = 'aprobado' WHERE status IN ('generado', 'pendiente_aprobacion', 'lanzado');

-- Los pedidos que están 'en_corte' se mantienen
UPDATE orders SET status = 'en_corte' WHERE status = 'en_corte';

-- Los pedidos que están 'preparado_pendiente_retiro', 'despachado' o 'entregado' pasan a 'finalizado'
UPDATE orders SET status = 'finalizado' WHERE status IN ('preparado_pendiente_retiro', 'despachado', 'entregado');

-- 2. Agregar columnas para fecha de aprobación
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- 3. Comentarios actualizados
COMMENT ON COLUMN orders.status IS 'Estado del pedido: nuevo (recién ingresado), aprobado (admin aprobó y se generaron órdenes), en_corte (al menos una orden en proceso), finalizado (todas las órdenes completadas), cancelado';
COMMENT ON COLUMN orders.approved_at IS 'Fecha y hora en que el pedido fue aprobado por el admin';
COMMENT ON COLUMN orders.approved_by IS 'Usuario admin que aprobó el pedido';
