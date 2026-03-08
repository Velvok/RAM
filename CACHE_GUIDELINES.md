# 🚨 GUÍA DEFINITIVA ANTI-CACHÉ - Next.js 15

## ⚠️ PROBLEMA CRÍTICO
Next.js 15 tiene un sistema de caché MUY AGRESIVO que causa que los datos no se actualicen sin un refresh fuerte (Ctrl+Shift+R).

---

## ✅ CONFIGURACIÓN GLOBAL ANTI-CACHÉ

**TODO EL CACHÉ ESTÁ DESHABILITADO GLOBALMENTE** - No necesitas preocuparte por caché en nuevas funcionalidades.

### Archivos Configurados:

1. **`next.config.js`**
   - Headers HTTP anti-caché
   - staleTimes en 0
   - CDN cache deshabilitado

2. **`app/layout.tsx`**
   - `dynamic = 'force-dynamic'`
   - `revalidate = 0`
   - `fetchCache = 'force-no-store'`

3. **`app/fetch-config.ts`**
   - Sobrescribe fetch global
   - Fuerza `cache: 'no-store'` en todas las peticiones

4. **`lib/supabase/server.ts`**
   - Configuración custom de fetch para Supabase
   - Sin caché en queries de base de datos

---

## ✅ SOLUCIÓN IMPLEMENTADA PARA COMPONENTES

### 1. **Server Actions** (`app/actions/*.ts`)
**NO necesitan directivas `dynamic` y `revalidate`** (esas solo van en páginas).

**Solo necesitan:**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**⚠️ IMPORTANTE:** Las directivas `export const dynamic` y `export const revalidate` SOLO funcionan en páginas (`page.tsx`) y layouts (`layout.tsx`), NO en server actions.

### 2. **Revalidación de Rutas**
**SIEMPRE revalidar MÚLTIPLES rutas y tipos:**

```typescript
// ❌ MAL - Solo revalida una ruta
revalidatePath('/admin/pedidos')

// ✅ BIEN - Revalida múltiples rutas y tipos
revalidatePath('/admin/pedidos', 'page')
revalidatePath('/admin/pedidos', 'layout')
revalidatePath(`/admin/pedidos/${id}`, 'page')
revalidatePath('/admin/cortes', 'page')  // Rutas relacionadas
```

### 3. **Páginas Server Component** (`app/**/page.tsx`)
**SIEMPRE agregar:**

```typescript
// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

### 4. **Client Components con Mutaciones**
**MEJOR PRÁCTICA: Recargar datos sin window.location.reload()**

```typescript
// ❌ MAL - Recarga toda la página (lento y puede causar caché)
async function handleAction() {
  await someAction()
  window.location.reload()
}

// ✅ BIEN - Recarga solo los datos necesarios
export default function MyComponent({ data: initialData }: { data: any }) {
  const [data, setData] = useState(initialData)
  const router = useRouter()
  
  async function reloadData() {
    const updated = await getData(data.id)
    setData(updated)
    router.refresh()
  }
  
  async function handleAction() {
    setLoading(true)
    try {
      await someAction()
      await reloadData()  // Recarga datos sin recargar página
    } catch (error) {
      showError('Error')
    } finally {
      setLoading(false)
    }
  }
}
```

**⚠️ IMPORTANTE:** Usar estado local + `router.refresh()` es mejor que `window.location.reload()` porque:
- ✅ Más rápido (no recarga toda la página)
- ✅ Mejor UX (no pierde scroll ni estado)
- ✅ Evita problemas de caché del navegador

### 5. **Configuración Global** (`next.config.js`)
Ya configurado para deshabilitar caché en todas las rutas:

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      ],
    },
  ]
}
```

---

## 📋 CHECKLIST PARA NUEVAS FUNCIONALIDADES

Cuando crees CUALQUIER nueva funcionalidad que modifique datos:

- [ ] ✅ Revalidar TODAS las rutas afectadas con tipo `'page'` y `'layout'`
- [ ] ✅ Revalidar rutas de detalle con el ID: `revalidatePath(\`/ruta/${id}\`, 'page')`
- [ ] ✅ Revalidar rutas relacionadas (ej: si modificas pedidos, revalida cortes)
- [ ] ✅ Client component usa `window.location.reload()` después de mutaciones
- [ ] ✅ Página tiene `export const dynamic = 'force-dynamic'`
- [ ] ✅ Página tiene `export const revalidate = 0`

**⚠️ NOTA:** NO agregues `dynamic` ni `revalidate` en server actions - solo en páginas.

---

