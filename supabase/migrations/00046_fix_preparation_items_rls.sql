-- =====================================================
-- FIX: Recrear políticas RLS para preparation_items
-- =====================================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Allow authenticated users to select preparation_items" ON preparation_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert preparation_items" ON preparation_items;
DROP POLICY IF EXISTS "Allow authenticated users to update preparation_items" ON preparation_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete preparation_items" ON preparation_items;

-- Deshabilitar RLS temporalmente
ALTER TABLE preparation_items DISABLE ROW LEVEL SECURITY;

-- Volver a habilitar RLS
ALTER TABLE preparation_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas permisivas para usuarios autenticados
CREATE POLICY "preparation_items_select_policy"
ON preparation_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "preparation_items_insert_policy"
ON preparation_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "preparation_items_update_policy"
ON preparation_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "preparation_items_delete_policy"
ON preparation_items
FOR DELETE
TO authenticated
USING (true);

-- Verificar que las políticas se crearon
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'preparation_items';
