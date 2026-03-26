-- =====================================================
-- SISTEMA DE HISTORIAL ANUAL
-- Tablas y funciones para tracking de compras/ventas
-- =====================================================

-- =====================================================
-- TABLA: product_weight_conversions
-- Conversiones de producto a peso (kg)
-- =====================================================

CREATE TABLE product_weight_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  length_meters DECIMAL(10,2),
  weight_kg_per_unit DECIMAL(10,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weight_conversions_product ON product_weight_conversions(product_id);
CREATE INDEX idx_weight_conversions_length ON product_weight_conversions(length_meters);

COMMENT ON TABLE product_weight_conversions IS 'Conversiones de productos a peso en kg';
COMMENT ON COLUMN product_weight_conversions.weight_kg_per_unit IS 'Peso en kg por unidad del producto';

-- =====================================================
-- TABLA: annual_history
-- Historial agregado mensual de compras y ventas
-- =====================================================

CREATE TABLE annual_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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

CREATE INDEX idx_annual_history_product ON annual_history(product_id);
CREATE INDEX idx_annual_history_year_month ON annual_history(year, month);
CREATE INDEX idx_annual_history_product_year ON annual_history(product_id, year);

COMMENT ON TABLE annual_history IS 'Historial mensual agregado de compras y ventas por producto';
COMMENT ON COLUMN annual_history.purchases_kg IS 'Total de compras en kg para el mes';
COMMENT ON COLUMN annual_history.sales_kg IS 'Total de ventas en kg para el mes';

-- =====================================================
-- FUNCIÓN: calculate_product_weight
-- Calcula el peso de un producto basado en cantidad y unidades
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_product_weight(
  p_product_id UUID,
  p_quantity DECIMAL,
  p_units INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  v_weight_per_unit DECIMAL;
  v_total_weight DECIMAL;
BEGIN
  -- Intentar obtener peso de la tabla products
  SELECT weight_per_unit INTO v_weight_per_unit
  FROM products
  WHERE id = p_product_id;
  
  -- Si existe weight_per_unit, usarlo
  IF v_weight_per_unit IS NOT NULL AND v_weight_per_unit > 0 THEN
    RETURN p_units * v_weight_per_unit;
  END IF;
  
  -- Intentar obtener de tabla de conversiones
  SELECT weight_kg_per_unit INTO v_weight_per_unit
  FROM product_weight_conversions
  WHERE product_id = p_product_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si existe conversión, usarla
  IF v_weight_per_unit IS NOT NULL AND v_weight_per_unit > 0 THEN
    RETURN p_units * v_weight_per_unit;
  END IF;
  
  -- Si no hay datos, retornar 0 (se debe configurar manualmente)
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_product_weight IS 'Calcula el peso total de un producto basado en unidades';

-- =====================================================
-- FUNCIÓN: update_annual_history_from_order
-- Actualiza el historial anual cuando un pedido es entregado
-- =====================================================

CREATE OR REPLACE FUNCTION update_annual_history_from_order()
RETURNS TRIGGER AS $$
DECLARE
  v_order_line RECORD;
  v_weight_kg DECIMAL;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- Solo procesar cuando el pedido pasa a estado 'entregado'
  IF NEW.status = 'entregado' AND OLD.status != 'entregado' THEN
    -- Extraer año y mes de la fecha de actualización
    v_year := EXTRACT(YEAR FROM NEW.updated_at);
    v_month := EXTRACT(MONTH FROM NEW.updated_at);
    
    -- Procesar cada línea del pedido
    FOR v_order_line IN 
      SELECT product_id, quantity, units
      FROM order_lines
      WHERE order_id = NEW.id
    LOOP
      -- Calcular peso
      v_weight_kg := calculate_product_weight(
        v_order_line.product_id,
        v_order_line.quantity,
        COALESCE(v_order_line.units, 1)
      );
      
      -- Insertar o actualizar historial anual (ventas)
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
        COALESCE(v_order_line.units, 1)
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

-- =====================================================
-- TRIGGER: update_annual_history_on_delivery
-- Dispara actualización de historial cuando pedido es entregado
-- =====================================================

CREATE TRIGGER update_annual_history_on_delivery
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_annual_history_from_order();

COMMENT ON TRIGGER update_annual_history_on_delivery ON orders IS 'Actualiza historial anual cuando un pedido es entregado';

-- =====================================================
-- DATOS DE DEMOSTRACIÓN
-- Poblar conversiones de peso para 6 productos random
-- =====================================================

-- Seleccionar 6 productos random existentes y agregar conversiones de peso
DO $$
DECLARE
  v_product RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_product IN 
    SELECT id, code, name, category
    FROM products
    WHERE is_active = true
    ORDER BY RANDOM()
    LIMIT 6
  LOOP
    v_count := v_count + 1;
    
    -- Insertar conversión de peso (valores de ejemplo)
    INSERT INTO product_weight_conversions (
      product_id,
      weight_kg_per_unit,
      notes
    ) VALUES (
      v_product.id,
      CASE 
        WHEN v_product.category = 'chapa' THEN 25.5 + (v_count * 5)
        WHEN v_product.category = 'alambre' THEN 15.0 + (v_count * 2)
        WHEN v_product.category = 'tejido' THEN 20.0 + (v_count * 3)
        WHEN v_product.category = 'poste' THEN 35.0 + (v_count * 4)
        WHEN v_product.category = 'malla' THEN 18.0 + (v_count * 2.5)
        ELSE 22.0 + (v_count * 3)
      END,
      'Conversión temporal para demostración'
    );
    
    RAISE NOTICE 'Conversión agregada para producto: % (%) - %.2f kg/unidad', 
      v_product.name, v_product.code, 
      CASE 
        WHEN v_product.category = 'chapa' THEN 25.5 + (v_count * 5)
        WHEN v_product.category = 'alambre' THEN 15.0 + (v_count * 2)
        WHEN v_product.category = 'tejido' THEN 20.0 + (v_count * 3)
        WHEN v_product.category = 'poste' THEN 35.0 + (v_count * 4)
        WHEN v_product.category = 'malla' THEN 18.0 + (v_count * 2.5)
        ELSE 22.0 + (v_count * 3)
      END;
  END LOOP;
END $$;

-- =====================================================
-- DATOS DE EJEMPLO PARA HISTORIAL ANUAL
-- Generar datos de demostración para el año actual
-- =====================================================

DO $$
DECLARE
  v_product RECORD;
  v_month INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM NOW());
BEGIN
  -- Para cada producto con conversión
  FOR v_product IN 
    SELECT DISTINCT p.id, p.name
    FROM products p
    INNER JOIN product_weight_conversions pwc ON p.id = pwc.product_id
  LOOP
    -- Generar datos para cada mes del año actual
    FOR v_month IN 1..12 LOOP
      INSERT INTO annual_history (
        product_id,
        year,
        month,
        purchases_kg,
        sales_kg,
        purchases_units,
        sales_units
      ) VALUES (
        v_product.id,
        v_current_year,
        v_month,
        -- Compras: valores random entre 500-1500 kg
        500 + (RANDOM() * 1000)::DECIMAL(12,2),
        -- Ventas: valores random entre 400-1200 kg
        400 + (RANDOM() * 800)::DECIMAL(12,2),
        -- Unidades de compra: random entre 20-60
        (20 + (RANDOM() * 40))::INTEGER,
        -- Unidades de venta: random entre 15-50
        (15 + (RANDOM() * 35))::INTEGER
      );
    END LOOP;
    
    RAISE NOTICE 'Datos de ejemplo generados para producto: %', v_product.name;
  END LOOP;
END $$;

-- =====================================================
-- LIMPIEZA DE DATOS EXISTENTES PARA MODELO DE UNIDADES
-- Resetear contadores de stock manteniendo el stock total
-- =====================================================

-- Eliminar datos relacionados con pedidos
DELETE FROM stock_items;
DELETE FROM stock_reassignments;
DELETE FROM remnants;
DELETE FROM stock_reservations;
DELETE FROM stock_movements;
DELETE FROM cut_orders;
DELETE FROM order_lines;
DELETE FROM orders;

-- Resetear contadores de stock (mantener stock_total)
UPDATE inventory SET 
  stock_reservado = 0,
  stock_en_proceso = 0,
  stock_generado = 0;