## 🎯 RUTAS A REVALIDAR POR MÓDULO

### Pedidos
```typescript
revalidatePath('/admin/pedidos', 'page')
revalidatePath('/admin/pedidos', 'layout')
revalidatePath(`/admin/pedidos/${orderId}`, 'page')
revalidatePath('/admin/cortes', 'page')  // Relacionado
revalidatePath('/planta/ordenes', 'page')  // Relacionado
```

### Órdenes de Corte
```typescript
revalidatePath('/admin/cortes', 'page')
revalidatePath('/admin/cortes', 'layout')
revalidatePath(`/admin/cortes/${cutOrderId}`, 'page')
revalidatePath('/planta/ordenes', 'page')
revalidatePath('/planta/ordenes', 'layout')
revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
revalidatePath('/admin/pedidos', 'page')  // Relacionado
revalidatePath('/admin/stock', 'page')  // Relacionado
revalidatePath('/admin/recortes', 'page')  // Relacionado
```

### Recortes
```typescript
revalidatePath('/admin/recortes', 'page')
revalidatePath('/admin/recortes', 'layout')
revalidatePath(`/admin/recortes/${remnantId}`, 'page')
revalidatePath('/admin/stock', 'page')  // Relacionado
```

### Stock
```typescript
revalidatePath('/admin/stock', 'page')
revalidatePath('/admin/stock', 'layout')
revalidatePath('/admin/cortes', 'page')  // Relacionado
revalidatePath('/admin/recortes', 'page')  // Relacionado
```

---

## 🔥 REGLA DE ORO

**SI MODIFICAS DATOS, REVALIDA TODO LO QUE PUEDA MOSTRAR ESOS DATOS**

No seas tímido con las revalidaciones. Es mejor revalidar de más que de menos.

---

## 📝 EJEMPLOS COMPLETOS

### Ejemplo 1: Server Action que crea un pedido
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createOrder(data: any) {
  const supabase = await createClient()
  
  const { data: order, error } = await supabase
    .from('orders')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  
  // Revalidar TODO lo relacionado
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin', 'page')
  
  return { success: true, order }
}
```

### Ejemplo 2: Client Component que usa la action
```typescript
'use client'

import { useState } from 'react'
import { createOrder } from '@/app/actions/orders'

export default function CreateOrderButton() {
  const [loading, setLoading] = useState(false)
  
  async function handleCreate() {
    setLoading(true)
    try {
      await createOrder({ /* data */ })
      // IMPORTANTE: Usar window.location.reload()
      window.location.reload()
    } catch (error) {
      alert('Error')
      setLoading(false)  // Solo si falla
    }
  }
  
  return (
    <button onClick={handleCreate} disabled={loading}>
      {loading ? 'Creando...' : 'Crear Pedido'}
    </button>
  )
}
```

### Ejemplo 3: Página Server Component
```typescript
import { getOrders } from '@/app/actions/orders'

// IMPORTANTE: Agregar estas líneas
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PedidosPage() {
  const orders = await getOrders()
  
  return (
    <div>
      {/* UI */}
    </div>
  )
}
```

---

## 🚫 ERRORES COMUNES

### ❌ Error 1: No revalidar suficientes rutas
```typescript
// MAL
revalidatePath('/admin/pedidos')

// BIEN
revalidatePath('/admin/pedidos', 'page')
revalidatePath('/admin/pedidos', 'layout')
revalidatePath('/admin/cortes', 'page')
```

### ❌ Error 2: Usar router.refresh()
```typescript
// MAL
router.refresh()

// BIEN
window.location.reload()
```

### ❌ Error 3: Agregar directivas en server actions
```typescript
// MAL - Las directivas NO van en server actions
'use server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'  // ❌ ERROR
export const revalidate = 0  // ❌ ERROR

// BIEN - Las directivas solo van en páginas
'use server'
import { createClient } from '@/lib/supabase/server'
// Sin directivas en server actions
```

---

## 🎓 RESUMEN EJECUTIVO

1. **Server Actions:** NO necesitan directivas - solo revalidatePath múltiple
2. **Revalidación:** Múltiples rutas con tipos `'page'` y `'layout'`
3. **Client Components:** Usar `window.location.reload()` después de mutaciones
4. **Páginas:** Siempre `export const dynamic = 'force-dynamic'` y `export const revalidate = 0`
5. **next.config.js:** Headers Cache-Control configurados globalmente
6. **Regla de Oro:** Revalida TODO lo que pueda mostrar los datos modificados

---

**NUNCA MÁS PROBLEMAS DE CACHÉ** ✅
