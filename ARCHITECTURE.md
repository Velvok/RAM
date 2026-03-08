# 🏗️ Arquitectura del Sistema RAM

## 📊 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        SISTEMA RAM                          │
│                  From Operation to Intelligence             │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  ERP Evo     │────────▶│  Webhook     │────────▶│  Supabase    │
│              │ POST    │  /api/evo    │  SQL    │  PostgreSQL  │
└──────────────┘         └──────────────┘         └──────────────┘
                                │                         │
                                │                         │
                                ▼                         ▼
                         ┌──────────────┐         ┌──────────────┐
                         │  Next.js     │◀────────│  Row Level   │
                         │  Server      │  Auth   │  Security    │
                         └──────────────┘         └──────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
        ┌──────────────┐              ┌──────────────┐
        │  Admin UI    │              │  Planta UI   │
        │  (Gerencia)  │              │  (Tablets)   │
        │              │              │              │
        │  - Dashboard │              │  - Login PIN │
        │  - Pedidos   │              │  - Órdenes   │
        │  - Stock     │              │  - Cortes    │
        │  - Cortes    │              │  - Offline   │
        │  - Recortes  │              │              │
        │  - Acopios   │              │  PWA + SW    │
        │  - IA Copilot│              │  IndexedDB   │
        └──────────────┘              └──────────────┘
```

## 🗂️ Estructura de Carpetas

```
RAM/
├── app/
│   ├── (admin)/                    # Rutas administrativas
│   │   ├── layout.tsx              # Layout admin (modo claro)
│   │   └── admin/
│   │       ├── page.tsx            # Dashboard principal
│   │       ├── pedidos/            # Gestión de pedidos
│   │       ├── stock/              # Gestión de inventario
│   │       ├── cortes/             # Órdenes de corte
│   │       ├── recortes/           # Gestión de recortes
│   │       └── acopios/            # Gestión de acopios
│   │
│   ├── (planta)/                   # Rutas operativas
│   │   ├── layout.tsx              # Layout planta (modo oscuro)
│   │   └── planta/
│   │       ├── login/              # Login PIN operarios
│   │       ├── ordenes/            # Lista órdenes de corte
│   │       └── ordenes/[id]/       # Detalle orden
│   │
│   ├── api/
│   │   └── webhooks/
│   │       └── evo/
│   │           └── route.ts        # Webhook ERP Evo
│   │
│   ├── layout.tsx                  # Layout raíz
│   ├── page.tsx                    # Página principal (redirect)
│   └── globals.css                 # Estilos globales
│
├── components/                     # Componentes reutilizables
│   ├── metric-card.tsx             # Card de métricas
│   ├── stock-table.tsx             # Tabla de stock
│   ├── cut-order-card.tsx          # Card de orden de corte
│   ├── operator-panel.tsx          # Panel operario
│   └── pin-pad.tsx                 # Teclado PIN
│
├── lib/                            # Utilidades y configuración
│   ├── supabase/
│   │   ├── client.ts               # Cliente browser
│   │   ├── server.ts               # Cliente server
│   │   └── database.types.ts       # Tipos generados
│   ├── indexeddb.ts                # Wrapper IndexedDB
│   ├── sync-queue.ts               # Cola sincronización
│   ├── utils.ts                    # Utilidades generales
│   └── constants.ts                # Constantes
│
├── services/                       # Lógica de negocio
│   ├── inventory.ts                # Gestión inventario
│   ├── orders.ts                   # Gestión pedidos
│   ├── cut-orders.ts               # Gestión órdenes corte
│   └── sync.ts                     # Sincronización
│
├── hooks/                          # Custom hooks
│   ├── use-offline.ts              # Detección offline
│   ├── use-sync-queue.ts           # Cola sincronización
│   ├── use-inventory.ts            # Gestión inventario
│   └── use-cut-orders.ts           # Gestión órdenes
│
├── stores/                         # Zustand stores
│   ├── auth-store.ts               # Estado autenticación
│   ├── inventory-store.ts          # Estado inventario
│   ├── sync-store.ts               # Estado sincronización
│   └── ui-store.ts                 # Estado UI
│
├── ai/                             # Copiloto IA
│   ├── tools.ts                    # Tools para consultas
│   └── copilot.tsx                 # Componente copiloto
│
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql # Migración inicial
│
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker
│   ├── icon-192.png                # Icono PWA
│   └── icon-512.png                # Icono PWA
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.local.example
├── README.md
├── SETUP.md
├── NEXT_STEPS.md
└── ARCHITECTURE.md
```

## 🗄️ Modelo de Datos

### Entidades Principales

```
┌─────────────┐
│   USERS     │
│             │
│ - id        │
│ - email     │
│ - role      │──┐
│ - pin_hash  │  │
└─────────────┘  │
                 │
