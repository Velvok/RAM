-- Corregir función consume_reserved_stock
-- El stock reservado ya está incluido en stock_total
-- Cuando se consume stock reservado, solo debe bajar stock_reservado, NO stock_total
-- El stock_total solo baja cuando se entrega el pedido

CREATE OR REPLACE FUNCTION consume_reserved_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    -- NO tocar stock_total - el stock físico sigue ahí hasta la entrega
    stock_reservado = GREATEST(0, stock_reservado - 1)
    -- stock_disponible se calcula automáticamente como (stock_total - stock_reservado - stock_en_proceso)
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION consume_reserved_stock IS 'Consume una unidad de stock reservado al cortar. NO reduce stock_total porque el stock físico sigue existiendo hasta la entrega del pedido.';
