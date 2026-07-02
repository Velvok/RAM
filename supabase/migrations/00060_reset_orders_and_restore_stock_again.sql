-- Migración inteligente para resetear pedidos y restaurar stock
-- Analiza:
-- 1. Cortes ya realizados (cut_lines) - revierte consumo y generación
-- 2. Stock asignado pero no cortado (cut_orders.material_base_id) - libera reservas
-- 3. Stock generado (stock_generado) - revierte piezas cortadas y remanentes
-- Luego elimina todos los datos de pedidos

-- ============================================
-- 1. Revertir cortes ya realizados (cut_lines)
-- ============================================

-- Crear tabla temporal para almacenar los cambios a revertir de cortes realizados
CREATE TEMPORARY TABLE IF NOT EXISTS cut_reversals AS
SELECT 
    cl.id as cut_line_id,
    cl.material_used_id,
    cl.quantity_used,
    cl.quantity_produced,
    cl.remnant_generated,
    co.product_id as target_product_id,
    co.material_base_id as source_product_id
FROM cut_lines cl
JOIN cut_orders co ON cl.cut_order_id = co.id;

-- 1.1 Revertir consumo de material base (chapas originales)
-- Incrementar stock_total del material que se consumió al cortar
UPDATE inventory i
SET 
    stock_total = stock_total + (
        SELECT COALESCE(SUM(quantity_used), 0) 
        FROM cut_reversals sr 
        WHERE sr.material_used_id = i.product_id
    )
WHERE EXISTS (
    SELECT 1 FROM cut_reversals sr 
    WHERE sr.material_used_id = i.product_id
);

-- 1.2 Revertir generación de piezas cortadas
-- Decrementar stock_total y stock_generado de las piezas que se generaron
UPDATE inventory i
SET 
    stock_total = GREATEST(0, stock_total - (
        SELECT COALESCE(SUM(quantity_produced), 0) 
        FROM cut_reversals sr 
        WHERE sr.target_product_id = i.product_id
    )),
    stock_generado = GREATEST(0, stock_generado - (
        SELECT COALESCE(SUM(quantity_produced), 0) 
        FROM cut_reversals sr 
        WHERE sr.target_product_id = i.product_id
    ))
WHERE EXISTS (
    SELECT 1 FROM cut_reversals sr 
    WHERE sr.target_product_id = i.product_id
);

-- 1.3 Revertir generación de remanentes
-- Decrementar stock_total y stock_generado de los remanentes creados
UPDATE inventory i
SET 
    stock_total = GREATEST(0, stock_total - (
        SELECT COALESCE(SUM(sr.remnant_generated), 0) 
        FROM cut_reversals sr 
        WHERE sr.remnant_generated > 0
        AND i.product_id IN (
            SELECT p.id FROM products p 
            WHERE p.code LIKE '%X%M'  -- Formato Dach de remanentes
               OR p.category = 'remanentes'
        )
    )),
    stock_generado = GREATEST(0, stock_generado - (
        SELECT COALESCE(SUM(sr.remnant_generated), 0) 
        FROM cut_reversals sr 
        WHERE sr.remnant_generated > 0
        AND i.product_id IN (
            SELECT p.id FROM products p 
            WHERE p.code LIKE '%X%M'
               OR p.category = 'remanentes'
        )
    ))
WHERE i.product_id IN (
    SELECT p.id FROM products p 
    WHERE p.code LIKE '%X%M' OR p.category = 'remanentes'
);

-- ============================================
-- 2. Revertir stock asignado pero no cortado (cut_orders)
-- ============================================

-- Crear tabla temporal para stock asignado pero no cortado
CREATE TEMPORARY TABLE IF NOT EXISTS assigned_stock AS
SELECT 
    co.id as cut_order_id,
    co.material_base_id,
    co.material_base_quantity,
    co.quantity_cut,
    co.quantity_requested
FROM cut_orders co
WHERE co.material_base_id IS NOT NULL
AND (co.quantity_cut IS NULL OR co.quantity_cut < co.quantity_requested);

-- 2.1 Para stock asignado pero NO cortado, liberar las reservas
-- Ya lo haremos más abajo al resetear stock_reservado a 0 globalmente
-- Pero aquí lo documentamos para claridad

-- ============================================
-- 3. Revertir stock_generado globalmente
-- ============================================

-- Para productos que tienen stock_generado > 0, decrementarlo
-- Esto revierte cualquier stock generado que no fue capturado en cut_lines
UPDATE inventory
SET 
    stock_total = GREATEST(0, stock_total - stock_generado),
    stock_generado = 0
WHERE stock_generado > 0;

-- ============================================
-- 4. Resetear stock_reservado y stock_en_proceso a 0
-- ============================================

-- Esto libera todas las reservas de stock asignado pero no cortado
UPDATE inventory SET 
    stock_reservado = 0,
    stock_en_proceso = 0;

-- ============================================
-- 5. Eliminar todos los datos de pedidos
-- ============================================

-- Orden de eliminación respetando foreign keys
DELETE FROM delivery_history;
DELETE FROM order_activity_log;
DELETE FROM evo_events;  -- Eliminar antes de orders (referencia order_id)
DELETE FROM stock_items;
DELETE FROM stock_reassignments;
DELETE FROM remnants;
DELETE FROM stock_reservations;
DELETE FROM stock_movements;
DELETE FROM cut_lines;
DELETE FROM cut_orders;
DELETE FROM preparation_items;
DELETE FROM order_lines;
DELETE FROM orders;

-- ============================================
-- 6. Limpiar tablas temporales
-- ============================================

DROP TABLE IF EXISTS cut_reversals;
DROP TABLE IF EXISTS assigned_stock;

-- ============================================
-- 7. Log de la operación
-- ============================================

-- Insertar un registro en stock_movements para documentar el reset
-- Solo usar product_ids que existen en la tabla products (evitar FK violations)
INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, notes)
SELECT 
    i.product_id,
    'ajuste',
    0,
    i.stock_total,
    i.stock_total,
    'Reset inteligente de stock - migración 00060: pedidos eliminados, stock restaurado (cortes revertidos, stock_generado reseteado, reservas liberadas)'
FROM inventory i
WHERE EXISTS (
    SELECT 1 FROM products p WHERE p.id = i.product_id
)
LIMIT 1;

-- ============================================
-- COMPLETADO
-- ============================================

-- Esta migración:
-- 1. Revierte cortes realizados (cut_lines):
--    - Restaura stock de chapas originales consumidas
--    - Revierte generación de piezas cortadas
--    - Revierte generación de remanentes
-- 2. Revierte stock_generado globalmente (para casos no capturados en cut_lines)
-- 3. Libera stock_reservado y stock_en_proceso (stock asignado pero no cortado)
-- 4. Elimina todos los datos de pedidos
-- 5. Deja el stock en el estado anterior a los pedidos
