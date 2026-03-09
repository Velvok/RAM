-- Migración: Eliminar verificación de pago
-- Los pedidos ya vienen con pago verificado desde el ERP

-- 1. Eliminar columna payment_verified de orders
ALTER TABLE orders DROP COLUMN IF EXISTS payment_verified;

-- 2. Actualizar función de generación de órdenes de corte
-- Las órdenes de corte se lanzan automáticamente al generarse
-- Ya no hay paso intermedio de "aprobar y lanzar"

-- 3. Comentario para documentación
COMMENT ON TABLE orders IS 'Pedidos del sistema. Los pedidos llegan con pago ya verificado desde el ERP.';
COMMENT ON TABLE cut_orders IS 'Órdenes de corte. Se lanzan automáticamente al generarse y están disponibles para todos los operarios.';
