-- Verificar si existen preparation_items
SELECT 
  id,
  order_id,
  product_id,
  quantity_requested,
  quantity_prepared,
  status,
  created_at
FROM preparation_items
WHERE order_id = '5f62c62f-fa19-4fd5-846e-21c0d3ca4da4';

-- Verificar políticas RLS activas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'preparation_items';

-- Verificar si RLS está habilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'preparation_items';
