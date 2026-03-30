-- Limpiar todos los pedidos y datos relacionados para empezar con modelo de unidades
-- NOTA: Esta migración solo limpia pedidos, NO toca el stock
-- ACTUALIZADO: Incluye delivery_history para evitar errores de foreign key

-- 1. Eliminar delivery_history (referencia a orders)
DELETE FROM delivery_history;

-- 2. Eliminar stock_items (depende de cut_orders)
DELETE FROM stock_items;

-- 3. Eliminar stock_reassignments (depende de orders y cut_orders)
DELETE FROM stock_reassignments;

-- 4. Eliminar remnants (depende de cut_orders)
DELETE FROM remnants;

-- 5. Eliminar stock_reservations (depende de orders y cut_orders)
DELETE FROM stock_reservations;

-- 6. Eliminar stock_movements
DELETE FROM stock_movements;

-- 7. Eliminar cut_orders (depende de orders)
DELETE FROM cut_orders;

-- 8. Eliminar order_lines (depende de orders)
DELETE FROM order_lines;

-- 9. Eliminar orders
DELETE FROM orders;

-- 10. Resetear solo stock_reservado y stock_en_proceso (NO stock_total)
UPDATE inventory SET 
  stock_reservado = 0,
  stock_en_proceso = 0,
  stock_generado = 0;
