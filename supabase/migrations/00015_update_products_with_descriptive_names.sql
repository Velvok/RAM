-- Actualizar productos existentes con nombres descriptivos
-- Formato: "Chapa [espesor]mm de [longitud]m"

-- Primero, limpiar productos existentes
DELETE FROM products;

-- Insertar productos con nombres descriptivos
INSERT INTO products (code, name, description, category, unit_of_measure) VALUES
  ('CH-3MM-6M', 'Chapa 3mm de 6m', 'Chapa de acero de 3mm de espesor, 6 metros de longitud', 'chapas', 'unidad'),
  ('CH-3MM-8M', 'Chapa 3mm de 8m', 'Chapa de acero de 3mm de espesor, 8 metros de longitud', 'chapas', 'unidad'),
  ('CH-3MM-10M', 'Chapa 3mm de 10m', 'Chapa de acero de 3mm de espesor, 10 metros de longitud', 'chapas', 'unidad'),
  ('CH-3MM-12M', 'Chapa 3mm de 12m', 'Chapa de acero de 3mm de espesor, 12 metros de longitud', 'chapas', 'unidad'),
  
  ('CH-6MM-6M', 'Chapa 6mm de 6m', 'Chapa de acero de 6mm de espesor, 6 metros de longitud', 'chapas', 'unidad'),
  ('CH-6MM-8M', 'Chapa 6mm de 8m', 'Chapa de acero de 6mm de espesor, 8 metros de longitud', 'chapas', 'unidad'),
  ('CH-6MM-10M', 'Chapa 6mm de 10m', 'Chapa de acero de 6mm de espesor, 10 metros de longitud', 'chapas', 'unidad'),
  ('CH-6MM-12M', 'Chapa 6mm de 12m', 'Chapa de acero de 6mm de espesor, 12 metros de longitud', 'chapas', 'unidad'),
  
  ('CH-10MM-6M', 'Chapa 10mm de 6m', 'Chapa de acero de 10mm de espesor, 6 metros de longitud', 'chapas', 'unidad'),
  ('CH-10MM-8M', 'Chapa 10mm de 8m', 'Chapa de acero de 10mm de espesor, 8 metros de longitud', 'chapas', 'unidad'),
  ('CH-10MM-10M', 'Chapa 10mm de 10m', 'Chapa de acero de 10mm de espesor, 10 metros de longitud', 'chapas', 'unidad'),
  ('CH-10MM-12M', 'Chapa 10mm de 12m', 'Chapa de acero de 10mm de espesor, 12 metros de longitud', 'chapas', 'unidad');

-- Crear inventario inicial para estos productos
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_en_proceso, stock_units)
SELECT 
  id,
  0, -- stock_total se calculará desde stock_units
  0,
  0,
  '{}'::JSONB -- Inicialmente vacío, se llenará vía sync con EVO
FROM products;

COMMENT ON TABLE products IS 'Productos con nombres descriptivos: Chapa [espesor]mm de [longitud]m';
