-- Script para duplicar el pedido PED-TEST-1779180554506
-- Genera un nuevo pedido con número PED-TEST-DUPLICATE-{timestamp}

DO $$
DECLARE
  v_original_order_id UUID;
  v_new_order_id UUID;
  v_new_order_number TEXT;
  v_timestamp BIGINT;
BEGIN
  -- Obtener el ID del pedido original
  SELECT id INTO v_original_order_id
  FROM orders
  WHERE order_number = 'PED-TEST-1779180554506'
  LIMIT 1;

  IF v_original_order_id IS NULL THEN
    RAISE EXCEPTION 'Pedido original no encontrado';
  END IF;

  -- Generar nuevo número de pedido
  v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  v_new_order_number := 'PED-TEST-' || v_timestamp;

  RAISE NOTICE 'Duplicando pedido % como %', 'PED-TEST-1779180554506', v_new_order_number;

  -- Duplicar el pedido
  INSERT INTO orders (
    evo_order_id,
    order_number,
    client_id,
    status,
    notes,
    evo_data,
    ref_evo,
    created_at
  )
  SELECT
    v_new_order_number, -- nuevo evo_order_id
    v_new_order_number, -- nuevo order_number
    client_id,
    'nuevo', -- status inicial
    'Pedido duplicado de PED-TEST-1779180554506 para pruebas',
    evo_data,
    ref_evo,
    NOW()
  FROM orders
  WHERE id = v_original_order_id
  RETURNING id INTO v_new_order_id;

  -- Duplicar las líneas del pedido
  INSERT INTO order_lines (
    order_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    units,
    length_meters
  )
  SELECT
    v_new_order_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    units,
    length_meters
  FROM order_lines
  WHERE order_id = v_original_order_id;

  RAISE NOTICE 'Pedido duplicado exitosamente: %', v_new_order_number;
  RAISE NOTICE 'ID del nuevo pedido: %', v_new_order_id;
END $$;
