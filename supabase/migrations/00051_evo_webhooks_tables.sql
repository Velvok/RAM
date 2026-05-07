-- =====================================================
-- MIGRACIÓN: Tablas para Webhooks EVO
-- =====================================================
-- Fecha: 2026-05-07
-- Descripción: Crear tablas para procesamiento de webhooks
--              y control de sincronización con EVO
-- =====================================================

-- =====================================================
-- Tabla para registrar eventos procesados (idempotencia)
-- =====================================================

CREATE TABLE IF NOT EXISTS evo_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_evento TEXT NOT NULL UNIQUE,
  tipo_evento TEXT NOT NULL,
  version INTEGER,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  errors TEXT[],
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evo_events_id_evento ON evo_events(id_evento);
CREATE INDEX idx_evo_events_tipo_evento ON evo_events(tipo_evento);
CREATE INDEX idx_evo_events_processed_at ON evo_events(processed_at DESC);
CREATE INDEX idx_evo_events_order_id ON evo_events(order_id);

-- =====================================================
-- Tabla para log de sincronización de stock
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version INTEGER NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL,
  items_count INTEGER NOT NULL,
  updated_count INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  errors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_sync_version ON stock_sync_log(version);
CREATE INDEX idx_stock_sync_timestamp ON stock_sync_log(timestamp DESC);

-- =====================================================
-- Agregar campos faltantes a orders
-- =====================================================

-- Agregar campo ref_evo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'ref_evo'
  ) THEN
    ALTER TABLE orders ADD COLUMN ref_evo JSONB;
    
    -- Crear índice
    CREATE INDEX idx_orders_ref_evo ON orders USING GIN(ref_evo);
    
    RAISE NOTICE 'Campo ref_evo agregado a orders';
  END IF;
END $$;

-- Agregar campo delivered_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
    
    RAISE NOTICE 'Campo delivered_at agregado a orders';
  END IF;
END $$;

-- =====================================================
-- Agregar campo ref_evo a cut_orders
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cut_orders' AND column_name = 'ref_evo'
  ) THEN
    ALTER TABLE cut_orders ADD COLUMN ref_evo JSONB;
    
    -- Crear índice
    CREATE INDEX idx_cut_orders_ref_evo ON cut_orders USING GIN(ref_evo);
    
    RAISE NOTICE 'Campo ref_evo agregado a cut_orders';
  END IF;
END $$;

-- =====================================================
-- Agregar campo ref_evo a preparation_items
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preparation_items' AND column_name = 'ref_evo'
  ) THEN
    ALTER TABLE preparation_items ADD COLUMN ref_evo JSONB;
    
    -- Crear índice
    CREATE INDEX idx_preparation_items_ref_evo ON preparation_items USING GIN(ref_evo);
    
    RAISE NOTICE 'Campo ref_evo agregado a preparation_items';
  END IF;
END $$;

-- =====================================================
-- Habilitar RLS en nuevas tablas
-- =====================================================

ALTER TABLE evo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sync_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Políticas RLS para evo_events
-- =====================================================

-- Solo usuarios autenticados pueden leer
CREATE POLICY "Users can view evo_events" ON evo_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo service role puede insertar (webhooks)
CREATE POLICY "Service role can insert evo_events" ON evo_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- Políticas RLS para stock_sync_log
-- =====================================================

-- Solo usuarios autenticados pueden leer
CREATE POLICY "Users can view stock_sync_log" ON stock_sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo service role puede insertar
CREATE POLICY "Service role can insert stock_sync_log" ON stock_sync_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE MIGRACIÓN EVO WEBHOOKS';
  RAISE NOTICE '========================================';
  
  -- Verificar tablas creadas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evo_events') THEN
    RAISE NOTICE '✅ Tabla evo_events creada';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_sync_log') THEN
    RAISE NOTICE '✅ Tabla stock_sync_log creada';
  END IF;
  
  -- Verificar campos agregados
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'ref_evo') THEN
    RAISE NOTICE '✅ Campo orders.ref_evo agregado';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
    RAISE NOTICE '✅ Campo orders.delivered_at agregado';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cut_orders' AND column_name = 'ref_evo') THEN
    RAISE NOTICE '✅ Campo cut_orders.ref_evo agregado';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preparation_items' AND column_name = 'ref_evo') THEN
    RAISE NOTICE '✅ Campo preparation_items.ref_evo agregado';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '========================================';
END $$;
