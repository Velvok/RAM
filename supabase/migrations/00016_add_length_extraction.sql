-- Función para extraer longitud de descripción de productos
-- Soporta formatos: "1,2X12", "de 8m", "8 metros", etc.

CREATE OR REPLACE FUNCTION extract_length_from_description(description TEXT)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  length_match TEXT;
BEGIN
  -- Patrón 1: "1,2X12" o "1.2X12" → extraer el segundo número (12)
  length_match := (regexp_match(description, '\d+(?:[.,]\d+)?\s*[Xx]\s*(\d+(?:[.,]\d+)?)'))[1];
  
  -- Patrón 2: "de 8m" o "8 metros" o "8m"
  IF length_match IS NULL THEN
    length_match := (regexp_match(description, '(\d+(?:[.,]\d+)?)\s*m(?:etros)?', 'i'))[1];
  END IF;
  
  -- Patrón 3: Solo número al final del nombre (ej: "Chapa acanalada de 6m")
  IF length_match IS NULL THEN
    length_match := (regexp_match(description, 'de\s+(\d+(?:[.,]\d+)?)', 'i'))[1];
  END IF;
  
  IF length_match IS NOT NULL THEN
    -- Reemplazar coma por punto para decimal
    RETURN CAST(REPLACE(length_match, ',', '.') AS DECIMAL(10,2));
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Agregar columna length_meters a products si no existe
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_meters DECIMAL(10,2);

-- Actualizar productos existentes extrayendo longitud de nombre y descripción
UPDATE products 
SET length_meters = extract_length_from_description(COALESCE(name, '') || ' ' || COALESCE(description, ''))
WHERE length_meters IS NULL;

-- Índice para búsquedas rápidas por longitud
CREATE INDEX IF NOT EXISTS idx_products_length ON products(length_meters) 
WHERE length_meters IS NOT NULL;

-- Comentarios
COMMENT ON FUNCTION extract_length_from_description IS 'Extrae la longitud en metros de la descripción de un producto';
COMMENT ON COLUMN products.length_meters IS 'Longitud en metros extraída automáticamente de la descripción del producto';
