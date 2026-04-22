-- =====================================================
-- SECURITY FIX: Habilitar RLS en todas las tablas
-- =====================================================
-- Fecha: 2026-04-22
-- Descripción: Soluciona 32 errores críticos de seguridad
--              habilitando RLS en todas las tablas que tienen
--              políticas definidas pero RLS deshabilitado.
-- =====================================================

-- =====================================================
-- PASO 1: Habilitar RLS en todas las tablas
-- =====================================================

-- Tablas principales del sistema
ALTER TABLE annual_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_weight_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE remnants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_activity_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE annual_history IS 'RLS HABILITADO - Historial anual de pedidos';
COMMENT ON TABLE clients IS 'RLS HABILITADO - Clientes del sistema (contiene datos sensibles)';
COMMENT ON TABLE cut_lines IS 'RLS HABILITADO - Líneas de corte';
COMMENT ON TABLE cut_orders IS 'RLS HABILITADO - Órdenes de corte';
COMMENT ON TABLE inventory IS 'RLS HABILITADO - Inventario de productos';
COMMENT ON TABLE order_lines IS 'RLS HABILITADO - Líneas de pedido';
COMMENT ON TABLE orders IS 'RLS HABILITADO - Pedidos';
COMMENT ON TABLE preparation_items IS 'RLS HABILITADO - Artículos a preparar';
COMMENT ON TABLE product_weight_conversions IS 'RLS HABILITADO - Conversiones de peso';
COMMENT ON TABLE products IS 'RLS HABILITADO - Productos del catálogo';
COMMENT ON TABLE remnants IS 'RLS HABILITADO - Recortes y sobrantes';
COMMENT ON TABLE stock_movements IS 'RLS HABILITADO - Movimientos de stock';
COMMENT ON TABLE stock_reservations IS 'RLS HABILITADO - Reservas de stock';
COMMENT ON TABLE users IS 'RLS HABILITADO - Usuarios del sistema';
COMMENT ON TABLE order_activity_log IS 'RLS HABILITADO - Log de actividades de pedidos';

-- =====================================================
-- PASO 2: Recrear vista v_stock_real_time sin SECURITY DEFINER
-- =====================================================

-- Eliminar vista existente
DROP VIEW IF EXISTS v_stock_real_time;

-- Recrear vista con security_invoker=true (más seguro)
CREATE OR REPLACE VIEW v_stock_real_time 
WITH (security_invoker=true)
AS
SELECT 
  i.id,
  i.product_id,
  p.code as product_code,
  p.name as product_name,
  p.category,
  p.description,
  i.stock_total,
  i.stock_reservado,
  i.stock_en_proceso,
  i.stock_disponible,
  i.last_sync_at,
  i.created_at,
  i.updated_at,
  -- Información adicional del producto
  p.unit,
  p.thickness_mm,
  p.width_mm,
  p.length_mm,
  p.length_meters,
  p.weight_per_unit,
  p.is_active
FROM inventory i
INNER JOIN products p ON i.product_id = p.id
WHERE p.is_active = true
ORDER BY p.code;

COMMENT ON VIEW v_stock_real_time IS 'Vista de stock en tiempo real con security_invoker=true (más seguro que SECURITY DEFINER)';

-- =====================================================
-- PASO 3: Verificar que las políticas RLS existen
-- =====================================================

-- Esta query muestra todas las políticas RLS activas
-- Ejecutar manualmente para verificar:
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- =====================================================
-- PASO 4: Verificación final
-- =====================================================

-- Verificar que RLS está habilitado en todas las tablas
DO $$
DECLARE
  v_count_enabled INTEGER;
  v_count_total INTEGER;
  v_tables_without_rls TEXT[];
BEGIN
  -- Contar tablas con RLS habilitado
  SELECT COUNT(*) INTO v_count_enabled
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true;
  
  -- Contar total de tablas en public
  SELECT COUNT(*) INTO v_count_total
  FROM pg_tables t
  WHERE t.schemaname = 'public';
  
  -- Obtener tablas sin RLS
  SELECT ARRAY_AGG(tablename) INTO v_tables_without_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = false;
  
  -- Mostrar resultados
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE RLS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas con RLS habilitado: % de %', v_count_enabled, v_count_total;
  
  IF v_tables_without_rls IS NOT NULL THEN
    RAISE NOTICE 'Tablas SIN RLS: %', v_tables_without_rls;
  ELSE
    RAISE NOTICE '✓ Todas las tablas tienen RLS habilitado';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Verificar vista v_stock_real_time
DO $$
DECLARE
  v_view_exists BOOLEAN;
  v_view_security TEXT;
BEGIN
  -- Verificar si la vista existe
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'v_stock_real_time'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    RAISE NOTICE '✓ Vista v_stock_real_time recreada correctamente';
    RAISE NOTICE '  (Ahora usa security_invoker=true en lugar de SECURITY DEFINER)';
  ELSE
    RAISE WARNING '✗ Vista v_stock_real_time NO existe';
  END IF;
END $$;

-- =====================================================
-- PASO 5: Resumen de políticas por tabla
-- =====================================================

-- Mostrar resumen de políticas RLS por tabla
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as num_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Esta migración NO modifica las políticas RLS existentes
-- 2. Solo habilita RLS en las tablas que lo tenían deshabilitado
-- 3. La vista v_stock_real_time ahora es más segura (security_invoker)
-- 4. Todas las políticas existentes seguirán funcionando igual
-- 5. Ejecutar la verificación manual de políticas si es necesario
-- =====================================================
