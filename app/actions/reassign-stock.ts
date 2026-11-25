'use server'

import { requireStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkAndActivateOrderOnHold } from './stock-management'
import { UserError } from '@/lib/user-error'
import { extractSizeFromCode } from '@/lib/product-utils'
import { isExactLength, piecesPerSheet, sheetsFor } from '@/lib/sheet-plan'
import { moveCutReservation } from '@/lib/cut-reservations'

/**
 * Asigna o cambia la chapa de una orden de corte (oficina y tablet).
 *
 * `quantityForNewMaterial` son PIEZAS que pasan a cortarse con la chapa nueva;
 * el servidor calcula cuántas salen de cada chapa y reserva las CHAPAS que
 * hacen falta (ver lib/sheet-plan.ts). `quantity` es el largo de la chapa que
 * manda el cliente y solo se usa si el producto no tiene largo conocido.
 */
export async function reassignStock(
  cutOrderId: string,
  inventoryId: string,
  productId: string,
  quantity: number,
  quantityForNewMaterial: number
) {
  const actor = await requireStaff()

  const supabase = createAdminClient()

  const { data: cutOrder, error: fetchError } = await supabase
    .from('cut_orders')
    .select('*, product:products!cut_orders_product_id_fkey(code, length_meters)')
    .eq('id', cutOrderId)
    .single()

  if (fetchError) throw fetchError

  // Guard: no se puede cambiar el material de una orden de corte ya completada
  if (cutOrder.status === 'completada') {
    throw new UserError('No se puede cambiar el material de una orden de corte ya completada')
  }

  // Guard: la cantidad debe ser válida y no superar lo que falta por cortar
  // (lo ya cortado con el material anterior no se puede cambiar después).
  const remainingToCut = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
  if (!Number.isFinite(quantityForNewMaterial) || quantityForNewMaterial <= 0) {
    throw new UserError('La cantidad debe ser mayor que 0')
  }
  if (quantityForNewMaterial > remainingToCut) {
    throw new UserError(
      `La cantidad no puede exceder lo que falta por cortar (${remainingToCut} de ${cutOrder.quantity_requested} unidades)`
    )
  }

  const [productRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('name, code, length_meters').eq('id', productId).single(),
    supabase.from('inventory').select('id, product_id, stock_disponible').eq('id', inventoryId).maybeSingle(),
  ])
  const { data: product, error: productError } = productRes
  if (productError) throw productError
  const newInventory = inventoryRes.data
  if (!newInventory || newInventory.product_id !== productId) throw new UserError('Esa chapa ya no está en el stock. Vuelve a abrir la lista.')

  // Cuántas piezas salen de cada chapa nueva y cuántas chapas hacen falta
  const pieceProduct = Array.isArray(cutOrder.product) ? cutOrder.product[0] : cutOrder.product
  const pieceLength = Number(pieceProduct?.length_meters) || extractSizeFromCode(pieceProduct?.code || '')
  const sheetLength = Number(product.length_meters) || extractSizeFromCode(product.code || '') || Number(quantity) || 0
  // Sin largo conocido de la pieza se trata como una pieza por chapa (como antes)
  const pps = pieceLength > 0 ? (isExactLength(sheetLength, pieceLength) ? 1 : piecesPerSheet(sheetLength, pieceLength)) : 1
  if (pps < 1) throw new UserError('Esa chapa es más corta que la pieza que hay que cortar')
  const sheetsNeeded = sheetsFor(quantityForNewMaterial, pps)

  // Si es la misma chapa que ya tenía, sus chapas reservadas cuentan como disponibles
  const sameSheet = cutOrder.material_base_id === productId
  if (!sameSheet && Math.floor(Number(newInventory.stock_disponible) || 0) < sheetsNeeded) {
    throw new UserError(`No hay chapas suficientes: hacen falta ${sheetsNeeded} y quedan ${Math.max(0, Math.floor(Number(newInventory.stock_disponible) || 0))} disponibles`)
  }

  const ref = { orderId: cutOrder.order_id, userId: actor.kind === 'admin' ? actor.userId : null }
  const before = { ...cutOrder }
  const piezas = `${quantityForNewMaterial} pieza${quantityForNewMaterial !== 1 ? 's' : ''}`
  const chapas = `${sheetsNeeded} chapa${sheetsNeeded !== 1 ? 's' : ''}`

  // CASO 1: toda la orden cambia de chapa y aún no se ha cortado nada: se
  // cambia en sitio. Si ya hay piezas cortadas, cambiar material_base_id
  // mentiría sobre con qué se cortaron, así que cae al caso 2.
  if (quantityForNewMaterial === cutOrder.quantity_requested && (cutOrder.quantity_cut || 0) === 0) {
    const after = { ...cutOrder, material_base_id: productId, pieces_per_sheet: pps }
    await moveCutReservation(supabase, before, after, `Reserva de ${chapas} de ${product.code} para ${piezas} (cambio de chapa)`, ref)

    await supabase
      .from('cut_orders')
      .update({
        material_base_id: productId,
        material_base_quantity: sheetLength,
        pieces_per_sheet: pps,
        material_quantity: sheetsNeeded,
      })
      .eq('id', cutOrderId)

    // Si el pedido estaba en pausa y ya tiene todo el stock, se activa
    await checkAndActivateOrderOnHold(cutOrder.order_id)

    return {
      success: true,
      message: `✅ Material actualizado\n\n${piezas} con ${chapas} de ${product.name}`
    }
  }

  // CASO 2: solo parte de las piezas pasan a la chapa nueva: orden hija para
  // ellas y la original se queda con el resto.
  const newQuantityOriginal = cutOrder.quantity_requested - quantityForNewMaterial
  const originalAfter = { ...cutOrder, quantity_requested: newQuantityOriginal }
  const child = {
    product_id: cutOrder.product_id,
    quantity_requested: quantityForNewMaterial,
    quantity_cut: 0,
    quantity_delivered: 0,
    material_base_id: productId,
    pieces_per_sheet: pps,
  }
  await moveCutReservation(supabase, before, originalAfter, `Reserva liberada de ${piezas} que pasan a otra chapa`, ref)
  await moveCutReservation(supabase, null, child, `Reserva de ${chapas} de ${product.code} para ${piezas} (cambio de chapa parcial)`, ref)

  const newCutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const { error: newCutError } = await supabase
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
      material_base_quantity: sheetLength,
      pieces_per_sheet: pps,
      material_quantity: sheetsNeeded,
      evo_item_number: cutOrder.evo_item_number || null,
      parent_cut_order_id: cutOrderId,
    })

  if (newCutError) throw newCutError

  // Si lo ya cortado cubre lo que queda de la orden original (se movió todo lo
  // pendiente), se marca completada para no dejarla «pendiente» con 0 por cortar.
  const originalNowComplete = (cutOrder.quantity_cut || 0) >= newQuantityOriginal

  await supabase
    .from('cut_orders')
    .update({
      quantity_requested: newQuantityOriginal,
      material_quantity: sheetsFor(Math.max(0, newQuantityOriginal - (cutOrder.quantity_cut || 0)), Number(cutOrder.pieces_per_sheet) || 1),
      status: originalNowComplete ? 'completada' : cutOrder.status,
      finished_at: originalNowComplete ? new Date().toISOString() : cutOrder.finished_at,
    })
    .eq('id', cutOrderId)

  // Recalcular el estado del pedido (puede pasar a en_corte/finalizado si la
  // orden original quedó completada)
  const { updateOrderStatus } = await import('./orders')
  await updateOrderStatus(cutOrder.order_id)
  await checkAndActivateOrderOnHold(cutOrder.order_id)

  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin/pedidos/[id]', 'page')

  return {
    success: true,
    message: `✅ Stock reasignado\n\n${piezas} con ${chapas} de ${product.name}\nLa orden original queda en ${newQuantityOriginal} unidades`
  }
}
