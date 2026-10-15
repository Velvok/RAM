-- =====================================================
-- AÑADIR ESTADO parcialmente_entregado AL CONSTRAINT DE orders.status
-- =====================================================
-- La UI (app/admin/pedidos/[id]/order-detail-client.tsx) ya referenciaba este
-- estado para pedidos con una entrega parcial, pero nunca existió en el
-- constraint real ni se llegaba a asignar desde el webhook de entrega parcial
-- (app/api/webhooks/pedidos/entregado/route.ts, processPartialDelivery).
-- Esta migración lo añade y el código se actualiza en el mismo cambio para
-- asignarlo de verdad tras una entrega parcial.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('nuevo', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'parcialmente_entregado', 'entregado', 'cancelado'));

COMMENT ON COLUMN orders.status IS 'Estado del pedido: nuevo, aprobado, aprobado_en_pausa, en_corte, finalizado, parcialmente_entregado, entregado, cancelado';
