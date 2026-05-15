'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { extractSizeFromName } from '@/lib/product-utils'
import { revalidatePath } from 'next/cache'

export async function reassignStock(
  cutOrderId: string,
  inventoryId: string,
  productId: string,
  quantity: number,
  quantityForNewMaterial: number
) {
  const supabase = createAdminClient()

  // Obtener la cut_order actual
  const { data: cutOrder, error: fetchError } = await supabase
    .from('cut_orders')
    .select('*')
    .eq('id', cutOrderId)
    .single()

  if (fetchError) throw fetchError

  // Obtener el producto del nuevo material
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single()

  if (productError) throw productError

  const { reserveStock, unreserveStock } = await import('./stock-management')

  // Obtener inventory_id del stock original
  const { data: oldInventory } = await supabase
    .from('inventory')
    .select('id')
    .eq('product_id', cutOrder.material_base_id)
    .single()

  // CASO 1: Reasignación COMPLETA (todas las unidades)
  if (quantityForNewMaterial === cutOrder.quantity_requested) {
    // Liberar stock del material anterior
    if (oldInventory) {
      await unreserveStock(oldInventory.id, quantityForNewMaterial)
    }

    // Reservar stock del nuevo material
    for (let i = 0; i < quantityForNewMaterial; i++) {
      await reserveStock(inventoryId)
    }

    // Actualizar la orden existente con el nuevo material
    await supabase
      .from('cut_orders')
      .update({
        material_base_id: productId,
        material_base_quantity: extractSizeFromName(product.name || ''),
        material_quantity: 1
      })
      .eq('id', cutOrderId)

    return {
      success: true,
      message: `✅ Material actualizado\n\n${quantityForNewMaterial} unidades ahora con ${product.name}`
    }
  }
  // CASO 2: Reasignación PARCIAL (solo algunas unidades)
  else {
    // Liberar stock del material anterior (solo las unidades que se mueven)
    if (oldInventory) {
      await unreserveStock(oldInventory.id, quantityForNewMaterial)
    }

    // Reservar stock del nuevo material
    for (let i = 0; i < quantityForNewMaterial; i++) {
      await reserveStock(inventoryId)
    }

    // Crear nueva orden de corte para las unidades que se mueven
    const newCutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const { data: newCutOrder, error: newCutError } = await supabase
      .from('cut_orders')
      .insert({
        cut_number: newCutNumber,
        order_id: cutOrder.order_id,
        product_id: cutOrder.product_id,
        quantity_requested: quantityForNewMaterial,
        quantity_cut: 0,
        status: 'pendiente',
        material_base_id: productId,
        material_base_quantity: extractSizeFromName(product.name || ''),
        material_quantity: 1
      })
      .select()
      .single()

    if (newCutError) throw newCutError

    // Actualizar la orden original reduciendo la cantidad
    const newQuantityOriginal = cutOrder.quantity_requested - quantityForNewMaterial

    await supabase
      .from('cut_orders')
      .update({
        quantity_requested: newQuantityOriginal
      })
      .eq('id', cutOrderId)

    // Revalidar rutas
    revalidatePath('/admin/pedidos', 'layout')
    revalidatePath('/admin/pedidos/[id]', 'page')

    return {
      success: true,
      message: `✅ Stock reasignado\n\nNueva orden creada: ${quantityForNewMaterial} unidades de ${product.name}\nOrden original reducida a ${newQuantityOriginal} unidades`
    }
  }
}
