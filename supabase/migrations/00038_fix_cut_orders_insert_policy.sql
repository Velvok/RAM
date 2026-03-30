-- =====================================================
-- FIX: Agregar políticas de INSERT para cut_orders
-- Las políticas FOR ALL con USING no funcionan correctamente para INSERT
-- =====================================================

-- Eliminar políticas existentes que pueden estar causando problemas
DROP POLICY IF EXISTS "Admin full access" ON cut_orders;
DROP POLICY IF EXISTS "Manager operational access" ON cut_orders;

-- Recrear políticas con WITH CHECK para INSERT
CREATE POLICY "Admin full access to cut_orders" ON cut_orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Manager full access to cut_orders" ON cut_orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Comentario
COMMENT ON TABLE cut_orders IS 'Órdenes de corte con políticas RLS corregidas para permitir INSERT';
