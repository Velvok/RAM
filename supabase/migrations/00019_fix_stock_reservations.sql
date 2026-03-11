-- Script para reservar stock de órdenes de corte existentes
-- Solo para órdenes que tienen material_base_id asignado pero no tienen stock reservado

DO $$
DECLARE
  cut_order_record RECORD;
  inventory_record RECORD;
BEGIN
  -- Iterar sobre todas las órdenes de corte con material asignado
  FOR cut_order_record IN 
    SELECT 
      co.id as cut_order_id,
      co.material_base_id,
      co.status
    FROM cut_orders co
    WHERE co.material_base_id IS NOT NULL
      AND co.status IN ('pendiente', 'generada')
  LOOP
    -- Buscar el inventory del producto asignado
    SELECT i.id, i.stock_reservado, i.product_id
    INTO inventory_record
    FROM inventory i
    WHERE i.product_id = cut_order_record.material_base_id
    LIMIT 1;
    
    IF FOUND THEN
      -- Incrementar stock_reservado
      UPDATE inventory
      SET stock_reservado = COALESCE(stock_reservado, 0) + 1
      WHERE id = inventory_record.id;
      
      -- Registrar movimiento
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        stock_before,
        stock_after,
        notes
      ) VALUES (
        inventory_record.product_id,
        'reserva',
        1,
        COALESCE(inventory_record.stock_reservado, 0),
        COALESCE(inventory_record.stock_reservado, 0) + 1,
        'Reserva retroactiva para orden de corte existente'
      );
      
      RAISE NOTICE 'Reservado stock para cut_order %', cut_order_record.cut_order_id;
    END IF;
  END LOOP;
END $$;
