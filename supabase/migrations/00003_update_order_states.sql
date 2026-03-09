-- Actualizar estados de pedidos según nueva lógica de negocio
-- Estados: nuevo, aprobado, en_corte, finalizado, cancelado

-- 1. Modificar el tipo de estado de orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('nuevo', 'aprobado', 'en_corte', 'finalizado', 'cancelado'));

-- 2. Actualizar pedidos existentes al nuevo esquema
-- Los pedidos que están 'ingresado' pasan a 'nuevo'
UPDATE orders SET status = 'nuevo' WHERE status = 'ingresado';

-- Los pedidos que están 'generado' o 'lanzado' pasan a 'aprobado'
UPDATE orders SET status = 'aprobado' WHERE status IN ('generado', 'lanzado');

-- Los pedidos que están 'en_corte' se mantienen
UPDATE orders SET status = 'en_corte' WHERE status = 'en_corte';

-- Los pedidos que están 'despachado' o 'completado' pasan a 'finalizado'
UPDATE orders SET status = 'finalizado' WHERE status IN ('despachado', 'completado');

-- 3. Agregar columna para fecha de aprobación
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- 4. Comentarios actualizados
COMMENT ON COLUMN orders.status IS 'Estado del pedido: nuevo (recién ingresado), aprobado (admin aprobó y se generaron órdenes), en_corte (al menos una orden en proceso), finalizado (todas las órdenes completadas), cancelado';
COMMENT ON COLUMN orders.approved_at IS 'Fecha y hora en que el pedido fue aprobado por el admin';
COMMENT ON COLUMN orders.approved_by IS 'Usuario admin que aprobó el pedido';
