-- =====================================================
-- AÑADIR ESTADO 'ENTREGADO' A PREPARATION_ITEMS
-- =====================================================

-- Eliminar el CHECK constraint viejo
ALTER TABLE preparation_items DROP CONSTRAINT IF EXISTS preparation_items_status_check;

-- Agregar nuevo CHECK constraint con el estado adicional
ALTER TABLE preparation_items ADD CONSTRAINT preparation_items_status_check 
  CHECK (status IN ('pendiente', 'en_proceso', 'completada', 'entregado'));

-- Actualizar comentario
COMMENT ON COLUMN preparation_items.status IS 'Estado: pendiente, en_proceso, completada, entregado';
