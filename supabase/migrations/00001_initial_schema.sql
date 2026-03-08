-- =====================================================
-- SISTEMA RAM - GESTIÓN DE CORTE Y STOCK
-- Schema inicial completo con RLS
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator');

CREATE TYPE order_status AS ENUM (
  'ingresado',
  'generado',
  'pendiente_aprobacion',
  'lanzado',
  'en_corte',
  'preparado_pendiente_retiro',
  'despachado',
  'entregado',
  'bloqueado',
  'cancelado'
);

CREATE TYPE cut_order_status AS ENUM (
  'generada',
  'lanzada',
  'en_proceso',
  'pausada',
  'finalizada',
  'observada',
  'cancelada'
);

CREATE TYPE remnant_status AS ENUM (
  'disponible',
  'reservado',
  'consumido',
  'descartado'
);

CREATE TYPE acopio_status AS ENUM (
  'abierto',
  'parcial',
  'consumido',
  'vencido'
);

CREATE TYPE movement_type AS ENUM (
  'ingreso',
  'egreso',
  'reserva',
  'liberacion',
  'ajuste',
  'corte',
  'recorte_generado',
  'scrap'
);

CREATE TYPE incident_severity AS ENUM ('baja', 'media', 'alta', 'critica');

-- =====================================================
-- TABLA: users
-- Usuarios del sistema con roles y PIN para operarios
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  pin_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =====================================================
-- TABLA: clients
-- Clientes de la empresa
-- =====================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evo_client_id TEXT UNIQUE,
  business_name TEXT NOT NULL,
  tax_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_evo_id ON clients(evo_client_id);
CREATE INDEX idx_clients_is_active ON clients(is_active);

-- =====================================================
-- TABLA: products
-- Catálogo de productos (chapas, perfiles, etc)
-- =====================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evo_product_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'kg',
  thickness_mm DECIMAL(10,2),
  width_mm DECIMAL(10,2),
  length_mm DECIMAL(10,2),
  weight_per_unit DECIMAL(10,3),
  min_remnant_threshold DECIMAL(10,2) DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_evo_id ON products(evo_product_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);

-- =====================================================
-- TABLA: inventory
-- Inventario principal sincronizado con ERP Evo
-- =====================================================

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_total DECIMAL(10,2) DEFAULT 0,
  stock_reservado DECIMAL(10,2) DEFAULT 0,
  stock_en_proceso DECIMAL(10,2) DEFAULT 0,
  stock_disponible DECIMAL(10,2) GENERATED ALWAYS AS (stock_total - stock_reservado - stock_en_proceso) STORED,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_disponible ON inventory(stock_disponible);

-- =====================================================
-- TABLA: orders
-- Pedidos recibidos desde ERP Evo
-- =====================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evo_order_id TEXT UNIQUE,
  order_number TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  status order_status DEFAULT 'ingresado',
  total_weight DECIMAL(10,2),
  total_amount DECIMAL(12,2),
  payment_verified BOOLEAN DEFAULT false,
  notes TEXT,
  evo_data JSONB,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_evo_id ON orders(evo_order_id);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- =====================================================
-- TABLA: order_lines
-- Líneas de pedido (detalle de productos solicitados)
-- =====================================================

CREATE TABLE order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2),
  subtotal DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_lines_order ON order_lines(order_id);
CREATE INDEX idx_order_lines_product ON order_lines(product_id);

-- =====================================================
-- TABLA: cut_orders
-- Órdenes de corte generadas desde pedidos
-- =====================================================

CREATE TABLE cut_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_line_id UUID REFERENCES order_lines(id),
  cut_number TEXT NOT NULL UNIQUE,
  status cut_order_status DEFAULT 'generada',
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_requested DECIMAL(10,2) NOT NULL,
  quantity_cut DECIMAL(10,2) DEFAULT 0,
  material_base_id UUID REFERENCES products(id),
  material_base_quantity DECIMAL(10,2),
  assigned_to UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cut_orders_order ON cut_orders(order_id);
CREATE INDEX idx_cut_orders_status ON cut_orders(status);
CREATE INDEX idx_cut_orders_assigned ON cut_orders(assigned_to);
CREATE INDEX idx_cut_orders_created_at ON cut_orders(created_at DESC);

