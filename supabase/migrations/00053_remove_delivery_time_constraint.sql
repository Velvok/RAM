-- =====================================================
-- ELIMINAR COMPLETAMENTE LA RESTRICCIÓN DE 24 HORAS
-- =====================================================

-- Eliminar el constraint de tiempo para permitir deshacer entregas en cualquier momento
ALTER TABLE delivery_history DROP CONSTRAINT IF EXISTS check_delivery_time;

-- Actualizar comentario de la tabla
COMMENT ON TABLE delivery_history IS 'Historial de entregas para permitir deshacer entregas en cualquier momento';
