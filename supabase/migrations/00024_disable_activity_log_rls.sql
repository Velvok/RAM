-- Desactivar RLS temporalmente para order_activity_log
-- Esto permite que cualquier usuario autenticado pueda insertar logs

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Anyone can read order activity log" ON order_activity_log;
DROP POLICY IF EXISTS "Authenticated users can insert order activity log" ON order_activity_log;
DROP POLICY IF EXISTS "Authenticated users can update order activity log" ON order_activity_log;

-- Desactivar RLS completamente
ALTER TABLE order_activity_log DISABLE ROW LEVEL SECURITY;

-- Comentario
COMMENT ON TABLE order_activity_log IS 'Registro de actividades - RLS desactivado para permitir inserts desde server actions';
