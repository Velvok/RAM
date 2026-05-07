-- =====================================================
-- VISTAS DE MONITOREO PARA INTEGRACIÓN EVO
-- =====================================================
-- Fecha: 2026-05-07
-- Descripción: Vistas para monitorear eventos de EVO
--              en tiempo real
-- =====================================================

-- =====================================================
-- Vista para ver eventos recibidos recientes
-- =====================================================

CREATE OR REPLACE VIEW evo_events_recent AS
SELECT 
  id,
  id_evento,
  tipo_evento,
  version,
  processed_at,
  success,
  CASE 
    WHEN success THEN '✅ Success'
    ELSE '❌ Error'
  END as status,
  CASE 
    WHEN errors IS NOT NULL THEN array_to_string(errors, ', ')
    ELSE 'No errors'
  END as error_details,
  payload->>'id_pedido' as pedido_id,
  payload->>'timestamp' as event_timestamp
FROM evo_events 
ORDER BY processed_at DESC 
LIMIT 50;

-- =====================================================
-- Vista para ver sincronización de stock
-- =====================================================

CREATE OR REPLACE VIEW stock_sync_recent AS
SELECT 
  id,
  version,
  timestamp,
  items_count,
  updated_count,
  errors_count,
  CASE 
    WHEN errors_count = 0 THEN '✅ All synced'
    WHEN errors_count < items_count THEN '⚠️ Partial sync'
    ELSE '❌ Failed'
  END as status,
  created_at
FROM stock_sync_log 
ORDER BY version DESC 
LIMIT 20;

-- =====================================================
-- Vista para ver pedidos creados por EVO
-- =====================================================

CREATE OR REPLACE VIEW evo_orders_recent AS
SELECT 
  o.id,
  o.evo_order_id,
  o.order_number,
  o.status,
  o.created_at,
  c.business_name as cliente,
  o.ref_evo->>'nromov' as nromov,
  o.ref_evo->>'codtipmov' as codtipmov,
  CASE 
    WHEN o.evo_data IS NOT NULL THEN '✅ From EVO'
    ELSE '📝 Manual'
  END as origin,
  (SELECT COUNT(*) FROM order_lines ol WHERE ol.order_id = o.id) as items_count
FROM orders o
LEFT JOIN clients c ON o.client_id = c.id
WHERE o.evo_order_id IS NOT NULL
ORDER BY o.created_at DESC 
LIMIT 20;

-- =====================================================
-- Vista resumen de actividad EVO (últimas 24 horas)
-- =====================================================

CREATE OR REPLACE VIEW evo_activity_summary AS
SELECT 
  'Últimas 24 horas' as periodo,
  COUNT(*) as total_eventos,
  COUNT(CASE WHEN success THEN 1 END) as eventos_exitosos,
  COUNT(CASE WHEN NOT success THEN 1 END) as eventos_fallidos,
  COUNT(CASE WHEN tipo_evento = 'stock_actualizado' THEN 1 END) as stock_updates,
  COUNT(CASE WHEN tipo_evento = 'pedido_creado' THEN 1 END) as pedidos_creados,
  COUNT(CASE WHEN tipo_evento = 'pedido_entregado' THEN 1 END) as entregas_recibidas,
  MAX(processed_at) as ultimo_evento
FROM evo_events 
WHERE processed_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Última hora' as periodo,
  COUNT(*) as total_eventos,
  COUNT(CASE WHEN success THEN 1 END) as eventos_exitosos,
  COUNT(CASE WHEN NOT success THEN 1 END) as eventos_fallidos,
  COUNT(CASE WHEN tipo_evento = 'stock_actualizado' THEN 1 END) as stock_updates,
  COUNT(CASE WHEN tipo_evento = 'pedido_creado' THEN 1 END) as pedidos_creados,
  COUNT(CASE WHEN tipo_evento = 'pedido_entregado' THEN 1 END) as entregas_recibidas,
  MAX(processed_at) as ultimo_evento
FROM evo_events 
WHERE processed_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Últimos 10 minutos' as periodo,
  COUNT(*) as total_eventos,
  COUNT(CASE WHEN success THEN 1 END) as eventos_exitosos,
  COUNT(CASE WHEN NOT success THEN 1 END) as eventos_fallidos,
  COUNT(CASE WHEN tipo_evento = 'stock_actualizado' THEN 1 END) as stock_updates,
  COUNT(CASE WHEN tipo_evento = 'pedido_creado' THEN 1 END) as pedidos_creados,
  COUNT(CASE WHEN tipo_evento = 'pedido_entregado' THEN 1 END) as entregas_recibidas,
  MAX(processed_at) as ultimo_evento
FROM evo_events 
WHERE processed_at >= NOW() - INTERVAL '10 minutes';

-- =====================================================
-- Verificación
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VISTAS DE MONITOREO EVO CREADAS';
  RAISE NOTICE '========================================';
  
  RAISE NOTICE '✅ evo_events_recent - Últimos 50 eventos';
  RAISE NOTICE '✅ stock_sync_recent - Últimas 20 sincronizaciones';
  RAISE NOTICE '✅ evo_orders_recent - Últimos 20 pedidos EVO';
  RAISE NOTICE '✅ evo_activity_summary - Resumen de actividad';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONSULTAS RÁPIDAS PARA MONITOREO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SELECT * FROM evo_events_recent;';
  RAISE NOTICE 'SELECT * FROM evo_activity_summary;';
  RAISE NOTICE 'SELECT * FROM evo_orders_recent;';
  RAISE NOTICE 'SELECT * FROM stock_sync_recent;';
  RAISE NOTICE '========================================';
END $$;
