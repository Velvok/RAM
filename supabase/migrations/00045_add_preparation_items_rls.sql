-- =====================================================
-- RLS Policies para preparation_items
-- =====================================================

-- Habilitar RLS en la tabla
ALTER TABLE preparation_items ENABLE ROW LEVEL SECURITY;

-- Política: Permitir SELECT a usuarios autenticados
CREATE POLICY "Allow authenticated users to select preparation_items"
ON preparation_items
FOR SELECT
TO authenticated
USING (true);

-- Política: Permitir INSERT a usuarios autenticados
CREATE POLICY "Allow authenticated users to insert preparation_items"
ON preparation_items
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: Permitir UPDATE a usuarios autenticados
CREATE POLICY "Allow authenticated users to update preparation_items"
ON preparation_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política: Permitir DELETE a usuarios autenticados
CREATE POLICY "Allow authenticated users to delete preparation_items"
ON preparation_items
FOR DELETE
TO authenticated
USING (true);

-- Comentarios
COMMENT ON POLICY "Allow authenticated users to select preparation_items" ON preparation_items IS 'Permite a usuarios autenticados leer preparation_items';
COMMENT ON POLICY "Allow authenticated users to insert preparation_items" ON preparation_items IS 'Permite a usuarios autenticados crear preparation_items';
COMMENT ON POLICY "Allow authenticated users to update preparation_items" ON preparation_items IS 'Permite a usuarios autenticados actualizar preparation_items';
COMMENT ON POLICY "Allow authenticated users to delete preparation_items" ON preparation_items IS 'Permite a usuarios autenticados eliminar preparation_items';
