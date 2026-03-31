-- Migración: Sistema de Historial Anual con Conversión de Pesos
-- Crea tablas y funciones para rastrear compras y ventas mensuales por producto

-- 1. Tabla de conversión de pesos (para productos sin weight_per_unit)
CREATE TABLE IF NOT EXISTS product_weight_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  length_meters DECIMAL(10,2),
  weight_kg DECIMAL(10,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, length_meters)
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_weight_conversions_product ON product_weight_conversions(product_id);

-- 2. Tabla de historial anual agregado
CREATE TABLE IF NOT EXISTS annual_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  purchases_kg DECIMAL(12,2) DEFAULT 0,
  sales_kg DECIMAL(12,2) DEFAULT 0,
  purchases_units INTEGER DEFAULT 0,
  sales_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, year, month)
);

-- Índices para consultas eficientes
CREATE INDEX idx_annual_history_product ON annual_history(product_id);
CREATE INDEX idx_annual_history_year_month ON annual_history(year, month);
CREATE INDEX idx_annual_history_product_year ON annual_history(product_id, year);

-- 3. Función para calcular peso de un producto
CREATE OR REPLACE FUNCTION calculate_product_weight(
  p_product_id UUID,
  p_quantity DECIMAL,
  p_units INTEGER,
  p_length_meters DECIMAL DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
  v_weight_per_unit DECIMAL;
  v_conversion_weight DECIMAL;
  v_total_weight DECIMAL;
BEGIN
  -- Prioridad 1: Usar weight_per_unit del producto si existe
  SELECT weight_per_unit INTO v_weight_per_unit
  FROM products
  WHERE id = p_product_id;
  
  IF v_weight_per_unit IS NOT NULL AND v_weight_per_unit > 0 THEN
    RETURN p_units * v_weight_per_unit;
  END IF;
  
  -- Prioridad 2: Buscar en tabla de conversión
  IF p_length_meters IS NOT NULL THEN
    SELECT weight_kg INTO v_conversion_weight
    FROM product_weight_conversions
    WHERE product_id = p_product_id 
      AND length_meters = p_length_meters
    LIMIT 1;
    
    IF v_conversion_weight IS NOT NULL THEN
      RETURN p_units * v_conversion_weight;
    END IF;
  END IF;
  
  -- Prioridad 3: Estimación por defecto (100kg por unidad)
  -- En producción, esto debería ajustarse por categoría de producto
  RETURN p_units * 100.0;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para actualizar historial anual cuando se entrega un pedido
CREATE OR REPLACE FUNCTION update_annual_history()
RETURNS TRIGGER AS $$
DECLARE
  v_order_line RECORD;
  v_weight_kg DECIMAL;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- Solo procesar cuando el pedido pasa a estado 'entregado'
  IF NEW.status = 'entregado' AND (OLD.status IS NULL OR OLD.status != 'entregado') THEN
    -- Extraer año y mes de la fecha de entrega
    v_year := EXTRACT(YEAR FROM NEW.updated_at);
    v_month := EXTRACT(MONTH FROM NEW.updated_at);
    
    -- Procesar cada línea del pedido
    FOR v_order_line IN 
      SELECT 
        ol.product_id,
        ol.quantity,
        ol.units,
        ol.length_meters,
        p.weight_per_unit
      FROM order_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.order_id = NEW.id
    LOOP
      -- Calcular peso de esta línea
      v_weight_kg := calculate_product_weight(
        v_order_line.product_id,
        v_order_line.quantity,
        v_order_line.units,
        v_order_line.length_meters
      );
      
      -- Insertar o actualizar en annual_history
      INSERT INTO annual_history (
        product_id,
        year,
        month,
        sales_kg,
        sales_units
      ) VALUES (
        v_order_line.product_id,
        v_year,
        v_month,
        v_weight_kg,
        v_order_line.units
      )
      ON CONFLICT (product_id, year, month)
      DO UPDATE SET
        sales_kg = annual_history.sales_kg + EXCLUDED.sales_kg,
        sales_units = annual_history.sales_units + EXCLUDED.sales_units,
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para actualizar historial automáticamente
DROP TRIGGER IF EXISTS trigger_update_annual_history ON orders;
CREATE TRIGGER trigger_update_annual_history
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_annual_history();

-- 6. Comentarios para documentación
COMMENT ON TABLE product_weight_conversions IS 'Tabla de conversión de pesos para productos sin weight_per_unit definido';
COMMENT ON TABLE annual_history IS 'Historial agregado mensual de compras y ventas por producto en kilogramos';
COMMENT ON FUNCTION calculate_product_weight IS 'Calcula el peso total de un producto basado en cantidad y unidades';
COMMENT ON FUNCTION update_annual_history IS 'Actualiza el historial anual cuando un pedido se marca como entregado';
