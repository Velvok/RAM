# 🔧 EJECUTAR MIGRACIONES EN SUPABASE

## ⚠️ IMPORTANTE: Ejecuta estas migraciones EN ORDEN

### 1️⃣ Migración de Estados (OBLIGATORIA)
**Archivo:** `supabase/migrations/00003_update_order_states.sql`

**Qué hace:**
- Actualiza los estados de pedidos a: nuevo, aprobado, en_corte, finalizado, cancelado
- Migra datos existentes al nuevo esquema
- Agrega campos `approved_at` y `approved_by`

**Cómo ejecutar:**
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy)
2. Click en "SQL Editor" en el menú lateral
3. Click en "New Query"
4. Copia y pega TODO el contenido del archivo `00003_update_order_states.sql`
5. Click en "Run" o presiona Ctrl+Enter
6. Verifica que diga "Success. No rows returned"

---

### 2️⃣ Limpieza de Datos (OPCIONAL)
**Archivo:** `supabase/migrations/00004_clean_orders.sql`

**Qué hace:**
- Elimina TODOS los pedidos y datos relacionados
- Útil para empezar con base de datos limpia

**⚠️ CUIDADO: Esto eliminará TODOS los pedidos existentes**

**Cómo ejecutar:**
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy)
2. Click en "SQL Editor"
3. Click en "New Query"
4. Copia y pega TODO el contenido del archivo `00004_clean_orders.sql`
5. Click en "Run"
6. Verifica que se ejecute sin errores

---

## ✅ Verificación

Después de ejecutar las migraciones, verifica:

### Verificar Estados:
```sql
-- Ejecuta esto en SQL Editor
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'orders_status_check';
```

Debe mostrar:
```
status IN ('nuevo', 'aprobado', 'en_corte', 'finalizado', 'cancelado')
```

### Verificar Campos Nuevos:
```sql
-- Ejecuta esto en SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('approved_at', 'approved_by');
```

Debe mostrar 2 filas con los campos `approved_at` y `approved_by`.

---

## 🐛 Solución de Problemas

### Error: "nuevo is not valid for enum order_status"
**Causa:** No has ejecutado la migración 00003
**Solución:** Ejecuta `00003_update_order_states.sql` primero

### Error: "violates foreign key constraint remnants_cut_order_id_fkey"
**Causa:** Intentaste ejecutar 00004 con el orden incorrecto
**Solución:** El archivo ya está corregido, ejecútalo de nuevo

### Error: "constraint already exists"
**Causa:** Ya ejecutaste la migración antes
**Solución:** No pasa nada, la migración ya está aplicada

---

## 📋 Orden Correcto de Ejecución

1. **PRIMERO:** `00003_update_order_states.sql` (OBLIGATORIO)
2. **DESPUÉS:** `00004_clean_orders.sql` (OPCIONAL - solo si quieres limpiar datos)

---

## 🔗 Enlaces Útiles

- [Supabase Dashboard](https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy)
- [SQL Editor](https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy/sql)
- [Table Editor](https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy/editor)
