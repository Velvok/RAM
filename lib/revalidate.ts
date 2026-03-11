import { revalidatePath } from 'next/cache'

/**
 * Revalida todas las rutas principales del sistema
 * Usar después de cualquier mutación importante (crear/actualizar/eliminar)
 */
export function revalidateAll() {
  // Layout principal
  revalidatePath('/', 'layout')
  
  // Dashboard admin
  revalidatePath('/admin', 'page')
  revalidatePath('/admin', 'layout')
  
  // Pedidos
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  
  // Stock
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  
  // Cortes
  revalidatePath('/admin/cortes', 'page')
  revalidatePath('/admin/cortes', 'layout')
  
  // Recortes
  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/admin/recortes', 'layout')
  
  // Planta
  revalidatePath('/planta/pedidos', 'page')
  revalidatePath('/planta/pedidos', 'layout')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
}

/**
 * Revalida rutas relacionadas con pedidos
 */
export function revalidateOrders(orderId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
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
  revalidatePath('/', 'layout')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
}

/**
 * Revalida rutas relacionadas con cortes
 */
export function revalidateCuts(cutOrderId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/cortes', 'page')
  revalidatePath('/admin/cortes', 'layout')
  revalidatePath('/planta/ordenes', 'page')
  
  if (cutOrderId) {
    revalidatePath(`/admin/cortes/${cutOrderId}`, 'page')
    revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  }
}
