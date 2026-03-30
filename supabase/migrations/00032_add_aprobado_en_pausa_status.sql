-- =====================================================
-- AGREGAR ESTADO "aprobado_en_pausa" A PEDIDOS
-- Este estado permite aprobar pedidos sin asignar stock automáticamente
-- Útil cuando se espera la llegada de material
-- =====================================================

-- Agregar el nuevo estado al enum order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'aprobado_en_pausa';

-- Comentario explicativo
COMMENT ON TYPE order_status IS 'Estados de pedidos: nuevo, aprobado, aprobado_en_pausa, en_corte, pendiente_entrega, entregado, cancelado';
