# 🔧 Migraciones Pendientes - Aplicar en Supabase Dashboard

## ⚠️ IMPORTANTE
Aplica estas migraciones en **Supabase Dashboard → SQL Editor** en el orden indicado.

---

## 📋 Migración 1: Tabla delivery_history
**Archivo:** `supabase/migrations/00036_create_delivery_history_table.sql`

```sql
-- Crear tabla delivery_history
CREATE TABLE IF NOT EXISTS delivery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_by UUID REFERENCES auth.users(id),
  previous_status VARCHAR(50) NOT NULL,
  stock_consumed JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_delivery_history_order_id ON delivery_history(order_id);
CREATE INDEX idx_delivery_history_delivered_at ON delivery_history(delivered_at);
CREATE INDEX idx_delivery_history_is_active ON delivery_history(is_active);
```

---

## 📋 Migración 2: Función restore_reserved_stock
**Archivo:** `supabase/migrations/00037_create_restore_stock_function.sql`

```sql
-- Crear función restore_reserved_stock
CREATE OR REPLACE FUNCTION restore_reserved_stock(p_inventory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET
    stock_total = stock_total + 1,
    stock_reservado = stock_reservado + 1
  WHERE id = p_inventory_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 Migración 3: Fix políticas RLS de cut_orders
**Archivo:** `supabase/migrations/00038_fix_cut_orders_insert_policy.sql`

```sql
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admin full access" ON cut_orders;
DROP POLICY IF EXISTS "Manager operational access" ON cut_orders;

-- Recrear políticas con WITH CHECK para INSERT
CREATE POLICY "Admin full access to cut_orders" ON cut_orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Manager full access to cut_orders" ON cut_orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')));
```

---

## ✅ Verificación

Después de aplicar las migraciones, verifica que todo funcione:

1. **Aprobar un pedido** → Debe crear órdenes de corte sin errores
2. **Completar cortes en tablet** → La página debe actualizarse automáticamente
3. **Marcar como entregado** → Debe guardar en delivery_history
4. **Deshacer entrega** → Debe restaurar el stock correctamente

---

## 🔍 Endpoint de verificación

Visita: `http://localhost:3000/api/apply-delivery-migrations`

Te dirá si las migraciones están aplicadas o no.
