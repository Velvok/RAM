-- Corregir lógica de reserva de stock
-- stock_total = stock_reservado + stock_generado + stock_disponible

-- Función para reservar stock (NO disminuye stock_total)
CREATE OR REPLACE FUNCTION reserve_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    stock_reservado = stock_reservado + 1
    -- stock_total NO cambia
    -- stock_disponible se calcula automáticamente
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;

-- Función para liberar reserva de stock
CREATE OR REPLACE FUNCTION unreserve_stock(p_inventory_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    stock_reservado = GREATEST(0, stock_reservado - p_quantity)
    -- stock_total NO cambia
    -- stock_disponible se calcula automáticamente
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;

-- Actualizar función de consumo para que SOLO afecte stock_total y stock_reservado
CREATE OR REPLACE FUNCTION consume_reserved_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    stock_total = GREATEST(0, stock_total - 1),
    stock_reservado = GREATEST(0, stock_reservado - 1)
    -- stock_disponible se calcula automáticamente
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;
