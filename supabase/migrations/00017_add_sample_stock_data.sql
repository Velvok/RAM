-- Limpiar datos actuales y agregar stock de ejemplo similar a EVO
-- Basado en grupo de chapas sinusoidales CINC.25

-- 1. Limpiar productos y stock existente
DELETE FROM stock_items;
DELETE FROM inventory;
DELETE FROM products;

-- 2. Insertar productos de ejemplo (Chapas Sinusoidales CINC.25)
-- Formato similar a EVO: código + descripción con longitud
INSERT INTO products (code, name, description, category, unit, length_meters) VALUES
  -- Chapas de 0.5m
  ('AC25110.0,5', 'Chapa sinusoidal CINC.25 de 0.5m', 'CH.SINUSOIDAL CINC.25 X 0.5 M', 'chapas', 'unidad', 0.5),
  
  -- Chapas de 1.0m
  ('AC25110.1,0', 'Chapa sinusoidal CINC.25 de 1m', 'CH.SINUSOIDAL CINC.25 X 1.0 M', 'chapas', 'unidad', 1.0),
  
  -- Chapas de 1.5m
  ('AC25110.1,5', 'Chapa sinusoidal CINC.25 de 1.5m', 'CH.SINUSOIDAL CINC.25 X 1.5 M', 'chapas', 'unidad', 1.5),
  
  -- Chapas de 10.0m
  ('AC25110.10,0', 'Chapa sinusoidal CINC.25 de 10m', 'CH.SINUSOIDAL CINC.25 X 10.0 M', 'chapas', 'unidad', 10.0),
  
  -- Chapas de 10.5m
  ('AC25110.10,5', 'Chapa sinusoidal CINC.25 de 10.5m', 'CH.SINUSOIDAL CINC.25 X 10.5 M', 'chapas', 'unidad', 10.5),
  
  -- Chapas de 11.0m
  ('AC25110.11,0', 'Chapa sinusoidal CINC.25 de 11m', 'CH.SINUSOIDAL CINC.25 X 11.0 M', 'chapas', 'unidad', 11.0),
  
  -- Chapas de 11.5m
  ('AC25110.11,5', 'Chapa sinusoidal CINC.25 de 11.5m', 'CH.SINUSOIDAL CINC.25 X 11.5 M', 'chapas', 'unidad', 11.5),
  
  -- Chapas de 12.0m
  ('AC25110.12,0', 'Chapa sinusoidal CINC.25 de 12m', 'CH.SINUSOIDAL CINC.25 X 12.0 M', 'chapas', 'unidad', 12.0),
  
  -- Chapas de 12.5m
  ('AC25110.12,5', 'Chapa sinusoidal CINC.25 de 12.5m', 'CH.SINUSOIDAL CINC.25 X 12.5 M', 'chapas', 'unidad', 12.5),
  
  -- Chapas de 13.0m
  ('AC25110.13,0', 'Chapa sinusoidal CINC.25 de 13m', 'CH.SINUSOIDAL CINC.25 X 13.0 M', 'chapas', 'unidad', 13.0),
  
  -- Chapas de 2.0m
  ('AC25110.2,0', 'Chapa sinusoidal CINC.25 de 2m', 'CH.SINUSOIDAL CINC.25 X 2.0 M', 'chapas', 'unidad', 2.0),
  
  -- Chapas de 2.5m
  ('AC25110.2,5', 'Chapa sinusoidal CINC.25 de 2.5m', 'CH.SINUSOIDAL CINC.25 X 2.5 M', 'chapas', 'unidad', 2.5),
  
  -- Chapas de 3.0m
  ('AC25110.3,0', 'Chapa sinusoidal CINC.25 de 3m', 'CH.SINUSOIDAL CINC.25 X 3.0 M', 'chapas', 'unidad', 3.0),
  
  -- Chapas de 3.5m
  ('AC25110.3,5', 'Chapa sinusoidal CINC.25 de 3.5m', 'CH.SINUSOIDAL CINC.25 X 3.5 M', 'chapas', 'unidad', 3.5),
  
  -- Chapas de 4.0m
  ('AC25110.4,0', 'Chapa sinusoidal CINC.25 de 4m', 'CH.SINUSOIDAL CINC.25 X 4.0 M', 'chapas', 'unidad', 4.0),
  
  -- Chapas de 4.5m
  ('AC25110.4,5', 'Chapa sinusoidal CINC.25 de 4.5m', 'CH.SINUSOIDAL CINC.25 X 4.5 M', 'chapas', 'unidad', 4.5),
  
  -- Chapas de 5.0m
  ('AC25110.5,0', 'Chapa sinusoidal CINC.25 de 5m', 'CH.SINUSOIDAL CINC.25 X 5.0 M', 'chapas', 'unidad', 5.0),
  
  -- Chapas de 5.5m
  ('AC25110.5,5', 'Chapa sinusoidal CINC.25 de 5.5m', 'CH.SINUSOIDAL CINC.25 X 5.5 M', 'chapas', 'unidad', 5.5),
  
  -- Chapas de 6.0m
  ('AC25110.6,0', 'Chapa sinusoidal CINC.25 de 6m', 'CH.SINUSOIDAL CINC.25 X 6.0 M', 'chapas', 'unidad', 6.0),
  
  -- Chapas de 6.5m
  ('AC25110.6,5', 'Chapa sinusoidal CINC.25 de 6.5m', 'CH.SINUSOIDAL CINC.25 X 6.5 M', 'chapas', 'unidad', 6.5),
  
  -- Chapas de 7.0m
  ('AC25110.7,0', 'Chapa sinusoidal CINC.25 de 7m', 'CH.SINUSOIDAL CINC.25 X 7.0 M', 'chapas', 'unidad', 7.0),
  
  -- Chapas de 7.5m
  ('AC25110.7,5', 'Chapa sinusoidal CINC.25 de 7.5m', 'CH.SINUSOIDAL CINC.25 X 7.5 M', 'chapas', 'unidad', 7.5),
  
  -- Chapas de 8.0m
  ('AC25110.8,0', 'Chapa sinusoidal CINC.25 de 8m', 'CH.SINUSOIDAL CINC.25 X 8.0 M', 'chapas', 'unidad', 8.0),
  
  -- Chapas de 8.5m
  ('AC25110.8,5', 'Chapa sinusoidal CINC.25 de 8.5m', 'CH.SINUSOIDAL CINC.25 X 8.5 M', 'chapas', 'unidad', 8.5),
  
  -- Chapas de 9.0m
  ('AC25110.9,0', 'Chapa sinusoidal CINC.25 de 9m', 'CH.SINUSOIDAL CINC.25 X 9.0 M', 'chapas', 'unidad', 9.0),
  
  -- Chapas de 9.5m
  ('AC25110.9,5', 'Chapa sinusoidal CINC.25 de 9.5m', 'CH.SINUSOIDAL CINC.25 X 9.5 M', 'chapas', 'unidad', 9.5);

