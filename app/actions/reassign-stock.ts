'use server'

import { createAdminClient } from '@/lib/supabase/server'
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

  // Guard: no se puede cambiar el material de una orden de corte ya completada
  if (cutOrder.status === 'completada') {
    throw new Error('No se puede cambiar el material de una orden de corte ya completada')
  }

  // Guard: la cantidad a reasignar debe ser válida y no superar lo que falta
  // por cortar (no lo solicitado originalmente) — si ya se cortaron unidades
  // con el material anterior, esas no se pueden "reasignar" retroactivamente.
  const remainingToCut = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
  if (!Number.isFinite(quantityForNewMaterial) || quantityForNewMaterial <= 0) {
    throw new Error('La cantidad debe ser mayor que 0')
  }
  if (quantityForNewMaterial > remainingToCut) {
    throw new Error(
      `La cantidad no puede exceder lo que falta por cortar (${remainingToCut} de ${cutOrder.quantity_requested} unidades)`
    )
  }

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

  // CASO 1: Reasignación COMPLETA — solo tiene sentido como swap en sitio
  // cuando todavía no se ha cortado nada; si ya hay quantity_cut > 0, cambiar
  // material_base_id para toda la orden mentiría sobre con qué material se
  // cortaron esas unidades ya hechas, así que cae al CASO 2 (crea una orden
  // hija para lo que falta y deja la original intacta para lo ya cortado).
  if (quantityForNewMaterial === cutOrder.quantity_requested && (cutOrder.quantity_cut || 0) === 0) {
    // Liberar stock del material anterior
    if (oldInventory) {
      await unreserveStock(oldInventory.id, quantityForNewMaterial)
    }

    // Reservar stock del nuevo material (optimizado - una sola query)
    const { data: currentStock } = await supabase
      .from('inventory')
      .select('stock_reservado')
      .eq('id', inventoryId)
      .single()

    const newReservado = (currentStock?.stock_reservado || 0) + quantityForNewMaterial

    await supabase
      .from('inventory')
      .update({ stock_reservado: newReservado })
      .eq('id', inventoryId)

    // Registrar movimiento único
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('stock_movements').insert({
      product_id: productId,
      movement_type: 'reserva',
      quantity: quantityForNewMaterial,
      stock_before: currentStock?.stock_reservado || 0,
      stock_after: newReservado,
      user_id: user?.id,
      notes: `Reserva de ${quantityForNewMaterial} unidades al reasignar stock`,
    })

    // Actualizar la orden existente con el nuevo material
    await supabase
      .from('cut_orders')
      .update({
        material_base_id: productId,
        material_base_quantity: quantity,  // Usar el parámetro quantity que ya tiene el tamaño correcto
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

    // Reservar stock del nuevo material (optimizado - una sola query)
    const { data: currentStock } = await supabase
      .from('inventory')
      .select('stock_reservado')
      .eq('id', inventoryId)
      .single()

    const newReservado = (currentStock?.stock_reservado || 0) + quantityForNewMaterial

    await supabase
      .from('inventory')
      .update({ stock_reservado: newReservado })
      .eq('id', inventoryId)

    // Registrar movimiento único
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('stock_movements').insert({
      product_id: productId,
      movement_type: 'reserva',
      quantity: quantityForNewMaterial,
      stock_before: currentStock?.stock_reservado || 0,
      stock_after: newReservado,
      user_id: user?.id,
      notes: `Reserva de ${quantityForNewMaterial} unidades al reasignar stock (parcial)`,
    })

    // Crear nueva orden de corte para las unidades que se mueven
    const newCutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const { data: newCutOrder, error: newCutError } = await supabase
      .from('cut_orders')
      .insert({
        cut_number: newCutNumber,
        order_id: cutOrder.order_id,
        order_line_id: cutOrder.order_line_id,
        product_id: cutOrder.product_id,
        quantity_requested: quantityForNewMaterial,
        quantity_cut: 0,
        status: 'pendiente',
        material_base_id: productId,
        material_base_quantity: quantity,
        material_quantity: 1,
        evo_item_number: cutOrder.evo_item_number || null,
        parent_cut_order_id: cutOrderId,
      })
      .select()
      .single()

    if (newCutError) throw newCutError

    // Actualizar la orden original reduciendo la cantidad. Si lo ya cortado
    // cubre exactamente lo que queda de la orden original (se reasignó todo
    // lo restante), se marca como completada para no dejarla "pendiente"
    // con 0 unidades por cortar.
    const newQuantityOriginal = cutOrder.quantity_requested - quantityForNewMaterial
    const originalNowComplete = (cutOrder.quantity_cut || 0) >= newQuantityOriginal

    await supabase
      .from('cut_orders')
      .update({
        quantity_requested: newQuantityOriginal,
        status: originalNowComplete ? 'completada' : cutOrder.status,
        finished_at: originalNowComplete ? new Date().toISOString() : cutOrder.finished_at,
      })
      .eq('id', cutOrderId)

    // Recalcular el estado agregado del pedido (puede pasar a en_corte/finalizado
    // si la orden original quedó completada)
    const { updateOrderStatus } = await import('./orders')
    await updateOrderStatus(cutOrder.order_id)

    // Revalidar rutas
    revalidatePath('/admin/pedidos', 'layout')
    revalidatePath('/admin/pedidos/[id]', 'page')

    return {
      success: true,
      message: `✅ Stock reasignado\n\nNueva orden creada: ${quantityForNewMaterial} unidades de ${product.name}\nOrden original reducida a ${newQuantityOriginal} unidades`
    }
  }
}
