# Dashboard con Datos Reales - Documentación

## 📋 Resumen de Cambios

El dashboard de `/admin` ha sido completamente refactorizado para funcionar con **datos reales de Supabase** en lugar de datos mockeados.

## 🏗️ Arquitectura Nueva

### **Antes (Datos Mockeados)**
```
/app/admin/page.tsx
  └── DashboardRAM (client component con datos hardcodeados)
```

### **Ahora (Datos Reales)**
```
/app/admin/page.tsx
  └── DashboardServer (server component)
      └── Consultas a Supabase
      └── DashboardRAMClient (client component)
          └── Interactividad (gráficos, búsqueda)
```

## 📁 Archivos Creados/Modificados

### ✅ Nuevos Archivos

1. **`/components/dashboard-server.tsx`** (Server Component)
   - Consulta datos reales de Supabase
   - Procesa KPIs, pedidos, stock y gráficos
   - Pasa datos al componente cliente

2. **`/components/dashboard-ram-client.tsx`** (Client Component)
   - Recibe datos del servidor
   - Maneja interactividad (búsqueda, filtros, gráficos)
   - Mantiene la UI existente

### 📝 Archivos Modificados

1. **`/app/admin/page.tsx`**
   - Ahora usa `DashboardServer` en lugar de `DashboardRAM`

2. **`/components/dashboard-ram.tsx`**
   - Mantiene estados reales de la DB (`nuevo`, `aprobado`, `en_corte`, etc.)
   - Función `getStatusBadge` actualizada con mapeo correcto
   - **Se puede eliminar si ya no se usa en otro lugar**

## 🔍 Datos que Consulta el Dashboard

### 1. **KPIs (Métricas Principales)**

```typescript
- Pedidos Pendientes: count(status IN ['nuevo', 'aprobado'])
- En Producción: count(status = 'en_corte')
- Pendientes Entrega: count(status = 'finalizado')
- Total Pedidos: count(*)
```

**Tablas consultadas:** `orders`

### 2. **Últimos Pedidos (Top 5)**

```sql
SELECT 
  order_number,
  status,
  created_at,
  client.business_name,
  lines.quantity,
  lines.product.code
FROM orders
ORDER BY created_at DESC
LIMIT 5
```

**Tablas consultadas:** `orders`, `clients`, `order_lines`, `products`

### 3. **Stock por Producto (Top 10)**

```sql
SELECT 
  stock_total,
  stock_reservado,
  stock_disponible,
  product.code,
  product.name
FROM inventory
ORDER BY stock_total DESC
LIMIT 10
```

**Tablas consultadas:** `inventory`, `products`

### 4. **Gráficos Mensuales (Últimos 6 meses)**

```sql
SELECT created_at, lines.quantity
FROM orders
WHERE created_at >= NOW() - INTERVAL '6 months'
ORDER BY created_at ASC
```

**Procesamiento:** Agrupa por mes y suma cantidades

### 5. **Gráficos Anuales (Últimos 6 años)**

```sql
SELECT created_at, lines.quantity
FROM orders
ORDER BY created_at ASC
```

**Procesamiento:** Agrupa por año y suma cantidades

## 🎨 Estados de Pedidos (Alineados con DB)

### Estados Reales del Sistema

| Estado DB | Label Display | Color Badge |
|-----------|---------------|-------------|
| `nuevo` | Nuevo | Gris (`slate`) |
| `aprobado` | Aprobado | Amarillo (`yellow`) |
| `en_corte` | En Corte | Azul (`blue`) |
| `finalizado` | Finalizado | Verde (`green`) |
| `entregado` | Entregado | Púrpura (`purple`) |
| `cancelado` | Cancelado | Rojo (`red`) |

**✅ Coinciden con los filtros de `/admin/pedidos`**

## 🔄 Funcionalidades Mantenidas

### ✅ Búsqueda Global
- Funciona igual que antes
- Filtra por cliente, pedido o producto
- Selector de ámbito: Todo / Pedidos / Stock

### ✅ Gráficos Interactivos
- Toggle entre Metros/Unidades
- Gráfico de barras (anual)
- Gráfico de líneas (mensual)

### ✅ Cotización Dólar
- Se mantiene la API externa
- Muestra compra/venta en tiempo real

### ✅ Stock Visual
- Barras de progreso con segmentos
- Rojo: Reservado
- Verde: Disponible

## 🚀 Cómo Funciona

### 1. **Server Component** (`dashboard-server.tsx`)

```typescript
export async function DashboardServer() {
  const supabase = await createClient()
  
  // Consultar datos reales
  const { data: orders } = await supabase.from('orders').select(...)
  const { data: stock } = await supabase.from('inventory').select(...)
  
  // Procesar y formatear
  const dashboardData = { kpis, recentOrders, stockProductos, ... }
  
  // Pasar al cliente
  return <DashboardRAMClient data={dashboardData} />
}
```

### 2. **Client Component** (`dashboard-ram-client.tsx`)

```typescript
export function DashboardRAMClient({ data }: Props) {
  // Recibe datos del servidor
  // Maneja estado local (búsqueda, filtros)
  // Renderiza UI interactiva
  
  return <div>...</div>
}
```

## 📊 Ejemplo de Flujo de Datos

```
Usuario visita /admin
  ↓
page.tsx renderiza <DashboardServer />
  ↓
DashboardServer consulta Supabase
  ↓
Procesa datos (KPIs, pedidos, stock, gráficos)
  ↓
Pasa datos a <DashboardRAMClient data={...} />
  ↓
Cliente renderiza UI con datos reales
  ↓
Usuario interactúa (búsqueda, filtros, gráficos)
```

## ⚠️ Consideraciones Importantes

### 1. **Performance**
- Las consultas están optimizadas con `select` específicos
- Se limitan resultados (Top 5 pedidos, Top 10 productos)
- Gráficos procesan datos en servidor (no en cliente)

### 2. **Caché**
- `export const dynamic = 'force-dynamic'` en page.tsx
- Datos siempre frescos en cada visita

### 3. **Fallbacks**
- Si no hay datos, muestra arrays vacíos
- Maneja errores de Supabase gracefully
- Labels por defecto: "Sin cliente", "N/A"

## 🔧 Mejoras Futuras Posibles

1. **Clientes por Producto en Stock**
   - Actualmente muestra `clientes: []`
   - Se puede agregar query adicional para obtener clientes que tienen reservas

2. **Filtros Avanzados en Gráficos**
   - Permitir seleccionar rango de fechas
   - Filtrar por cliente o producto específico

3. **Métricas Adicionales**
   - Tiempo promedio de producción
   - Tasa de cumplimiento
   - Productos más vendidos

4. **Real-time Updates**
   - Usar Supabase Realtime para actualizar dashboard automáticamente
   - Notificaciones de nuevos pedidos

## ✅ Checklist de Verificación

- [x] Estados de pedidos alineados con DB
- [x] Consultas a Supabase funcionando
- [x] KPIs calculados correctamente
- [x] Gráficos con datos reales
- [x] Stock con reservas reales
- [x] Búsqueda global funcional
- [x] UI mantenida sin cambios visuales
- [x] TypeScript sin errores
- [x] Server/Client components correctamente separados

## 🎯 Resultado Final

**El dashboard ahora muestra datos 100% reales de la base de datos**, manteniendo toda la funcionalidad y diseño visual existente. Cuando se conecte con datos reales de producción, funcionará sin necesidad de cambios adicionales.
