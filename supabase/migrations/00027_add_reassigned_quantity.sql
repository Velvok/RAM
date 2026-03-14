-- Agregar columna para rastrear cuántas unidades fueron reasignadas
ALTER TABLE cut_orders
ADD COLUMN IF NOT EXISTS reassigned_quantity INTEGER DEFAULT NULL;

COMMENT ON COLUMN cut_orders.reassigned_quantity IS 'Número de unidades que fueron reasignadas a esta orden desde otra orden';
