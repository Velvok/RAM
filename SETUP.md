# Instrucciones de Configuración - RAM Velvok

## ✅ Completado

### 1. Estructura del Proyecto
- ✅ Configuración Next.js 15 con App Router
- ✅ TypeScript configurado
- ✅ TailwindCSS configurado
- ✅ Estructura de carpetas (admin) y (planta)

### 2. Base de Datos
- ✅ Esquema SQL completo con 17 tablas
- ✅ Row Level Security (RLS) configurado
- ✅ Triggers y funciones automáticas
- ✅ Tipos TypeScript generados

### 3. Integración Supabase
- ✅ Cliente browser configurado
- ✅ Cliente server configurado
- ✅ Tipos de base de datos

### 4. API y Webhooks
- ✅ Webhook ERP Evo (`/api/webhooks/evo`)
- ✅ Lógica de creación de pedidos
- ✅ Reserva automática de stock

### 5. Componentes Base
- ✅ Layout admin
- ✅ Layout planta (modo oscuro)
- ✅ Dashboard admin
- ✅ MetricCard component

### 6. Configuración PWA
- ✅ manifest.json
- ✅ Configuración para modo offline

## 🚧 Pendiente de Implementar

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Ejecutar Migración de Base de Datos

**Opción A: Desde Supabase Dashboard**

1. Ir a https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy
2. SQL Editor → New Query
3. Copiar contenido de `supabase/migrations/00001_initial_schema.sql`
4. Ejecutar

**Opción B: Desde CLI (si tienes Supabase CLI)**

```bash
supabase db push
```

### 3. Configurar Variables de Entorno

Crear archivo `.env.local`:

```bash
cp .env.local.example .env.local
```

Obtener las keys desde Supabase Dashboard:
- Project Settings → API
- Copiar `URL` y `anon public`
- Copiar `service_role` (solo para backend)

### 4. Componentes Adicionales a Crear

#### Admin
- [ ] `/app/(admin)/admin/pedidos/page.tsx` - Lista de pedidos
- [ ] `/app/(admin)/admin/stock/page.tsx` - Gestión de stock
- [ ] `/app/(admin)/admin/cortes/page.tsx` - Órdenes de corte
- [ ] `/app/(admin)/admin/recortes/page.tsx` - Gestión de recortes
- [ ] `/app/(admin)/admin/acopios/page.tsx` - Gestión de acopios
- [ ] `/components/stock-table.tsx` - Tabla de stock
- [ ] `/components/cut-order-card.tsx` - Card de orden de corte

#### Planta
- [ ] `/app/(planta)/planta/page.tsx` - Home operario
- [ ] `/app/(planta)/planta/login/page.tsx` - Login PIN
- [ ] `/app/(planta)/planta/ordenes/page.tsx` - Lista órdenes
- [ ] `/app/(planta)/planta/ordenes/[id]/page.tsx` - Detalle orden
- [ ] `/components/operator-panel.tsx` - Panel operario
- [ ] `/components/pin-pad.tsx` - Teclado PIN

### 5. Server Actions

Crear en `/app/actions/`:

- [ ] `auth.ts` - Autenticación PIN
- [ ] `orders.ts` - Gestión de pedidos
- [ ] `cut-orders.ts` - Gestión de órdenes de corte
- [ ] `inventory.ts` - Gestión de inventario
- [ ] `sync.ts` - Sincronización offline

### 6. Hooks Personalizados

Crear en `/hooks/`:

- [ ] `use-offline.ts` - Detección de estado offline
- [ ] `use-sync-queue.ts` - Cola de sincronización
- [ ] `use-inventory.ts` - Gestión de inventario
- [ ] `use-cut-orders.ts` - Gestión de órdenes de corte

### 7. Service Workers

Crear en `/public/`:

- [ ] `sw.js` - Service Worker para PWA
- [ ] Configurar cache de assets
- [ ] Configurar estrategias de cache

### 8. IndexedDB

Crear en `/lib/`:

- [ ] `indexeddb.ts` - Wrapper de IndexedDB
- [ ] `sync-queue.ts` - Cola de sincronización
- [ ] Esquema de tablas locales

### 9. Vercel AI SDK

Crear en `/ai/`:

- [ ] `tools.ts` - Tools para consultas
- [ ] `copilot.tsx` - Componente copiloto
- [ ] Integración con Generative UI

### 10. Zustand Stores

Crear en `/stores/`:

- [ ] `auth-store.ts` - Estado de autenticación
- [ ] `inventory-store.ts` - Estado de inventario
- [ ] `sync-store.ts` - Estado de sincronización
- [ ] `ui-store.ts` - Estado de UI

### 11. Utilidades

Crear en `/lib/`:

- [ ] `utils.ts` - Utilidades generales
- [ ] `validators.ts` - Validaciones
- [ ] `formatters.ts` - Formateadores
- [ ] `constants.ts` - Constantes

### 12. Testing

- [ ] Configurar Jest
- [ ] Tests unitarios para lógica de inventario
- [ ] Tests de integración para webhooks
- [ ] Tests E2E con Playwright

## 📝 Datos de Prueba

### Crear Usuario Admin

```sql
INSERT INTO users (email, full_name, role, is_active)
VALUES ('admin@velvok.com', 'Administrador', 'admin', true);
```

### Crear Productos de Prueba

```sql
INSERT INTO products (code, name, category, thickness_mm, min_remnant_threshold)
VALUES 
  ('CH-3MM', 'Chapa 3mm', 'chapas', 3.0, 500),
  ('CH-6MM', 'Chapa 6mm', 'chapas', 6.0, 500),
  ('PF-100', 'Perfil 100x50', 'perfiles', NULL, 1000);

INSERT INTO inventory (product_id, stock_total)
SELECT id, 10000 FROM products;
```

### Crear Operario con PIN

```sql
-- PIN: 1234 (hasheado con bcrypt)
INSERT INTO users (full_name, role, pin_hash, is_active)
VALUES ('Juan Operario', 'operator', '$2a$10$...', true);
```

## 🚀 Ejecutar Proyecto

```bash
npm run dev
```

Abrir:
- Admin: http://localhost:3000/admin
- Planta: http://localhost:3000/planta

## 🔗 Recursos

- **Supabase Dashboard**: https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy
- **GitHub Repo**: https://github.com/Velvok/RAM
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vercel AI SDK**: https://sdk.vercel.ai/docs

## 📞 Soporte

Para dudas o problemas, contactar al equipo de desarrollo.

---

**Prioridad de Implementación:**

1. ✅ Instalar dependencias
2. ✅ Ejecutar migración DB
3. ✅ Configurar .env.local
4. 🔴 Crear Server Actions básicos
5. 🔴 Implementar autenticación PIN
6. 🔴 Crear pantallas de planta
7. 🔴 Implementar sistema offline
8. 🟡 Crear pantallas de admin
9. 🟡 Integrar IA Copiloto
10. 🟢 Testing y optimización
