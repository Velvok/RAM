-- Agregar estado 'entregado' a los pedidos
-- El stock reservado solo se consume cuando el pedido se marca como entregado

-- Actualizar el check constraint para incluir 'entregado'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('nuevo', 'borrador', 'aprobado', 'en_corte', 'finalizado', 'entregado', 'cancelado'));

-- Comentario
COMMENT ON COLUMN orders.status IS 'Estado del pedido: nuevo, borrador, aprobado, en_corte, finalizado, entregado, cancelado';

-- Función para consumir stock reservado al entregar pedido
CREATE OR REPLACE FUNCTION consume_reserved_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    stock_reservado = GREATEST(0, stock_reservado - 1),
    stock_total = GREATEST(0, stock_total - 1)
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;
