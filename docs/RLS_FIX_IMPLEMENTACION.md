# Implementación del Fix RLS

## ✅ Cambios Realizados

### 1. Creado archivo de Server Actions
**Archivo**: `app/actions/client-queries.ts`

Este archivo contiene server actions que usan `createAdminClient()` para bypassear RLS:
- `getOrderById()` - Obtener pedido completo
- `getOrdersForPlanta()` - Lista de pedidos para planta
- `getOrderActivityLog()` - Log de actividades
- `getAvailableStockForProduct()` - Stock disponible
- `getStockSuggestions()` - Sugerencias de stock
- `checkStockAvailability()` - Verificar disponibilidad
- `getCutOrderById()` - Obtener orden de corte
- `getAllClients()` - Lista de clientes
- `getClientById()` - Cliente por ID
- `getAllProducts()` - Lista de productos
- `getProductById()` - Producto por ID

### 2. Actualizados Componentes Cliente

#### ✅ `app/planta/pedidos/[id]/page.tsx`
- Reemplazado `createClient()` con `getOrderById()` en `loadPedido()`

#### ✅ `app/planta/pedidos/page.tsx`
- Reemplazado `createClient()` con `getOrdersForPlanta()` en `loadPedidos()`

#### ✅ `app/admin/pedidos/[id]/order-detail-client.tsx`
- Reemplazado `createClient()` con `getOrderActivityLog()` en `loadActivityLog()`

### 3. Pendientes de Actualizar

Estos archivos aún tienen queries directas que necesitan ser reemplazadas:

#### ⚠️ `app/planta/pedidos/[id]/page.tsx`
Líneas que necesitan actualización:

1. **Línea ~205**: `loadAvailableStock()` en sugerencias
```typescript
const supabase = createClient()
const { data: cutOrder } = await supabase.from('cut_orders')...
```
**Solución**: Usar `getCutOrderById()` y `getStockSuggestions()`

2. **Línea ~323**: Verificación de stock
```typescript
const supabase = createClient()
const { data: stockCheck } = await supabase.from('inventory')...
```
**Solución**: Usar `checkStockAvailability()`

3. **Línea ~413**: Código viejo (ya no se ejecuta, pero debería eliminarse)

4. **Línea ~1185**: Asignación de stock
```typescript
const supabase = createClient()
```
**Solución**: Ya usa server action `assignStockToCutOrder`, solo eliminar la línea del createClient

#### ⚠️ `app/admin/pedidos/[id]/order-detail-client.tsx`

1. **Línea ~665**: `loadAvailableStock()`
```typescript
const supabase = createClient()
```
**Solución**: Usar `getAvailableStockForProduct()`

2. **Línea ~762**: Cambio de stock
```typescript
const supabase = createClient()
```
**Solución**: Mover lógica a server action

## 🚀 Próximos Pasos

### Paso 1: Ejecutar Migración de Limpieza
```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: supabase/migrations/00050_force_clean_rls_policies.sql
```

### Paso 2: Completar Actualizaciones de Componentes
Necesito actualizar las queries restantes en:
- `app/planta/pedidos/[id]/page.tsx` (3-4 lugares)
- `app/admin/pedidos/[id]/order-detail-client.tsx` (2 lugares)

### Paso 3: Reiniciar Servidor
```bash
npm run dev
```

### Paso 4: Probar Funcionalidad
- [ ] Login en /admin
- [ ] Ver lista de pedidos
- [ ] Ver detalle de pedido
- [ ] Crear pedido de prueba
- [ ] Aprobar pedido
- [ ] Ver en tablet /planta
- [ ] Asignar stock
- [ ] Marcar como cortado

## 📋 Checklist de Verificación

### Queries Actualizadas
- [x] `loadPedido()` en planta/pedidos/[id]
- [x] `loadPedidos()` en planta/pedidos
- [x] `loadActivityLog()` en admin/pedidos/[id]
- [ ] `loadAvailableStock()` en planta/pedidos/[id]
- [ ] Verificación de stock en planta/pedidos/[id]
- [ ] `loadAvailableStock()` en admin/pedidos/[id]
- [ ] Cambio de stock en admin/pedidos/[id]

### Migraciones Aplicadas
- [x] `00048_enable_rls_security_fix.sql`
- [x] `00049_fix_users_rls_recursion.sql`
- [ ] `00050_force_clean_rls_policies.sql` ⚠️ PENDIENTE

## ⚠️ Importante

**NO deshabilitar RLS**. La solución es:
1. Usar `createAdminClient()` en server actions
2. Llamar server actions desde componentes cliente
3. Nunca usar `createClient()` directamente en componentes cliente

## 🔍 Debugging

Si sigues viendo errores de recursión:
1. Verifica que ejecutaste la migración 00050
2. Reinicia el servidor Next.js
3. Limpia caché del navegador
4. Verifica que no hay queries directas con `createClient()`

```bash
# Buscar queries directas restantes
grep -r "createClient()" app/ --include="*.tsx" --include="*.ts"
```