-- =====================================================
-- TABLA: cut_lines
-- Detalle de cortes realizados
-- =====================================================

CREATE TABLE cut_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cut_order_id UUID NOT NULL REFERENCES cut_orders(id) ON DELETE CASCADE,
  material_used_id UUID NOT NULL REFERENCES products(id),
  quantity_used DECIMAL(10,2) NOT NULL,
  quantity_produced DECIMAL(10,2) NOT NULL,
  remnant_generated DECIMAL(10,2) DEFAULT 0,
  is_scrap BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cut_lines_cut_order ON cut_lines(cut_order_id);
CREATE INDEX idx_cut_lines_material ON cut_lines(material_used_id);

-- =====================================================
-- TABLA: remnants
-- Recortes reutilizables generados en cortes
-- =====================================================

CREATE TABLE remnants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  cut_order_id UUID REFERENCES cut_orders(id),
  status remnant_status DEFAULT 'disponible',
  quantity DECIMAL(10,2) NOT NULL,
  dimensions TEXT,
  location TEXT,
  reuse_score INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_remnants_product ON remnants(product_id);
CREATE INDEX idx_remnants_status ON remnants(status);
CREATE INDEX idx_remnants_score ON remnants(reuse_score DESC);

-- =====================================================
-- TABLA: stock_reservations
-- Reservas de stock para pedidos
-- =====================================================

CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  cut_order_id UUID REFERENCES cut_orders(id),
  quantity_reserved DECIMAL(10,2) NOT NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_product ON stock_reservations(product_id);
CREATE INDEX idx_reservations_order ON stock_reservations(order_id);
CREATE INDEX idx_reservations_active ON stock_reservations(is_active);

-- =====================================================
-- TABLA: stock_movements
-- Trazabilidad completa de movimientos de stock
-- =====================================================

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type movement_type NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  stock_before DECIMAL(10,2),
  stock_after DECIMAL(10,2),
  reference_id UUID,
  reference_type TEXT,
  user_id UUID REFERENCES users(id),
  device_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX idx_movements_reference ON stock_movements(reference_id, reference_type);

-- =====================================================
-- TABLA: acopios
-- Acopios de material (reservas de precio)
-- =====================================================

CREATE TABLE acopios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  product_id UUID NOT NULL REFERENCES products(id),
  status acopio_status DEFAULT 'abierto',
  quantity_total DECIMAL(10,2) NOT NULL,
  quantity_consumed DECIMAL(10,2) DEFAULT 0,
  quantity_remaining DECIMAL(10,2) GENERATED ALWAYS AS (quantity_total - quantity_consumed) STORED,
  unit_price DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(12,2) NOT NULL,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acopios_client ON acopios(client_id);
CREATE INDEX idx_acopios_product ON acopios(product_id);
CREATE INDEX idx_acopios_status ON acopios(status);
CREATE INDEX idx_acopios_valid_until ON acopios(valid_until);

-- =====================================================
-- TABLA: dispatches
-- Despachos y remitos
-- =====================================================

CREATE TABLE dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  evo_dispatch_id TEXT,
  dispatch_number TEXT NOT NULL,
  dispatch_date DATE NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dispatches_order ON dispatches(order_id);
CREATE INDEX idx_dispatches_evo_id ON dispatches(evo_dispatch_id);
CREATE INDEX idx_dispatches_date ON dispatches(dispatch_date DESC);

-- =====================================================
-- TABLA: weighings
-- Registro de pesadas
-- =====================================================

CREATE TABLE weighings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  cut_order_id UUID REFERENCES cut_orders(id),
  client_id UUID REFERENCES clients(id),
  theoretical_weight DECIMAL(10,2),
  actual_weight DECIMAL(10,2) NOT NULL,
  difference DECIMAL(10,2) GENERATED ALWAYS AS (actual_weight - COALESCE(theoretical_weight, 0)) STORED,
  ticket_number TEXT,
  notes TEXT,
  weighed_by UUID REFERENCES users(id),
  weighed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weighings_order ON weighings(order_id);
