import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Tags de caché para revalidación granular
 */
export const CACHE_TAGS = {
  ORDERS: 'orders',
  ORDER: (id: string) => `order-${id}`,
  STOCK: 'stock',
  INVENTORY: 'inventory',
  CUT_ORDERS: 'cut-orders',
  CUT_ORDER: (id: string) => `cut-order-${id}`,
  DASHBOARD: 'dashboard',
  PRODUCTS: 'products',
  CLIENTS: 'clients',
} as const

/**
 * Revalida todas las rutas principales del sistema
 * USAR SOLO cuando sea absolutamente necesario (ej: cambios masivos)
 */
export function revalidateAll() {
  console.log('🔄 Revalidando TODAS las rutas...')
  
  // Revalidar layouts y páginas principales
  revalidatePath('/', 'layout')
  revalidatePath('/admin', 'layout')
  revalidatePath('/planta', 'layout')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/pedidos', 'page')
  revalidatePath('/planta/ordenes', 'page')
}

/**
 * Revalida rutas relacionadas con pedidos
 * Optimizado para evitar revalidaciones innecesarias
 */
export function revalidateOrders(orderId?: string) {
  console.log(` Revalidando pedidos${orderId ? ` (ID: ${orderId})` : ''}`)
  
  // Revalidar layouts primero
  revalidatePath('/admin', 'layout')
  revalidatePath('/planta', 'layout')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/planta/pedidos', 'layout')
  
  // Luego páginas específicas
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/planta/pedidos', 'page')
  
  if (orderId) {
    revalidatePath(`/admin/pedidos/${orderId}`, 'page')
    revalidatePath(`/planta/pedidos/${orderId}`, 'page')
  }
}

/**
 * Revalida rutas relacionadas con stock
 */
export function revalidateStock() {
  console.log(' Revalidando stock')
  
  // Revalidar layouts primero
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/stock', 'layout')
  
  // Luego páginas
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/recortes', 'page')
}

/**
 * Revalida rutas relacionadas con órdenes de corte
 */
export function revalidateCuts(cutOrderId?: string) {
  console.log(` Revalidando cortes${cutOrderId ? ` (ID: ${cutOrderId})` : ''}`)
  
  // Revalidar layouts primero
  revalidatePath('/planta', 'layout')
  revalidatePath('/admin', 'layout')
  
  // Luego páginas
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/admin/pedidos', 'page')
  console.log(`🔄 Revalidando cortes${cutOrderId ? ` (ID: ${cutOrderId})` : ''}`)
  
  if (cutOrderId) {
    revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  }
  
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/admin', 'page')
}

/**
 * Revalida cuando cambia el estado de un pedido
 * Afecta: pedidos, stock, cortes y dashboard
 */
export function revalidateOrderStatus(orderId: string) {
  console.log(`🔄 Revalidando estado de pedido: ${orderId}`)
  
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/planta/pedidos', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/admin', 'page')
}

/**
 * Revalida cuando se modifica inventario
 * Afecta: stock, pedidos (por disponibilidad) y dashboard
 */
export function revalidateInventory() {
  console.log('🔄 Revalidando inventario')
  
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin', 'page')
}
