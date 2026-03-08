# 🧭 FLUJO DE NAVEGACIÓN COMPLETO - SISTEMA RAM

## ✅ ARREGLADO

### 1. Error de parámetros dinámicos
- ✅ Arreglado en `/admin/pedidos/[id]`
- ✅ Arreglado en `/admin/cortes/[id]`
- Ahora funcionan correctamente con Next.js 15+

### 2. Botón de "Ajustar Stock"
- ✅ Agregado en `/admin/stock`
- Botón verde con icono "+"
- Ubicado en la esquina superior derecha

---

## 🗺️ MAPA DE NAVEGACIÓN

### Dashboard (`/admin`)
```
┌─────────────────────────────────────┐
│         DASHBOARD                   │
│                                     │
│  [Pedidos]  [Stock]  [Cortes]      │
│     ↓         ↓         ↓           │
└─────────────────────────────────────┘
```

### Pedidos (`/admin/pedidos`)
```
┌─────────────────────────────────────┐
│         PEDIDOS                     │
│                                     │
│  [← Dashboard]                      │
│                                     │
│  Tabla de pedidos:                  │
│  - PED-2024-001  [Ver detalle] →    │
│  - PED-2024-002  [Ver detalle] →    │
└─────────────────────────────────────┘
```

### Detalle de Pedido (`/admin/pedidos/[id]`)
```
┌─────────────────────────────────────┐
│    [← Volver]  PED-2024-001         │
│                                     │
│  Cliente: Metalúrgica San Martín    │
│                                     │
│  Líneas del pedido                  │
│  Órdenes de corte:                  │
│  - CUT-2024-001  [Click] →          │
│  - CUT-2024-002  [Click] →          │
│                                     │
│  Información del cliente            │
└─────────────────────────────────────┘
```

### Stock (`/admin/stock`)
```
┌─────────────────────────────────────┐
│         STOCK          [+ Ajustar]  │
│                              ↓      │
│  [← Dashboard]               ↓      │
│                              ↓      │
│  Tabla de inventario         ↓      │
│  - CH-3MM-1000              ↓      │
│  - CH-6MM-1000              ↓      │
│  - CH-10MM-1000             ↓      │
└─────────────────────────────────────┘
```

### Ajustes de Stock (`/admin/stock/ajustes`)
```
┌─────────────────────────────────────┐
│    [← Volver]  AJUSTAR STOCK        │
│                                     │
│  Formulario:                        │
│  - Producto (ID)                    │
│  - Tipo (Entrada/Salida)            │
│  - Cantidad                         │
│  - Notas                            │
│                                     │
│  [Guardar]  [Cancelar] →            │
│      ↓           ↓                  │
│   Success    Volver                 │
│      ↓                              │
│   /admin/stock                      │
└─────────────────────────────────────┘
```

### Órdenes de Corte (`/admin/cortes`)
```
┌─────────────────────────────────────┐
│         ÓRDENES DE CORTE            │
│                                     │
│  [← Dashboard]                      │
│                                     │
│  Tabla de órdenes:                  │
│  - CUT-2024-001  [Click] →          │
│  - CUT-2024-002  [Click] →          │
│  - CUT-2024-003  [Click] →          │
└─────────────────────────────────────┘
```

### Detalle de Orden de Corte (`/admin/cortes/[id]`)
```
┌─────────────────────────────────────┐
│    [← Volver]  CUT-2024-001         │
│                                     │
│  Pedido: PED-2024-001 [Click] →     │
│                  ↓                  │
│  Producto, cantidades               │
│  Timeline de estados                │
│  Información del pedido             │
└─────────────────────────────────────┘
```

---

## 🔄 FLUJOS COMPLETOS

### Flujo 1: Ver un pedido completo
1. `/admin` → Click en "Pedidos"
2. `/admin/pedidos` → Click en "Ver detalle" de PED-2024-001
3. `/admin/pedidos/[id]` → Ver líneas, órdenes de corte, cliente
4. Click en orden de corte CUT-2024-001
5. `/admin/cortes/[id]` → Ver detalle de la orden
6. Click en "Volver" → Regresa a `/admin/cortes`
7. Click en "Dashboard" → Regresa a `/admin`

