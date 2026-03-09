-- Vista de stock en tiempo real
-- Combina stock físico de EVO con reservas y procesos de nuestra app

CREATE OR REPLACE VIEW v_stock_real_time AS
SELECT 
  p.id as product_id,
  p.code,
  p.name,
  
  -- Stock físico en EVO (se actualiza vía sync)
  COALESCE(i.stock_total, 0) as stock_evo_total,
  
  -- Stock reservado en nuestra app (suma de longitudes de items reservados)
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.status = 'reservado'), 
    0
  ) as stock_reservado_app,
  
  -- Stock en proceso (cortando ahora)
  COALESCE(
    (SELECT SUM(quantity_requested) 
     FROM cut_orders co 
     WHERE co.product_id = p.id 
     AND co.status IN ('lanzada', 'en_proceso')), 
    0
  ) as stock_en_proceso_app,
  
  -- Stock disponible REAL (lo que realmente se puede usar)
  COALESCE(i.stock_total, 0) - 
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.status IN ('reservado', 'en_uso')), 
    0
  ) as stock_disponible_real,
  
  -- Recortes disponibles (cantidad de items)
  COALESCE(
    (SELECT COUNT(*) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.item_type = 'remnant' 
     AND si.status = 'disponible'), 
    0
  ) as recortes_disponibles,
  
  -- Total metros en recortes disponibles
  COALESCE(
    (SELECT SUM(length) 
     FROM stock_items si 
     WHERE si.product_id = p.id 
     AND si.item_type = 'remnant' 
     AND si.status = 'disponible'), 
    0
  ) as recortes_metros_disponibles,
  
  i.last_sync_at
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id;

-- Índices para mejorar performance de la vista
CREATE INDEX IF NOT EXISTS idx_stock_items_product_status ON stock_items(product_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_type_status ON stock_items(item_type, status);
CREATE INDEX IF NOT EXISTS idx_cut_orders_product_status ON cut_orders(product_id, status);

-- Comentarios
COMMENT ON VIEW v_stock_real_time IS 'Vista en tiempo real del stock: combina stock físico de EVO con reservas y procesos internos';
