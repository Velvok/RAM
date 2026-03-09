-- Limpiar todos los pedidos y datos relacionados
-- CUIDADO: Esto eliminará TODOS los datos de pedidos

-- ORDEN CORRECTO según dependencias de foreign keys:

-- 1. Eliminar recortes (remnants) - depende de cut_orders
DELETE FROM remnants;

-- 2. Eliminar líneas de corte (cut_lines) - depende de cut_orders
DELETE FROM cut_lines;

-- 3. Eliminar movimientos de stock relacionados con órdenes
DELETE FROM stock_movements WHERE reference_type = 'cut_order';

-- 4. Eliminar reservas de stock - depende de orders y cut_orders
DELETE FROM stock_reservations;

-- 5. Eliminar órdenes de corte - depende de orders
DELETE FROM cut_orders;

-- 6. Eliminar líneas de pedido - depende de orders
DELETE FROM order_lines;

-- 7. Eliminar pedidos
DELETE FROM orders;

-- Comentario
COMMENT ON TABLE orders IS 'Tabla limpiada - todos los pedidos eliminados';