### Flujo 2: Ajustar stock
1. `/admin` → Click en "Stock"
2. `/admin/stock` → Click en botón "+ Ajustar Stock"
3. `/admin/stock/ajustes` → Completar formulario
4. Click en "Guardar" → Toast de éxito → Regresa a `/admin/stock`
5. Ver stock actualizado en la tabla

### Flujo 3: Desde orden de corte a pedido
1. `/admin/cortes` → Click en CUT-2024-001
2. `/admin/cortes/[id]` → Ver detalle
3. Click en número de pedido (PED-2024-001)
4. `/admin/pedidos/[id]` → Ver pedido completo
5. Click en "Volver" → Regresa a `/admin/pedidos`

---

## 🎯 NAVEGACIÓN DISPONIBLE EN CADA PÁGINA

### `/admin` (Dashboard)
- ✅ Navegación superior: Pedidos, Stock, Cortes
- ✅ Tarjetas clickeables (futuro)

### `/admin/pedidos` (Lista)
- ✅ Navegación superior: Dashboard, Stock, Cortes
- ✅ Botón "Ver detalle" en cada fila → `/admin/pedidos/[id]`

### `/admin/pedidos/[id]` (Detalle)
- ✅ Navegación superior: Dashboard, Pedidos, Stock, Cortes
- ✅ Botón "← Volver" → `/admin/pedidos`
- ✅ Links a órdenes de corte → `/admin/cortes/[id]`

### `/admin/stock` (Lista)
- ✅ Navegación superior: Dashboard, Pedidos, Cortes
- ✅ Botón "+ Ajustar Stock" → `/admin/stock/ajustes`

### `/admin/stock/ajustes` (Formulario)
- ✅ Navegación superior: Dashboard, Pedidos, Stock, Cortes
- ✅ Botón "← Volver" → `/admin/stock`
- ✅ Botón "Cancelar" → `/admin/stock`
- ✅ Botón "Guardar" → Toast + Redirect a `/admin/stock`

### `/admin/cortes` (Lista)
- ✅ Navegación superior: Dashboard, Pedidos, Stock
- ✅ Click en número de orden → `/admin/cortes/[id]`

### `/admin/cortes/[id]` (Detalle)
- ✅ Navegación superior: Dashboard, Pedidos, Stock, Cortes
- ✅ Botón "← Volver" → `/admin/cortes`
- ✅ Link a pedido → `/admin/pedidos/[id]`

---

## 📱 BREADCRUMBS (Futuro)

Para mejorar aún más la navegación, se pueden agregar breadcrumbs:

```
Dashboard > Pedidos > PED-2024-001
Dashboard > Stock > Ajustar Stock
Dashboard > Cortes > CUT-2024-001
```

---

## ✅ CHECKLIST DE NAVEGACIÓN

- [x] Dashboard tiene links a todas las secciones
- [x] Todas las páginas tienen navegación superior
- [x] Todas las páginas de detalle tienen botón "Volver"
- [x] Stock tiene botón "Ajustar Stock"
- [x] Ajustes tiene botones "Guardar" y "Cancelar"
- [x] Detalle de pedido tiene links a órdenes de corte
- [x] Detalle de orden tiene link a pedido
- [x] Formularios redirigen después de guardar
- [x] Toasts notifican acciones exitosas/fallidas

---

## 🎯 PRÓXIMAS MEJORAS

1. **Breadcrumbs** - Mostrar ruta actual
2. **Tabs** - En páginas de detalle (Info, Historial, Documentos)
3. **Acciones rápidas** - Botones en tablas (Editar, Eliminar, etc.)
4. **Búsqueda** - Filtrar en listas
5. **Paginación** - Para listas largas

---

**¡Ahora tienes un flujo de navegación completo y coherente!** 🎉
