-- =====================================================
-- AÑADIR ESTADO 'ENTREGADO' A CUT_ORDER_STATUS
-- =====================================================

-- Como PostgreSQL no permite modificar ENUMs directamente, necesitamos recrearlo
-- 1. Crear nuevo ENUM con el estado adicional
CREATE TYPE cut_order_status_new AS ENUM (
  'pendiente',
  'completada',
  'entregado'
);

-- 2. Agregar columna temporal con nuevo tipo
ALTER TABLE cut_orders ADD COLUMN status_new cut_order_status_new;

-- 3. Migrar datos existentes
UPDATE cut_orders SET status_new = 
  CASE 
    WHEN status = 'pendiente' THEN 'pendiente'::cut_order_status_new
    WHEN status = 'completada' THEN 'completada'::cut_order_status_new
    ELSE 'pendiente'::cut_order_status_new
  END;

-- 4. Eliminar columna vieja y renombrar la nueva
ALTER TABLE cut_orders DROP COLUMN status;
ALTER TABLE cut_orders RENAME COLUMN status_new TO status;

-- 5. Eliminar el ENUM viejo
DROP TYPE cut_order_status;

-- 6. Renombrar el nuevo ENUM
ALTER TYPE cut_order_status_new RENAME TO cut_order_status;

-- 7. Actualizar comentarios
COMMENT ON COLUMN cut_orders.status IS 'Estado: pendiente, completada, entregado';
