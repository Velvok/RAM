-- Limpiar todo el inventory para resincronización completa desde EVO
-- Esta migración elimina todos los registros de inventory
-- EVO volverá a enviar el stock actualizado vía /api/webhooks/stock/actualizado

-- ============================================
-- 1. Eliminar todo el inventory
-- ============================================

DELETE FROM inventory;

-- ============================================
-- 2. Resetear stock_sync_log para empezar desde versión 0
-- ============================================

DELETE FROM stock_sync_log;

-- ============================================
-- 3. Log de la operación
-- ============================================

-- Insertar un registro en stock_movements para documentar la limpieza
-- Solo usar un product_id válido si existe algún producto
INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, notes)
SELECT 
    p.id,
    'ajuste',
    0,
    0,
    0,
    'Limpieza completa de inventory - migración 00059: preparado para resincronización desde EVO'
FROM products p
LIMIT 1;

-- ============================================
-- COMPLETADO
-- ============================================

-- Esta migración:
-- 1. Elimina todos los registros de inventory
-- 2. Resetea stock_sync_log (versión a 0)
-- 3. Deja el sistema listo para recibir sincronización completa desde EVO
-- 
-- Después de ejecutar esta migración, EVO debe enviar el stock actualizado
-- vía /api/webhooks/stock/actualizado para recrear el inventory
