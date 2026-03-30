-- =====================================================
-- DESHABILITAR RLS EN TABLAS DE HISTORIAL
-- Estas tablas son internas y se actualizan mediante triggers
-- No necesitan políticas RLS ya que no se acceden directamente desde el cliente
-- =====================================================

-- Deshabilitar RLS en annual_history
ALTER TABLE annual_history DISABLE ROW LEVEL SECURITY;

-- Deshabilitar RLS en product_weight_conversions (si está habilitado)
ALTER TABLE product_weight_conversions DISABLE ROW LEVEL SECURITY;

-- Comentario explicativo
COMMENT ON TABLE annual_history IS 'Historial mensual agregado de compras y ventas por producto (sin RLS - actualizado por triggers)';
COMMENT ON TABLE product_weight_conversions IS 'Conversiones de productos a peso en kg (sin RLS - datos de configuración)';
