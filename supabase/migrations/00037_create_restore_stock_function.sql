-- =====================================================
-- FUNCIÓN PARA RESTAURAR STOCK RESERVADO (OPUESTO DE consume_reserved_stock)
-- Se usa al deshacer una entrega para devolver el stock al inventario
-- =====================================================

CREATE OR REPLACE FUNCTION restore_reserved_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET
    stock_total = stock_total + 1,
    stock_reservado = stock_reservado + 1
    -- stock_disponible se calcula automáticamente
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario explicativo
COMMENT ON FUNCTION restore_reserved_stock IS 'Restaura 1 unidad de stock reservado al deshacer una entrega. Aumenta stock_total (material vuelve al almacén) y stock_reservado (vuelve a estar reservado). El stock_disponible se mantiene igual.';