-- 3. Crear inventario para cada producto
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_en_proceso, stock_units)
SELECT 
  id,
  0,
  0,
  0,
  '{}'::JSONB
FROM products;

-- 4. Agregar stock de ejemplo (basado en la imagen de EVO)
-- IMPORTANTE: Este es el STOCK TOTAL que viene de EVO
-- Los valores pueden ser negativos (pedidos pendientes) o positivos (disponible)
-- A partir de aquí, RAM gestiona internamente: reservado, en_proceso, etc.

-- Actualizar stock_total y stock_units con datos reales de EVO
UPDATE inventory SET 
  stock_total = -893,
  stock_units = '{"0.5": -893}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.0,5');

UPDATE inventory SET 
  stock_total = -8493.50,
  stock_units = '{"1.0": -8493.50}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.1,0');

UPDATE inventory SET 
  stock_total = -3188,
  stock_units = '{"1.5": -3188}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.1,5');

UPDATE inventory SET 
  stock_total = 1072,
  stock_units = '{"10.0": 1072}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.10,0');

UPDATE inventory SET 
  stock_total = 1355,
  stock_units = '{"10.5": 1355}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.10,5');

UPDATE inventory SET 
  stock_total = 1011,
  stock_units = '{"11.0": 1011}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.11,0');

UPDATE inventory SET 
  stock_total = 2020,
  stock_units = '{"11.5": 2020}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.11,5');

UPDATE inventory SET 
  stock_total = 2763,
  stock_units = '{"12.0": 2763}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.12,0');

UPDATE inventory SET 
  stock_total = 3042,
  stock_units = '{"12.5": 3042}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.12,5');

UPDATE inventory SET 
  stock_total = 3945,
  stock_units = '{"13.0": 3945}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.13,0');

UPDATE inventory SET 
  stock_total = -5415,
  stock_units = '{"2.0": -5415}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.2,0');

UPDATE inventory SET 
  stock_total = -6848,
  stock_units = '{"2.5": -6848}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.2,5');

UPDATE inventory SET 
  stock_total = -9810,
  stock_units = '{"3.0": -9810}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.3,0');

UPDATE inventory SET 
  stock_total = -9838,
  stock_units = '{"3.5": -9838}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.3,5');

UPDATE inventory SET 
  stock_total = -9417,
  stock_units = '{"4.0": -9417}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.4,0');

UPDATE inventory SET 
  stock_total = -8746,
  stock_units = '{"4.5": -8746}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.4,5');

UPDATE inventory SET 
  stock_total = -7151,
  stock_units = '{"5.0": -7151}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.5,0');

UPDATE inventory SET 
  stock_total = -4161,
  stock_units = '{"5.5": -4161}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.5,5');

UPDATE inventory SET 
  stock_total = -2353,
  stock_units = '{"6.0": -2353}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.6,0');

UPDATE inventory SET 
  stock_total = -22,
  stock_units = '{"6.5": -22}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.6,5');

UPDATE inventory SET 
  stock_total = -26101.40,
  stock_units = '{"7.0": -26101.40}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.7,0');

UPDATE inventory SET 
  stock_total = -766,
  stock_units = '{"7.5": -766}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.7,5');

UPDATE inventory SET 
  stock_total = -863,
  stock_units = '{"8.0": -863}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.8,0');

UPDATE inventory SET 
  stock_total = -184,
  stock_units = '{"8.5": -184}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.8,5');

UPDATE inventory SET 
  stock_total = 137,
  stock_units = '{"9.0": 137}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.9,0');

UPDATE inventory SET 
  stock_total = 1730,
  stock_units = '{"9.5": 1730}'::JSONB 
WHERE product_id = (SELECT id FROM products WHERE code = 'AC25110.9,5');

COMMENT ON TABLE products IS 'Productos de ejemplo: Chapas Sinusoidales CINC.25 (formato similar a EVO)';
