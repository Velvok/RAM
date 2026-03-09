-- Limpiar todos los pedidos y datos relacionados
-- CUIDADO: Esto eliminará TODOS los datos de pedidos

-- 1. Eliminar líneas de corte
DELETE FROM cut_lines;

-- 2. Eliminar órdenes de corte
DELETE FROM cut_orders;

-- 3. Eliminar líneas de pedido
DELETE FROM order_lines;

-- 4. Eliminar reservas de stock
DELETE FROM stock_reservations;

-- 5. Eliminar pedidos
DELETE FROM orders;

-- 6. Resetear secuencias si existen
-- (No hay secuencias en este esquema, los IDs son UUID)

-- Comentario
COMMENT ON TABLE orders IS 'Tabla limpiada - todos los pedidos eliminados';
