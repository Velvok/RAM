-- =====================================================
-- TEMPORAL: Deshabilitar RLS en preparation_items
-- =====================================================

-- Deshabilitar RLS completamente
ALTER TABLE preparation_items DISABLE ROW LEVEL SECURITY;

-- Comentario
COMMENT ON TABLE preparation_items IS 'RLS DESHABILITADO TEMPORALMENTE - Artículos a preparar que no requieren corte';
