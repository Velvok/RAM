-- =====================================================
-- FORCE CLEAN: Eliminar TODAS las políticas problemáticas
-- =====================================================
-- Fecha: 2026-04-22
-- Descripción: Limpieza forzada de todas las políticas
--              que puedan estar causando recursión.
-- =====================================================

-- =====================================================
-- DIAGNÓSTICO: Ver políticas actuales
-- =====================================================

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLÍTICAS ACTUALES EN USERS';
  RAISE NOTICE '========================================';
  
  FOR v_policy IN 
    SELECT policyname, cmd 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    RAISE NOTICE 'Política: % (Comando: %)', v_policy.policyname, v_policy.cmd;
  END LOOP;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- LIMPIEZA FORZADA: Eliminar TODAS las políticas
-- =====================================================

-- USERS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- CLIENTS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON clients', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- PRODUCTS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'products'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON products', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- INVENTORY: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON inventory', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- ORDERS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON orders', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- ORDER_LINES: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'order_lines'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON order_lines', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- CUT_ORDERS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'cut_orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cut_orders', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- CUT_LINES: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'cut_lines'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cut_lines', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- STOCK_MOVEMENTS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'stock_movements'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON stock_movements', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- STOCK_RESERVATIONS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'stock_reservations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON stock_reservations', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- REMNANTS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'remnants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON remnants', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- ANNUAL_HISTORY: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'annual_history'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON annual_history', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- PRODUCT_WEIGHT_CONVERSIONS: Eliminar TODAS las políticas existentes
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'product_weight_conversions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON product_weight_conversions', v_policy.policyname);
    RAISE NOTICE 'Eliminada política: %', v_policy.policyname;
  END LOOP;
END $$;

-- =====================================================
-- RECREAR POLÍTICAS SIMPLES SIN RECURSIÓN
-- =====================================================

-- USERS
CREATE POLICY "auth_users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_users_insert" ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_users_update" ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_users_delete" ON users FOR DELETE TO authenticated USING (true);

-- CLIENTS
CREATE POLICY "auth_clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_clients_update" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_clients_delete" ON clients FOR DELETE TO authenticated USING (true);

-- PRODUCTS
CREATE POLICY "auth_products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_products_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_products_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_products_delete" ON products FOR DELETE TO authenticated USING (true);

-- INVENTORY
CREATE POLICY "auth_inventory_select" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_inventory_insert" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_inventory_update" ON inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_inventory_delete" ON inventory FOR DELETE TO authenticated USING (true);

-- ORDERS
CREATE POLICY "auth_orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_orders_update" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_orders_delete" ON orders FOR DELETE TO authenticated USING (true);

-- ORDER_LINES
CREATE POLICY "auth_order_lines_select" ON order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_order_lines_insert" ON order_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_order_lines_update" ON order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_order_lines_delete" ON order_lines FOR DELETE TO authenticated USING (true);

-- CUT_ORDERS
CREATE POLICY "auth_cut_orders_select" ON cut_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_cut_orders_insert" ON cut_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_cut_orders_update" ON cut_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_cut_orders_delete" ON cut_orders FOR DELETE TO authenticated USING (true);

-- CUT_LINES
CREATE POLICY "auth_cut_lines_select" ON cut_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_cut_lines_insert" ON cut_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_cut_lines_update" ON cut_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_cut_lines_delete" ON cut_lines FOR DELETE TO authenticated USING (true);

-- STOCK_MOVEMENTS
CREATE POLICY "auth_stock_movements_select" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_stock_movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_stock_movements_update" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_stock_movements_delete" ON stock_movements FOR DELETE TO authenticated USING (true);

-- STOCK_RESERVATIONS
CREATE POLICY "auth_stock_reservations_select" ON stock_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_stock_reservations_insert" ON stock_reservations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_stock_reservations_update" ON stock_reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_stock_reservations_delete" ON stock_reservations FOR DELETE TO authenticated USING (true);

-- REMNANTS
CREATE POLICY "auth_remnants_select" ON remnants FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_remnants_insert" ON remnants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_remnants_update" ON remnants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_remnants_delete" ON remnants FOR DELETE TO authenticated USING (true);

-- ANNUAL_HISTORY
CREATE POLICY "auth_annual_history_select" ON annual_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_annual_history_insert" ON annual_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_annual_history_update" ON annual_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_annual_history_delete" ON annual_history FOR DELETE TO authenticated USING (true);

-- PRODUCT_WEIGHT_CONVERSIONS
CREATE POLICY "auth_product_weight_conversions_select" ON product_weight_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_product_weight_conversions_insert" ON product_weight_conversions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_product_weight_conversions_update" ON product_weight_conversions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_product_weight_conversions_delete" ON product_weight_conversions FOR DELETE TO authenticated USING (true);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_table RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LIMPIEZA Y RECREACIÓN COMPLETADA';
  RAISE NOTICE '========================================';
  
  FOR v_table IN 
    SELECT tablename, COUNT(*) as num_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'clients', 'products', 'inventory', 'orders', 
                        'order_lines', 'cut_orders', 'cut_lines', 'stock_movements',
                        'stock_reservations', 'remnants', 'annual_history', 
                        'product_weight_conversions')
    GROUP BY tablename
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Tabla: % - Políticas: %', v_table.tablename, v_table.num_policies;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Todas las políticas recreadas sin recursión';
  RAISE NOTICE '✓ Reinicia el servidor Next.js ahora';
  RAISE NOTICE '========================================';
END $$;
