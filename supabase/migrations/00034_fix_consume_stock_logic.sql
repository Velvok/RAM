-- =====================================================
-- LÓGICA CORRECTA DE CONSUMO DE STOCK AL ENTREGAR
-- 
-- FLUJO DE STOCK:
-- 1. Pedido aprobado: stock_reservado sube, stock_disponible baja, stock_total NO cambia
--    Ejemplo: Total=21, Reservado=0→8, Disponible=21→13
-- 
-- 2. Corte realizado: El material sigue en almacén, NO cambia nada
--    Ejemplo: Total=21, Reservado=8, Disponible=13
-- 
-- 3. Pedido entregado: El material sale del almacén, stock_total y stock_reservado bajan
--    Ejemplo: Total=21→13, Reservado=8→0, Disponible=13 (se mantiene)
-- 
-- RESULTADO: stock_total = stock_disponible (porque reservado=0)
-- =====================================================

-- La función consume_reserved_stock de 00022_fix_stock_reservation.sql es CORRECTA
-- Disminuye tanto stock_total como stock_reservado
-- Esta migración solo documenta el flujo correcto

COMMENT ON FUNCTION consume_reserved_stock IS 'Consume 1 unidad de stock reservado al entregar un pedido. Disminuye stock_total (material sale del almacén) y stock_reservado (libera la reserva). El stock_disponible se mantiene igual.';
