# Security Fix: Habilitación de RLS

**Fecha**: 2026-04-22  
**Migración**: `00048_enable_rls_security_fix.sql`  
**Prioridad**: 🔴 CRÍTICA

## Problemas Solucionados

### 1. ✅ 15 Tablas con RLS Habilitado
Se habilitó RLS en todas las tablas que tenían políticas definidas pero RLS deshabilitado:

- `annual_history`
- `clients` (⚠️ contiene datos sensibles: tax_id)
- `cut_lines`
- `cut_orders`
- `inventory`
- `order_lines`
- `orders`
- `preparation_items`
- `product_weight_conversions`
- `products`
- `remnants`
- `stock_movements`
- `stock_reservations`
- `users`
- `order_activity_log`

### 2. ✅ Vista v_stock_real_time Corregida
- **Antes**: Usaba `SECURITY DEFINER` (riesgo de seguridad)
- **Ahora**: Usa `security_invoker=true` (más seguro)
- **Impacto**: La vista ahora respeta los permisos del usuario que la ejecuta

### 3. ✅ Verificación Automática
La migración incluye:
- Contador de tablas con RLS habilitado
- Lista de tablas sin RLS (si las hay)
- Verificación de la vista recreada
- Resumen de políticas por tabla

## Cómo Ejecutar

### Opción 1: Supabase SQL Editor (Recomendado)
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia y pega el contenido de `supabase/migrations/00048_enable_rls_security_fix.sql`
4. Ejecuta
5. Revisa los mensajes de NOTICE para confirmar

### Opción 2: CLI de Supabase
```bash
supabase db push
```

## Verificación Post-Migración

### 1. Verificar RLS Habilitado
```sql
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Resultado esperado**: Todas las tablas con `rls_enabled = true`

### 2. Verificar Políticas Activas
```sql
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Resultado esperado**: Todas las tablas principales tienen políticas para `authenticated`

### 3. Verificar Vista
```sql
SELECT 
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_stock_real_time';
```

**Resultado esperado**: Vista existe y NO contiene `SECURITY DEFINER`

## Impacto en la Aplicación

### ✅ Sin Cambios en el Código
- Las políticas RLS existentes siguen funcionando igual
- No se requieren cambios en el código de la aplicación
- Los server actions con `createAdminClient()` siguen funcionando

### ⚠️ Posibles Efectos
1. **Queries desde el cliente**: Ahora respetan RLS correctamente
2. **Vista v_stock_real_time**: Respeta permisos del usuario (más seguro)
3. **Rendimiento**: Puede haber un ligero impacto (mínimo)

## Rollback (Si es Necesario)

Si algo falla, ejecutar:

```sql
-- SOLO EN CASO DE EMERGENCIA
ALTER TABLE annual_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE cut_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE cut_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_weight_conversions DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE remnants DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_activity_log DISABLE ROW LEVEL SECURITY;
```

## Checklist de Ejecución

- [ ] Hacer backup de la base de datos
- [ ] Ejecutar migración en Supabase
- [ ] Verificar mensajes de NOTICE
- [ ] Confirmar que todas las tablas tienen RLS habilitado
- [ ] Probar funcionalidad básica de la app (crear pedido, aprobar, etc.)
- [ ] Verificar que admin y tablet siguen funcionando
- [ ] Confirmar que no hay errores de permisos en logs

## Notas Importantes

1. **Las políticas YA EXISTEN**: Esta migración solo habilita RLS, no crea políticas nuevas
2. **Admin client sigue funcionando**: Los server actions con `createAdminClient()` bypass RLS automáticamente
3. **Seguridad mejorada**: Ahora todas las tablas están protegidas por RLS
4. **Vista más segura**: `v_stock_real_time` ya no usa SECURITY DEFINER

## Soporte

Si encuentras algún problema después de ejecutar la migración:
1. Revisa los logs de Supabase
2. Verifica que las políticas RLS están correctas
3. Confirma que `createAdminClient()` se usa en server actions
4. Si es necesario, ejecuta el rollback temporal

---

**Estado**: ✅ Lista para ejecutar  
**Riesgo**: Bajo (solo habilita RLS, no modifica políticas)  
**Tiempo estimado**: < 1 minuto
