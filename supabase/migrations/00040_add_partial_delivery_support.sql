-- =====================================================
-- SOPORTE PARA RETIRADAS PARCIALES DE PEDIDOS
-- Permite a los clientes retirar cantidades parciales
-- =====================================================

-- 1. Agregar nuevo estado 'parcialmente_entregado' al enum order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'parcialmente_entregado';

-- 2. Modificar tabla delivery_history para soportar retiradas parciales
ALTER TABLE delivery_history 
ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'complete' CHECK (delivery_type IN ('complete', 'partial'));

-- Agregar columnas para rastrear qué items se retiraron parcialmente
ALTER TABLE delivery_history 
ADD COLUMN IF NOT EXISTS items_delivered JSONB;

-- Modificar constraint de tiempo para permitir más flexibilidad en retiradas parciales
ALTER TABLE delivery_history DROP CONSTRAINT IF EXISTS check_delivery_time;
ALTER TABLE delivery_history ADD CONSTRAINT check_delivery_time 
  CHECK (delivered_at >= NOW() - INTERVAL '24 hours' OR delivery_type = 'partial' OR is_active = false);

-- Comentarios
COMMENT ON COLUMN delivery_history.delivery_type IS 'Tipo de entrega: complete (entrega completa) o partial (retirada parcial)';
COMMENT ON COLUMN delivery_history.items_delivered IS 'Items entregados en esta retirada: [{cut_order_id, quantity, preparation_item_id, quantity}]';
