-- Limpiar todos los pedidos y datos relacionados para empezar con modelo de unidades

-- 1. Eliminar stock_items (depende de cut_orders)
DELETE FROM stock_items;

-- 2. Eliminar stock_reassignments (depende de orders y cut_orders)
DELETE FROM stock_reassignments;

-- 3. Eliminar remnants (depende de cut_orders)
DELETE FROM remnants;

-- 4. Eliminar stock_reservations (depende de orders y cut_orders)
DELETE FROM stock_reservations;

-- 5. Eliminar stock_movements
DELETE FROM stock_movements;

-- 6. Eliminar cut_orders (depende de orders)
DELETE FROM cut_orders;

-- 7. Eliminar order_lines (depende de orders)
DELETE FROM order_lines;

-- 8. Eliminar orders
DELETE FROM orders;

-- 9. Resetear inventory a 0
UPDATE inventory SET 
  stock_total = 0,
  stock_reservado = 0,
  stock_en_proceso = 0,
  last_sync_at = NULL;
