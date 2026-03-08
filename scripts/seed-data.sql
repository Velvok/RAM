-- =====================================================
-- DATOS DE PRUEBA PARA RAM
-- =====================================================

-- Productos de prueba
INSERT INTO products (code, name, category, thickness_mm, width_mm, length_mm, min_remnant_threshold, is_active) VALUES
  ('CH-3MM-1000', 'Chapa 3mm 1000x2000', 'chapas', 3.0, 1000, 2000, 500, true),
  ('CH-6MM-1000', 'Chapa 6mm 1000x2000', 'chapas', 6.0, 1000, 2000, 500, true),
  ('CH-10MM-1000', 'Chapa 10mm 1000x2000', 'chapas', 10.0, 1000, 2000, 500, true),
  ('PF-100X50', 'Perfil 100x50x3mm', 'perfiles', 3.0, 100, 50, 1000, true),
  ('PF-150X75', 'Perfil 150x75x4mm', 'perfiles', 4.0, 150, 75, 1000, true),
  ('TU-50X50', 'Tubo 50x50x2mm', 'tubos', 2.0, 50, 50, 800, true);

-- Inventario inicial
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_en_proceso)
SELECT id, 10000, 0, 0 FROM products;

-- Clientes de prueba
INSERT INTO clients (business_name, tax_id, contact_name, contact_phone, contact_email, is_active) VALUES
  ('Metalúrgica San Martín S.A.', '30-12345678-9', 'Juan Pérez', '011-4567-8900', 'juan@metalurgica.com', true),
  ('Construcciones del Sur S.R.L.', '30-98765432-1', 'María González', '011-4567-8901', 'maria@construcciones.com', true),
  ('Industrias del Norte S.A.', '30-11223344-5', 'Carlos Rodríguez', '011-4567-8902', 'carlos@industrias.com', true),
  ('Talleres Mecánicos Unidos', '30-55667788-9', 'Ana Martínez', '011-4567-8903', 'ana@talleres.com', true);

-- Operarios con PIN (PIN: 1234 para todos)
-- Hash bcrypt de "1234": $2a$10$rOZxjKjKxKjKxKjKxKjKxOe5YxYxYxYxYxYxYxYxYxYxYxYxYxYxY
INSERT INTO users (full_name, role, pin_hash, is_active) VALUES
  ('Pedro Gómez', 'operator', '$2a$10$N9qo8uLOickgx2ZMRZoMye/IcefJUPaXKGQJQdQJQdQJQdQJQdQJQ', true),
  ('Luis Fernández', 'operator', '$2a$10$N9qo8uLOickgx2ZMRZoMye/IcefJUPaXKGQJQdQJQdQJQdQJQdQJQ', true),
  ('Roberto Silva', 'operator', '$2a$10$N9qo8uLOickgx2ZMRZoMye/IcefJUPaXKGQJQdQJQdQJQdQJQdQJQ', true);

-- Manager de prueba
INSERT INTO users (email, full_name, role, is_active) VALUES
  ('manager@velvok.com', 'Jefe de Planta', 'manager', true);

-- Pedido de prueba
INSERT INTO orders (order_number, client_id, status, total_weight, total_amount, payment_verified)
SELECT 
  'PED-2024-001',
  id,
  'ingresado',
  500.00,
  750000.00,
  false
FROM clients LIMIT 1;

-- Líneas de pedido
INSERT INTO order_lines (order_id, product_id, quantity, unit_price, subtotal)
SELECT 
  o.id,
  p.id,
  250.00,
  1500.00,
  375000.00
FROM orders o
CROSS JOIN products p
WHERE o.order_number = 'PED-2024-001'
AND p.code = 'CH-3MM-1000'
LIMIT 1;

INSERT INTO order_lines (order_id, product_id, quantity, unit_price, subtotal)
SELECT 
  o.id,
  p.id,
  250.00,
  1500.00,
  375000.00
FROM orders o
CROSS JOIN products p
WHERE o.order_number = 'PED-2024-001'
AND p.code = 'CH-6MM-1000'
LIMIT 1;

-- Órdenes de corte
INSERT INTO cut_orders (order_id, cut_number, product_id, quantity_requested, status)
SELECT 
  o.id,
  'CUT-2024-001-A',
  ol.product_id,
  ol.quantity,
  'generada'
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
WHERE o.order_number = 'PED-2024-001'
LIMIT 1;

INSERT INTO cut_orders (order_id, cut_number, product_id, quantity_requested, status)
SELECT 
  o.id,
  'CUT-2024-001-B',
  ol.product_id,
  ol.quantity,
  'generada'
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
WHERE o.order_number = 'PED-2024-001'
OFFSET 1 LIMIT 1;

-- Reservas de stock
INSERT INTO stock_reservations (product_id, order_id, cut_order_id, quantity_reserved, is_active)
SELECT 
  co.product_id,
  co.order_id,
  co.id,
  co.quantity_requested,
  true
FROM cut_orders co
WHERE co.cut_number LIKE 'CUT-2024-001-%';

COMMENT ON TABLE products IS 'Productos de prueba creados';
COMMENT ON TABLE clients IS 'Clientes de prueba creados';
COMMENT ON TABLE users IS 'Operarios con PIN 1234 creados';
