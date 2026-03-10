-- Actualizar productos existentes con nombres descriptivos
-- Formato: "[Tipo de chapa] de [longitud]m"
-- Tipos: Acanalada, Lisa, Trapezoidal, Grecada

-- Primero, limpiar productos existentes
DELETE FROM products;

-- Insertar productos con nombres descriptivos
-- CHAPA ACANALADA
INSERT INTO products (code, name, description, category, unit_of_measure) VALUES
  ('ACAN-6M', 'Chapa acanalada de 6m', 'Chapa acanalada de acero galvanizado, 6 metros de longitud', 'chapas', 'unidad'),
  ('ACAN-8M', 'Chapa acanalada de 8m', 'Chapa acanalada de acero galvanizado, 8 metros de longitud', 'chapas', 'unidad'),
  ('ACAN-10M', 'Chapa acanalada de 10m', 'Chapa acanalada de acero galvanizado, 10 metros de longitud', 'chapas', 'unidad'),
  ('ACAN-12M', 'Chapa acanalada de 12m', 'Chapa acanalada de acero galvanizado, 12 metros de longitud', 'chapas', 'unidad'),
  
  -- CHAPA LISA
  ('LISA-6M', 'Chapa lisa de 6m', 'Chapa lisa de acero galvanizado, 6 metros de longitud', 'chapas', 'unidad'),
  ('LISA-8M', 'Chapa lisa de 8m', 'Chapa lisa de acero galvanizado, 8 metros de longitud', 'chapas', 'unidad'),
  ('LISA-10M', 'Chapa lisa de 10m', 'Chapa lisa de acero galvanizado, 10 metros de longitud', 'chapas', 'unidad'),
  ('LISA-12M', 'Chapa lisa de 12m', 'Chapa lisa de acero galvanizado, 12 metros de longitud', 'chapas', 'unidad'),
  
  -- CHAPA TRAPEZOIDAL
  ('TRAP-6M', 'Chapa trapezoidal de 6m', 'Chapa trapezoidal de acero galvanizado, 6 metros de longitud', 'chapas', 'unidad'),
  ('TRAP-8M', 'Chapa trapezoidal de 8m', 'Chapa trapezoidal de acero galvanizado, 8 metros de longitud', 'chapas', 'unidad'),
  ('TRAP-10M', 'Chapa trapezoidal de 10m', 'Chapa trapezoidal de acero galvanizado, 10 metros de longitud', 'chapas', 'unidad'),
  ('TRAP-12M', 'Chapa trapezoidal de 12m', 'Chapa trapezoidal de acero galvanizado, 12 metros de longitud', 'chapas', 'unidad'),
  
  -- CHAPA GRECADA
  ('GREC-6M', 'Chapa grecada de 6m', 'Chapa grecada de acero galvanizado, 6 metros de longitud', 'chapas', 'unidad'),
  ('GREC-8M', 'Chapa grecada de 8m', 'Chapa grecada de acero galvanizado, 8 metros de longitud', 'chapas', 'unidad'),
  ('GREC-10M', 'Chapa grecada de 10m', 'Chapa grecada de acero galvanizado, 10 metros de longitud', 'chapas', 'unidad'),
  ('GREC-12M', 'Chapa grecada de 12m', 'Chapa grecada de acero galvanizado, 12 metros de longitud', 'chapas', 'unidad');

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
