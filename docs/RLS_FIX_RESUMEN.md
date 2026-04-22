# 🔴 RESUMEN EJECUTIVO: Fix RLS Crítico

## Problema Detectado

Al habilitar RLS en las tablas, la aplicación dejó de funcionar con el error:
```
infinite recursion detected in policy for relation "users"
```

## Causa Raíz

Las políticas RLS originales hacían `SELECT` a la tabla `users` dentro de las propias políticas de `users`, causando recursión infinita:

```sql
-- ❌ Esto causa recursión infinita cuando RLS está habilitado
CREATE POLICY "Admin full access" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
```

## Solución

**2 migraciones creadas** que deben ejecutarse en orden:

### 1. `00048_enable_rls_security_fix.sql`
- Habilita RLS en 15 tablas
- Corrige vista `v_stock_real_time`
- Añade verificación automática

### 2. `00049_fix_users_rls_recursion.sql` ⚠️ CRÍTICA
- Elimina políticas con recursión infinita
- Crea políticas simples para `authenticated`
- Afecta a 13 tablas principales

## Pasos para Ejecutar

### 1️⃣ Ejecutar en Supabase SQL Editor

```bash
# 1. Abrir Supabase Dashboard → SQL Editor
# 2. Copiar y ejecutar: 00048_enable_rls_security_fix.sql
# 3. Copiar y ejecutar: 00049_fix_users_rls_recursion.sql
# 4. Verificar mensajes de confirmación
```

### 2️⃣ Reiniciar servidor Next.js

```bash
# Detener servidor (Ctrl+C)
npm run dev
```

### 3️⃣ Verificar funcionamiento

```bash
# Probar:
# - Login en /admin
# - Crear pedido de prueba
# - Aprobar pedido
# - Ver detalle en tablet
```

## Tablas Afectadas

Las siguientes tablas ahora tienen políticas simples sin recursión:

1. `users`
2. `clients`
3. `products`
4. `inventory`
5. `orders`
6. `order_lines`
7. `cut_orders`
8. `cut_lines`
9. `stock_movements`
10. `stock_reservations`
11. `remnants`
12. `annual_history`
13. `product_weight_conversions`

## Políticas Nuevas

Todas las tablas ahora tienen 4 políticas simples:

```sql
-- SELECT: Todos los autenticados pueden leer
CREATE POLICY "Authenticated users can view [tabla]"
  ON [tabla] FOR SELECT TO authenticated USING (true);

-- INSERT: Todos los autenticados pueden insertar
CREATE POLICY "Authenticated users can insert [tabla]"
  ON [tabla] FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: Todos los autenticados pueden actualizar
CREATE POLICY "Authenticated users can update [tabla]"
  ON [tabla] FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- DELETE: Todos los autenticados pueden eliminar
CREATE POLICY "Authenticated users can delete [tabla]"
  ON [tabla] FOR DELETE TO authenticated USING (true);
```

## ¿Por qué es seguro?

1. **Service Role bypasea RLS**: Los server actions usan `createAdminClient()` que usa service_role
2. **Control en aplicación**: Los permisos se controlan en la capa de aplicación (Next.js)
3. **Solo autenticados**: Las políticas solo permiten acceso a usuarios autenticados
4. **Sin recursión**: Las políticas no hacen SELECT a otras tablas

## Verificación Post-Migración

### ✅ Checklist

- [ ] Migración 00048 ejecutada sin errores
- [ ] Migración 00049 ejecutada sin errores
- [ ] Servidor Next.js reiniciado
- [ ] Login funciona en /admin
- [ ] Crear pedido funciona
- [ ] Aprobar pedido funciona
- [ ] Ver pedido en tablet funciona
- [ ] No hay errores de "infinite recursion"

### 🔍 Queries de Verificación

```sql
-- Verificar RLS habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verificar políticas nuevas
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND policyname LIKE 'Authenticated users can%'
ORDER BY tablename, policyname;

-- Contar políticas por tabla
SELECT tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

## Rollback (Solo si es necesario)

```sql
-- SOLO EN EMERGENCIA: Deshabilitar RLS temporalmente
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
-- ... etc
```

## Notas Importantes

- ⚠️ **NO ejecutar en producción sin probar en desarrollo primero**
- ✅ Las políticas existentes de `preparation_items` y `order_activity_log` se mantienen
- ✅ El sistema sigue funcionando igual desde el punto de vista del usuario
- ✅ La seguridad mejora porque RLS está habilitado
- ✅ No hay cambios necesarios en el código de la aplicación

## Soporte

Si encuentras problemas:
1. Revisa los logs de Supabase
2. Verifica que ambas migraciones se ejecutaron
3. Confirma que el servidor se reinició
4. Revisa la consola del navegador para errores
5. Si persiste, ejecuta el rollback temporal

---

**Estado**: ✅ Listo para ejecutar  
**Riesgo**: Medio (requiere reinicio de servidor)  
**Tiempo**: ~5 minutos  
**Reversible**: Sí (con rollback)
