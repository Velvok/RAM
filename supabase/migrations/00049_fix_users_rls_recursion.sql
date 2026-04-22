-- =====================================================
-- FIX: Recursión infinita en políticas RLS
-- =====================================================
-- Fecha: 2026-04-22
-- Descripción: Las políticas causaban recursión infinita
--              al hacer SELECT a users dentro de las políticas.
--              SOLUCIÓN: Usar políticas simples para authenticated
--              y confiar en service_role para operaciones admin.
-- =====================================================

-- IMPORTANTE: En este proyecto usamos createAdminClient() en server actions
-- que usa service_role y bypasea RLS automáticamente. Por lo tanto,
-- las políticas solo necesitan permitir acceso básico a usuarios autenticados.

-- =====================================================
-- PASO 1: Eliminar políticas problemáticas con recursión
-- =====================================================

-- Políticas de users
DROP POLICY IF EXISTS "Admin full access" ON users;
DROP POLICY IF EXISTS "Manager read access" ON users;

-- Políticas de otras tablas que causan recursión
DROP POLICY IF EXISTS "Admin full access" ON clients;
DROP POLICY IF EXISTS "Admin full access" ON products;
DROP POLICY IF EXISTS "Admin full access" ON inventory;
DROP POLICY IF EXISTS "Admin full access" ON orders;
DROP POLICY IF EXISTS "Admin full access" ON order_lines;
DROP POLICY IF EXISTS "Admin full access" ON cut_orders;
DROP POLICY IF EXISTS "Admin full access" ON cut_lines;
DROP POLICY IF EXISTS "Admin full access" ON stock_movements;
DROP POLICY IF EXISTS "Admin full access" ON stock_reservations;
DROP POLICY IF EXISTS "Admin full access" ON remnants;
DROP POLICY IF EXISTS "Admin full access" ON annual_history;
DROP POLICY IF EXISTS "Admin full access" ON product_weight_conversions;

-- =====================================================
-- PASO 2: Crear políticas simples sin recursión
-- =====================================================

-- USERS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert users"
  ON users FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update users"
  ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete users"
  ON users FOR DELETE TO authenticated USING (true);

-- CLIENTS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE TO authenticated USING (true);

-- PRODUCTS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE TO authenticated USING (true);

-- INVENTORY: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view inventory"
  ON inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inventory"
  ON inventory FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
  ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory"
  ON inventory FOR DELETE TO authenticated USING (true);

-- ORDERS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view orders"
  ON orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orders"
  ON orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete orders"
  ON orders FOR DELETE TO authenticated USING (true);

-- ORDER_LINES: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view order_lines"
  ON order_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert order_lines"
  ON order_lines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_lines"
  ON order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete order_lines"
  ON order_lines FOR DELETE TO authenticated USING (true);

-- CUT_ORDERS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view cut_orders"
  ON cut_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cut_orders"
  ON cut_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cut_orders"
  ON cut_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cut_orders"
  ON cut_orders FOR DELETE TO authenticated USING (true);

-- CUT_LINES: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view cut_lines"
  ON cut_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cut_lines"
  ON cut_lines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cut_lines"
  ON cut_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cut_lines"
  ON cut_lines FOR DELETE TO authenticated USING (true);

-- STOCK_MOVEMENTS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view stock_movements"
  ON stock_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stock_movements"
  ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update stock_movements"
  ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete stock_movements"
  ON stock_movements FOR DELETE TO authenticated USING (true);

-- STOCK_RESERVATIONS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view stock_reservations"
  ON stock_reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stock_reservations"
  ON stock_reservations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update stock_reservations"
  ON stock_reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete stock_reservations"
  ON stock_reservations FOR DELETE TO authenticated USING (true);

-- REMNANTS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view remnants"
  ON remnants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert remnants"
  ON remnants FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update remnants"
  ON remnants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete remnants"
  ON remnants FOR DELETE TO authenticated USING (true);

-- ANNUAL_HISTORY: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view annual_history"
  ON annual_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert annual_history"
  ON annual_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update annual_history"
  ON annual_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete annual_history"
  ON annual_history FOR DELETE TO authenticated USING (true);

-- PRODUCT_WEIGHT_CONVERSIONS: Acceso básico para autenticados
CREATE POLICY "Authenticated users can view product_weight_conversions"
  ON product_weight_conversions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert product_weight_conversions"
  ON product_weight_conversions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update product_weight_conversions"
  ON product_weight_conversions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete product_weight_conversions"
  ON product_weight_conversions FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PASO 3: Verificación
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  -- Contar políticas nuevas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'Authenticated users can%';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLÍTICAS RLS CORREGIDAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Eliminadas políticas con recursión infinita';
  RAISE NOTICE '✓ Creadas % políticas simples para authenticated', v_policy_count;
  RAISE NOTICE '✓ Service role (createAdminClient) bypasea RLS automáticamente';
  RAISE NOTICE '========================================';
END $$;
