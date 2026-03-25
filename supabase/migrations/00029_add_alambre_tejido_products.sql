-- Agregar productos de alambre, tejido, postes y mallas
-- Grupo 02: Alambres, Tejidos, Postes y Mallas

-- Insertar productos del Grupo 02, SubGrupo 60 (Alambres)
INSERT INTO products (code, name, unit, category) VALUES
('AJR17/15', 'Rollo Alambre A/R 17/15', 'rollo', 'alambre'),
('PUA', 'Rollo Al.Pua BAGUAL MINI 16X4"', 'rollo', 'alambre'),
('PUABAGUAL', 'Rollo Al.Pua BAGUAL 16x5/4500', 'rollo', 'alambre'),
('PUABULLDOG', 'Rollo Alambre Pua BULL DOG 16', 'rollo', 'alambre'),
('PUASUPERBAG', 'Rollo Al.Pua SUPER BAGUAL 15-101', 'rollo', 'alambre');

-- Insertar productos del Grupo 02, SubGrupo 62 (Alambre Galvanizado)
INSERT INTO products (code, name, unit, category) VALUES
('ALAMG14', 'Kg.Alambre GALVANIZ.N§14« c/rollos', 'kg', 'alambre');

-- Insertar productos del Grupo 02, SubGrupo 65 (Tejido Cuadrangular)
INSERT INTO products (code, name, unit, category) VALUES
('TEJ/CUAD', 'Ro.Tejido Cuadrangular 8-71-15-12 x 100', 'rollo', 'tejido');

-- Insertar productos del Grupo 02, SubGrupo 66 (Postes y Tejido Romboidal)
INSERT INTO products (code, name, unit, category) VALUES
('POSTE40.0X4.2', 'Poste metálico 40,0 x 4,2 H150', 'unidad', 'poste'),
('TEJ/ROMB11/2', 'Ro.Tejido ROMBOIDAL 150-38-14', 'rollo', 'tejido'),
('TEJ/ROMB12-2', 'Ro.Tejido ROMBOIDAL 150-50-12 x 10 Mts', 'rollo', 'tejido'),
('TEJ/ROMB18-12', 'Ro.Tejido ROMBOIDAL 180-50-12 x 10 Mts', 'rollo', 'tejido'),
('TEJ/ROMB180X2', 'Ro.Tejido ROMBOIDAL 180-50-14', 'rollo', 'tejido'),
('TEJ/ROMB180X2X', 'Ro.Tejido ROMBOIDAL 180-63-14', 'rollo', 'tejido'),
('TEJ/ROMB2', 'Ro.Tejido ROMBOIDAL 150-50-14', 'rollo', 'tejido'),
('TEJ/ROMB2X1M', 'Ro.Tejido ROMBOIDAL 100-50-14', 'rollo', 'tejido'),
('TEJ/ROMB21/2', 'Ro.Tejido ROMBOIDAL 150-63-14', 'rollo', 'tejido'),
('TEJ/ROMB3', 'Ro.Tejido ROMBOIDAL 150-76-14', 'rollo', 'tejido');

-- Insertar productos del Grupo 02, SubGrupo 690 (Mallas)
INSERT INTO products (code, name, unit, category) VALUES
('MALLAQ109', 'Malla Job Shop G Q109-2,6-50x50 1,2x3 M', 'unidad', 'malla'),
('MALLAQ109N', 'Malla Job Shop N Q109-2,6-50x50 1,2x3 M', 'unidad', 'malla'),
('MALLAQ216', 'Malla Job Shop G Q216-2,6-25x25 1,2x3 M', 'unidad', 'malla'),
('MALLAQ216N', 'Malla Job Shop N Q216-2,6-25x25 1,2x3 M', 'unidad', 'malla'),
('MALLASIMAQ196', 'Malla SIMA Q196 100X100X5 MM 6 M X 2,4 M', 'unidad', 'malla');

-- Crear inventario inicial para cada producto
-- Stock negativo se ajusta a 0 según indicación del usuario
-- stock_disponible es calculado automáticamente (stock_total - stock_reservado)

-- SubGrupo 60 (Alambres)
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 7, 0, 0 FROM products WHERE code = 'AJR17/15';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 132, 0, 0 FROM products WHERE code = 'PUA';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 8, 0, 0 FROM products WHERE code = 'PUABAGUAL';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'PUABULLDOG';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 1, 0, 0 FROM products WHERE code = 'PUASUPERBAG';

-- SubGrupo 62 (Alambre Galvanizado)
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'ALAMG14';

-- SubGrupo 65 (Tejido Cuadrangular)
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 9, 0, 0 FROM products WHERE code = 'TEJ/CUAD';

-- SubGrupo 66 (Postes y Tejido Romboidal)
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 106, 0, 0 FROM products WHERE code = 'POSTE40.0X4.2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'TEJ/ROMB11/2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'TEJ/ROMB12-2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 1, 0, 0 FROM products WHERE code = 'TEJ/ROMB18-12';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'TEJ/ROMB180X2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'TEJ/ROMB180X2X';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 46, 0, 0 FROM products WHERE code = 'TEJ/ROMB2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 14, 0, 0 FROM products WHERE code = 'TEJ/ROMB2X1M';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 9, 0, 0 FROM products WHERE code = 'TEJ/ROMB21/2';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'TEJ/ROMB3';

-- SubGrupo 690 (Mallas)
INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'MALLAQ109';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 26, 0, 0 FROM products WHERE code = 'MALLAQ109N';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'MALLAQ216';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 30, 0, 0 FROM products WHERE code = 'MALLAQ216N';

INSERT INTO inventory (product_id, stock_total, stock_reservado, stock_generado)
SELECT id, 0, 0, 0 FROM products WHERE code = 'MALLASIMAQ196';
