-- =====================================================
-- TABLA DE HISTORIAL DE ENTREGAS PARA DESHACER ENTREGAS
-- Permite revertir entregas dentro de 24 horas
-- =====================================================

CREATE TABLE delivery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_by UUID REFERENCES auth.users(id),
  
  -- Información para revertir
  previous_status VARCHAR(50) NOT NULL, -- 'finalizado' o 'aprobado'
  
  -- Stock consumido por cada orden de corte (JSON para flexibilidad)
  stock_consumed JSONB NOT NULL, -- [{cut_order_id, inventory_id, quantity}]
  
  -- Estado de la entrega
  is_active BOOLEAN DEFAULT true, -- false si se deshizo
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX idx_delivery_history_order_id ON delivery_history(order_id);
CREATE INDEX idx_delivery_history_delivered_at ON delivery_history(delivered_at);
CREATE INDEX idx_delivery_history_is_active ON delivery_history(is_active);

-- Restricción de tiempo: solo se puede deshacer dentro de 24 horas
ALTER TABLE delivery_history ADD CONSTRAINT check_delivery_time 
  CHECK (delivered_at >= NOW() - INTERVAL '24 hours' OR is_active = false);

-- Comentarios
COMMENT ON TABLE delivery_history IS 'Historial de entregas para permitir deshacer entregas dentro de 24 horas';
COMMENT ON COLUMN delivery_history.previous_status IS 'Estado del pedido antes de marcar como entregado (finalizado o aprobado)';
COMMENT ON COLUMN delivery_history.stock_consumed IS 'JSON con el stock consumido por cada orden de corte para poder restaurarlo';
COMMENT ON COLUMN delivery_history.is_active IS 'True si la entrega está activa, False si se deshizo';