CREATE INDEX idx_weighings_cut_order ON weighings(cut_order_id);
CREATE INDEX idx_weighings_date ON weighings(weighed_at DESC);

-- =====================================================
-- TABLA: incidents
-- Incidencias operativas
-- =====================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cut_order_id UUID REFERENCES cut_orders(id),
  order_id UUID REFERENCES orders(id),
  severity incident_severity DEFAULT 'media',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  reported_by UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incidents_cut_order ON incidents(cut_order_id);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);

-- =====================================================
-- TABLA: devices
-- Dispositivos registrados (tablets, etc)
-- =====================================================

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name TEXT NOT NULL,
  device_type TEXT,
  user_agent TEXT,
  last_ip TEXT,
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_active ON devices(is_active);
CREATE INDEX idx_devices_last_sync ON devices(last_sync_at DESC);

-- =====================================================
-- TABLA: sync_logs
-- Logs de sincronización offline
-- =====================================================

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id),
  sync_type TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  sync_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_device ON sync_logs(device_id);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at DESC);

-- =====================================================
-- TABLA: audit_logs
-- Auditoría completa de cambios
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  device_id UUID REFERENCES devices(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cut_orders_updated_at BEFORE UPDATE ON cut_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remnants_updated_at BEFORE UPDATE ON remnants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acopios_updated_at BEFORE UPDATE ON acopios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar stock_reservado en inventory
CREATE OR REPLACE FUNCTION update_inventory_reservado()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE inventory
    SET stock_reservado = (
      SELECT COALESCE(SUM(quantity_reserved), 0)
      FROM stock_reservations
      WHERE product_id = NEW.product_id AND is_active = true
    )
    WHERE product_id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE inventory
    SET stock_reservado = (
      SELECT COALESCE(SUM(quantity_reserved), 0)
      FROM stock_reservations
      WHERE product_id = OLD.product_id AND is_active = true
    )
    WHERE product_id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_reservado
AFTER INSERT OR UPDATE OR DELETE ON stock_reservations
FOR EACH ROW EXECUTE FUNCTION update_inventory_reservado();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE remnants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE acopios ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas: admin tiene acceso total
CREATE POLICY "Admin full access" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON clients FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON order_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON cut_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON cut_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON remnants FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON stock_reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON stock_movements FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON acopios FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON dispatches FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON weighings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON incidents FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON devices FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON sync_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin full access" ON audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Políticas para managers: acceso de lectura y escritura operativa
CREATE POLICY "Manager read access" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Manager read access" ON clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Manager read access" ON products FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Manager read access" ON inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Manager operational access" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Manager operational access" ON cut_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Políticas para operators: acceso limitado a sus órdenes asignadas
CREATE POLICY "Operator read own cut orders" ON cut_orders FOR SELECT USING (
  assigned_to = auth.uid() OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Operator update own cut orders" ON cut_orders FOR UPDATE USING (
  assigned_to = auth.uid() OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Operator create cut lines" ON cut_lines FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM cut_orders 
    WHERE id = cut_order_id AND assigned_to = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Usuario admin por defecto
INSERT INTO users (email, full_name, role, is_active) VALUES
  ('admin@velvok.com', 'Administrador Sistema', 'admin', true);

COMMENT ON TABLE users IS 'Usuarios del sistema con roles y autenticación';
COMMENT ON TABLE clients IS 'Clientes de la empresa';
COMMENT ON TABLE products IS 'Catálogo de productos (chapas, perfiles, etc)';
COMMENT ON TABLE inventory IS 'Inventario principal con stock disponible calculado';
COMMENT ON TABLE orders IS 'Pedidos recibidos desde ERP Evo';
COMMENT ON TABLE cut_orders IS 'Órdenes de corte generadas desde pedidos';
COMMENT ON TABLE remnants IS 'Recortes reutilizables generados en cortes';
COMMENT ON TABLE stock_reservations IS 'Reservas de stock para pedidos';
COMMENT ON TABLE stock_movements IS 'Trazabilidad completa de movimientos';
COMMENT ON TABLE acopios IS 'Acopios de material (reservas de precio)';
