-- Crear tabla para log de actividades de pedidos
-- Registra todas las acciones importantes: reasignaciones, cambios de estado, etc.

CREATE TABLE IF NOT EXISTS order_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cut_order_id UUID REFERENCES cut_orders(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL, -- 'reassign', 'status_change', 'stock_assign', etc.
  description TEXT NOT NULL,
  metadata JSONB, -- Datos adicionales (IDs de órdenes, productos, etc.)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX idx_order_activity_log_order_id ON order_activity_log(order_id);
CREATE INDEX idx_order_activity_log_created_at ON order_activity_log(created_at DESC);
CREATE INDEX idx_order_activity_log_activity_type ON order_activity_log(activity_type);

-- Comentarios
COMMENT ON TABLE order_activity_log IS 'Registro de todas las actividades y transacciones de pedidos';
COMMENT ON COLUMN order_activity_log.activity_type IS 'Tipo de actividad: reassign, status_change, stock_assign, etc.';
COMMENT ON COLUMN order_activity_log.metadata IS 'Datos adicionales en formato JSON';

-- RLS (Row Level Security)
ALTER TABLE order_activity_log ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer
CREATE POLICY "Anyone can read order activity log"
  ON order_activity_log
  FOR SELECT
  USING (true);

-- Política: Solo usuarios autenticados pueden insertar
CREATE POLICY "Authenticated users can insert order activity log"
  ON order_activity_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
