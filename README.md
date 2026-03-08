# RAM - Sistema de Gestión de Corte y Stock | Velvok

Sistema industrial de gestión de corte y stock para operaciones metalúrgicas.

## 🎯 Descripción

RAM es un sistema MVP diseñado para digitalizar la operación del galpón de corte de Velvok, integrándose con el ERP Evo y proporcionando interfaces específicas para:

- **Administración**: Dashboard gerencial completo
- **Planta**: Interfaz optimizada para tablets en modo offline-first

## 🏗️ Stack Tecnológico

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **TailwindCSS**
- **shadcn/ui**
- **TanStack Table**
- **Recharts**
- **Framer Motion**
- **Zustand**
- **TanStack Query**

### Backend
- **Next.js Server Actions**
- **Next.js API Routes**

### Database
- **Supabase** (PostgreSQL)

### Infraestructura
- **Vercel**
- **Supabase**

### Offline
- **PWA**
- **Service Workers**
- **IndexedDB**
- **Sync Queue**

### IA
- **Vercel AI SDK**
- **Generative UI**
- **Tool calling**

## 📁 Estructura del Proyecto

```
/app
  /(admin)          # Dashboard administrativo
  /(planta)         # Interfaz operativa de depósito
  /api              # API Routes
    /webhooks/evo   # Webhook integración ERP Evo
  /components       # Componentes reutilizables
  /lib              # Utilidades y configuración
    /supabase       # Cliente Supabase
  /services         # Lógica de negocio
  /hooks            # Custom hooks
  /ai               # Copiloto IA
```

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Velvok/RAM.git
cd RAM
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiar `.env.local.example` a `.env.local` y configurar:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://efhpkccbsshcuvsdcevy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Vercel AI
OPENAI_API_KEY=your_openai_api_key_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ERP Evo Webhook Secret
EVO_WEBHOOK_SECRET=your_webhook_secret_here
```

### 4. Ejecutar migraciones de base de datos

Ejecutar el archivo SQL en Supabase:

```bash
supabase/migrations/00001_initial_schema.sql
```

O desde el dashboard de Supabase: https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## 🗄️ Base de Datos

### Tablas Principales

- **users**: Usuarios del sistema (admin, manager, operator)
- **clients**: Clientes de la empresa
- **products**: Catálogo de productos (chapas, perfiles, etc)
- **inventory**: Inventario principal con stock disponible calculado
- **orders**: Pedidos recibidos desde ERP Evo
- **order_lines**: Líneas de pedido
- **cut_orders**: Órdenes de corte generadas desde pedidos
- **cut_lines**: Detalle de cortes realizados
- **remnants**: Recortes reutilizables
- **stock_reservations**: Reservas de stock
- **stock_movements**: Trazabilidad completa
- **acopios**: Acopios de material
- **dispatches**: Despachos y remitos
- **weighings**: Registro de pesadas
- **incidents**: Incidencias operativas
- **devices**: Dispositivos registrados
- **sync_logs**: Logs de sincronización offline
- **audit_logs**: Auditoría completa

### Lógica de Inventario

```
Stock Disponible = Stock Total - Stock Reservado - Stock en Proceso
```

## 🔐 Autenticación

### Admin y Manager
- Email + Password (Supabase Auth)

### Operarios
- PIN 4-6 dígitos
- Funciona offline
- PIN hasheado en base de datos

## 📱 Modo Offline

La interfaz de planta es PWA offline-first:

- Operarios pueden trabajar sin conexión
- Acciones se guardan en IndexedDB
- Sync Queue automática al recuperar conexión
- Service Workers para cache de assets

## 🔌 Integración ERP Evo

Webhook endpoint: `/api/webhooks/evo`

El ERP Evo envía pedidos mediante webhook. El sistema:

1. Valida webhook secret
2. Crea/actualiza cliente
3. Crea/actualiza productos
4. Crea pedido
5. Genera órdenes de corte
6. Reserva stock automáticamente

## 🎨 Diseño

### Admin UI
- Clean UI modo claro
- Tablas densas
- Colores: azul oscuro + gris pizarra

### Planta UI
- Modo oscuro alto contraste
- Optimizado para tablets 10"
- Botones enormes
- Modo kiosk

## 📊 KPIs

### Operativos
- Órdenes pendientes
- Órdenes en curso
- Tiempos de corte
- Incidencias
- Recortes generados/reutilizados

### Gerenciales
- Valor stock disponible
- Valor acopios
- Desperdicio estimado
- Eficiencia reutilización
- Precisión stock

## 🤖 Copiloto IA

Integración con Vercel AI SDK:

- Consultas de stock en tiempo real
- Análisis de pedidos
- Generative UI (gráficos, tablas, KPIs)

## 🚢 Deploy

### Vercel

```bash
vercel --prod
```

### Supabase

El proyecto ya está conectado a:
https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy

## 📝 Licencia

Propietario - Velvok

## 🔗 Enlaces

- **Repositorio**: https://github.com/Velvok/RAM
- **Supabase**: https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy
- **Producción**: TBD

---

**From operation to intelligence** 🏭 → 🧠
