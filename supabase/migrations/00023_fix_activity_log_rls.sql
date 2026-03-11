-- Arreglar política RLS de order_activity_log
-- La política actual es demasiado restrictiva

-- Eliminar política anterior
DROP POLICY IF EXISTS "Authenticated users can insert order activity log" ON order_activity_log;

-- Nueva política: Permitir insertar a usuarios autenticados
CREATE POLICY "Authenticated users can insert order activity log"
  ON order_activity_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- También permitir actualizar (por si acaso)
CREATE POLICY "Authenticated users can update order activity log"
  ON order_activity_log
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);
