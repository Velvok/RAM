-- ============================================
-- PASO 1: Agregar nuevos valores al ENUM
-- ============================================
-- IMPORTANTE: Ejecuta SOLO este paso primero, luego ejecuta el PASO 2

-- Agregar nuevos valores al ENUM order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'nuevo';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'aprobado';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'finalizado';
