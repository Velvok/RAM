-- Simplificar estados de cut_orders
-- Ahora solo: 'pendiente' y 'completada'
-- El pedido es el que tiene estados, no las órdenes de corte individuales

-- 1. Crear nuevo ENUM simplificado
CREATE TYPE cut_order_status_new AS ENUM (
  'pendiente',
  'completada'
);

-- 2. Agregar columna temporal con nuevo tipo
ALTER TABLE cut_orders ADD COLUMN status_new cut_order_status_new;

-- 3. Migrar datos existentes (si hubiera)
UPDATE cut_orders SET status_new = 
  CASE 
    WHEN status::text IN ('generada', 'lanzada', 'en_proceso', 'pausada', 'observada') THEN 'pendiente'::cut_order_status_new
    WHEN status::text IN ('finalizada', 'cancelada') THEN 'completada'::cut_order_status_new
    ELSE 'pendiente'::cut_order_status_new
  END;

-- 4. Eliminar columna antigua
ALTER TABLE cut_orders DROP COLUMN status;

-- 5. Renombrar columna nueva
ALTER TABLE cut_orders RENAME COLUMN status_new TO status;

-- 6. Establecer default
ALTER TABLE cut_orders ALTER COLUMN status SET DEFAULT 'pendiente'::cut_order_status_new;
ALTER TABLE cut_orders ALTER COLUMN status SET NOT NULL;

-- 7. Eliminar ENUM antiguo
DROP TYPE cut_order_status;

-- 8. Renombrar nuevo ENUM
ALTER TYPE cut_order_status_new RENAME TO cut_order_status;

-- Comentario
COMMENT ON COLUMN cut_orders.status IS 'Estado simple: pendiente (no cortado) o completada (cortado)';
