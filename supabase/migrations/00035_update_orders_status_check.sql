-- =====================================================
-- ACTUALIZAR CHECK CONSTRAINT PARA INCLUIR aprobado_en_pausa
-- =====================================================

-- Eliminar el constraint existente
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Crear el constraint actualizado con el nuevo estado
-- Estados actuales: nuevo, aprobado, aprobado_en_pausa, en_corte, finalizado, entregado, cancelado
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('nuevo', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'entregado', 'cancelado'));

-- Actualizar comentario
COMMENT ON COLUMN orders.status IS 'Estado del pedido: nuevo, aprobado, aprobado_en_pausa, en_corte, finalizado, entregado, cancelado';