┌─────────────┐  │  ┌─────────────┐
│  CLIENTS    │  │  │  PRODUCTS   │
│             │  │  │             │
│ - id        │  │  │ - id        │
│ - name      │  │  │ - code      │
│ - tax_id    │  │  │ - name      │
└─────────────┘  │  │ - threshold │
       │         │  └─────────────┘
       │         │         │
       │         │         │
       ▼         │         ▼
┌─────────────┐  │  ┌─────────────┐
│   ORDERS    │  │  │  INVENTORY  │
│             │  │  │             │
│ - id        │  │  │ - product_id│
│ - client_id │──┘  │ - stock_total
│ - status    │     │ - stock_reservado
│ - evo_id    │     │ - stock_disponible
└─────────────┘     └─────────────┘
       │                   ▲
       │                   │
       ▼                   │
┌─────────────┐            │
│ CUT_ORDERS  │            │
│             │            │
│ - id        │            │
│ - order_id  │            │
│ - status    │            │
│ - assigned  │────────────┘
└─────────────┘
       │
       ▼
┌─────────────┐
│  CUT_LINES  │
│             │
│ - material  │
│ - quantity  │
│ - remnant   │
└─────────────┘
       │
       ▼
┌─────────────┐
│  REMNANTS   │
│             │
│ - quantity  │
│ - status    │
│ - score     │
└─────────────┘
```

## 🔄 Flujo de Datos

### 1. Recepción de Pedido (ERP → Sistema)

```
ERP Evo
   │
   │ POST /api/webhooks/evo
   ▼
Webhook Handler
   │
   ├─▶ Validar Secret
   ├─▶ Crear/Actualizar Cliente
   ├─▶ Crear/Actualizar Productos
   ├─▶ Crear Pedido
   ├─▶ Crear Órdenes de Corte
   └─▶ Reservar Stock
```

### 2. Procesamiento de Corte (Planta)

```
Operario (Tablet)
   │
   ├─▶ Login PIN
   ├─▶ Ver Órdenes Asignadas
   ├─▶ Seleccionar Orden
   ├─▶ Confirmar Material Base
   ├─▶ Iniciar Corte
   ├─▶ Registrar Sobrante
   └─▶ Finalizar Corte
       │
       ▼
Sistema
   │
   ├─▶ Descontar Stock
   ├─▶ Generar Recorte/Scrap
   ├─▶ Liberar Reserva
   └─▶ Actualizar Estado
```

### 3. Sincronización Offline

```
Tablet (Sin Conexión)
   │
   ├─▶ Guardar en IndexedDB
   ├─▶ Agregar a Sync Queue
   └─▶ Continuar Operando
       │
       │ (Conexión restaurada)
       ▼
Service Worker
   │
   ├─▶ Detectar Conexión
   ├─▶ Procesar Queue
   ├─▶ Sincronizar con Supabase
   └─▶ Limpiar Queue
```

## 🔐 Seguridad

### Row Level Security (RLS)

```sql
-- Admin: Acceso total
CREATE POLICY "Admin full access" ON table_name
FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Manager: Lectura y escritura operativa
CREATE POLICY "Manager operational access" ON table_name
FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Operator: Solo sus órdenes asignadas
CREATE POLICY "Operator own orders" ON cut_orders
FOR SELECT USING (
  assigned_to = auth.uid()
);
```

## 📱 PWA y Offline

### Service Worker Strategy

```javascript
// Cache-First para assets estáticos
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});

// Network-First para datos dinámicos
if (event.request.url.includes('/api/')) {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
}
```

## 🎨 Design System

### Admin UI (Modo Claro)
- **Colores**: Blue 600, Slate 900, White
- **Tipografía**: Inter
- **Espaciado**: 4px base unit
- **Componentes**: Clean, minimal, tablas densas

### Planta UI (Modo Oscuro)
- **Colores**: Slate 900, Blue 500, High Contrast
- **Tipografía**: Inter Bold
- **Botones**: Grandes (min 60px height)
- **Optimizado**: Tablets 10" landscape

## 🚀 Performance

### Optimizaciones
- Server Components por defecto
- Streaming con Suspense
- Image optimization (Next.js)
- Code splitting automático
- PWA caching strategy
- IndexedDB para offline

---

**Arquitectura diseñada para escalabilidad y robustez industrial**
