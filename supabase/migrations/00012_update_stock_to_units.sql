-- Actualizar modelo de stock para trabajar con UNIDADES de X metros
-- Ejemplo: "10 chapas de 8m" en vez de "80m totales"

-- 1. Actualizar tabla inventory para manejar unidades
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock_units JSONB DEFAULT '{}';

-- El JSONB tendrá formato: { "6": 10, "8": 15, "12": 5 }
-- Significa: 10 chapas de 6m, 15 chapas de 8m, 5 chapas de 12m

COMMENT ON COLUMN inventory.stock_units IS 'Stock en unidades por longitud: {"6": 10, "8": 15} = 10 chapas de 6m, 15 de 8m';

-- 2. Actualizar stock_items para incluir unidades
-- Ya tiene 'length' que indica los metros de cada item individual

-- 3. Crear función helper para calcular stock total en metros desde unidades
CREATE OR REPLACE FUNCTION calculate_total_meters(units JSONB)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total DECIMAL(10,2) := 0;
  length_key TEXT;
  unit_count INTEGER;
BEGIN
  FOR length_key, unit_count IN SELECT * FROM jsonb_each_text(units)
  LOOP
    total := total + (length_key::DECIMAL * unit_count);
  END LOOP;
  RETURN total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Crear función para obtener unidades disponibles de una longitud específica
CREATE OR REPLACE FUNCTION get_available_units(p_product_id UUID, p_length DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  total_units INTEGER := 0;
  reserved_units INTEGER := 0;
BEGIN
  -- Total de unidades de esa longitud en EVO
  SELECT COALESCE((stock_units->>p_length::TEXT)::INTEGER, 0)
  INTO total_units
  FROM inventory
  WHERE product_id = p_product_id;
  
  -- Unidades reservadas de esa longitud
  SELECT COUNT(*)
  INTO reserved_units
  FROM stock_items
  WHERE product_id = p_product_id
    AND length = p_length
    AND status IN ('reservado', 'en_uso');
  
  RETURN GREATEST(total_units - reserved_units, 0);
END;
$$ LANGUAGE plpgsql;

-- 5. Actualizar vista de stock en tiempo real
DROP VIEW IF EXISTS v_stock_real_time;

CREATE OR REPLACE VIEW v_stock_real_time AS
SELECT 
  p.id as product_id,
  p.code,
  p.name,
  
  -- Stock en unidades (JSONB)
  COALESCE(i.stock_units, '{}'::JSONB) as stock_units,
  
  -- Stock total en metros (calculado desde unidades)
  COALESCE(calculate_total_meters(i.stock_units), 0) as stock_total_metros,
  
  -- Stock reservado en metros (suma de stock_items reservados)
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.status IN ('reservado', 'en_uso')), 
    0
  ) as stock_reservado_metros,
  
  -- Stock disponible en metros
  COALESCE(calculate_total_meters(i.stock_units), 0) - 
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.status IN ('reservado', 'en_uso')), 
    0
  ) as stock_disponible_metros,
  
  -- Recortes disponibles (cantidad)
  COALESCE(
    (SELECT COUNT(*) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.item_type = 'remnant' 
     AND si.status = 'disponible'), 
    0
  ) as recortes_count,
  
  -- Recortes en metros
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.item_type = 'remnant' 
     AND si.status = 'disponible'), 
    0
  ) as recortes_metros,
  
  i.last_sync_at
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id;

COMMENT ON VIEW v_stock_real_time IS 'Vista de stock en tiempo real con unidades por longitud';
