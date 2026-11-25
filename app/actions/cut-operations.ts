'use server'

import { requireStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { extractSizeFromCode, extractFamilyCode } from '@/lib/product-utils'
import { updateOrderStatus } from './orders'
import { offlineNote } from '@/lib/planta-offline-time'
import { notifyCorteRealizado, notifyChapaPreparada, type CorteMovimiento } from '@/lib/ram-outbound'
import { recordMovements } from '@/lib/historial-movimientos'
import { revalidatePath } from 'next/cache'
import { UserError } from '@/lib/user-error'
import { cutOutcome, describeLeftovers, round2, type Leftover } from '@/lib/sheet-plan'
import { inventoryIdOf, moveCutReservation } from '@/lib/cut-reservations'
import { buildCutMovimientos } from '@/lib/cut-reversal'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

/** Producto de la misma familia que `code` y de largo `length` (el remanente que deja un corte). */
async function findFamilyProductByLength(supabase: SupabaseAdmin, code: string, length: number) {
  const family = extractFamilyCode(code)
  if (!family) return null
  const escaped = family.replace(/[\\%_]/g, c => `\\${c}`)
  const { data } = await supabase.from('products').select('id, code, evo_product_id').ilike('code', `${escaped}%`)
  return (data || []).find(p => extractFamilyCode(p.code || '') === family && Math.abs(extractSizeFromCode(p.code || '') - length) < 0.01) || null
}

export async function processCutOrder(params: {
  cutOrderId: string
  selectedMaterialId: string
  materialLength: number
  quantityToCut: number
  operatorId: string
  /** Hora real del corte si se hizo sin conexión y llega más tarde */
  occurredAt?: string
}) {
  const actor = await requireStaff()

  const { cutOrderId, selectedMaterialId, materialLength, quantityToCut } = params
  // El operario es el de la sesión de planta; el del cliente solo cuenta si actúa un admin
  const operatorId = actor.kind === 'operator' ? actor.operatorId : params.operatorId

  const supabase = createAdminClient()

  // Nombre del operario para el historial. (La tabla plant_operators que se
  // consultaba antes no existe: a EVO siempre se le ha enviado el id.)
  const operatorPromise = supabase
    .from('users')
    .select('full_name')
    .eq('id', operatorId)
    .maybeSingle()
    .then(r => r) // arranca ya: el builder de Supabase es perezoso
  const operario = operatorId
  
  console.log(`\n🔍 Buscando orden de corte con ID: ${cutOrderId}`)
  
  // Obtener información de la orden de corte
  const { data: cutOrder, error: cutOrderError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      product:products!cut_orders_product_id_fkey(*),
      material_base:products!cut_orders_material_base_id_fkey(*),
      order:orders!cut_orders_order_id_fkey(*)
    `)
    .eq('id', cutOrderId)
    .single()
  
  if (cutOrderError) {
    console.error('❌ Error al buscar orden de corte:', cutOrderError)
    throw new Error(`Error al buscar orden de corte: ${cutOrderError.message}`)
  }
  
  if (!cutOrder) {
    console.error('❌ Orden de corte no encontrada para ID:', cutOrderId)
    throw new UserError('Orden de corte no encontrada')
  }
  
  console.log(`✅ Orden de corte encontrada:`, {
    id: cutOrder.id,
    product_id: cutOrder.product_id,
    quantity_requested: cutOrder.quantity_requested
  })

  // Guard: no permitir cortar una orden ya completada
  if (cutOrder.status === 'completada') {
    throw new UserError(
      `Esta orden de corte ya está completada (${cutOrder.quantity_cut}/${cutOrder.quantity_requested} unidades). No se puede registrar más corte.`
    )
  }

  // Guard: no permitir cortar más de lo que falta para completar la orden
  if (quantityToCut <= 0) {
    throw new UserError('La cantidad a cortar debe ser mayor que 0')
  }
  const remainingToCut = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
  if (quantityToCut > remainingToCut) {
    throw new UserError(
      `La cantidad a cortar (${quantityToCut}) supera lo que falta por cortar (${remainingToCut} de ${cutOrder.quantity_requested} unidades).`
    )
  }

  // Chapa con la que se corta: la asignada a la orden (lo que manda la tablet
  // solo se usa si la orden no tiene chapa asignada)
  let materialProduct: { id: string; code: string; evo_product_id: string | null; length_meters: number | null } | null =
    cutOrder.material_base || null
  if (!materialProduct) {
    const { data: inv } = await supabase.from('inventory').select('product_id').or(`id.eq.${selectedMaterialId},product_id.eq.${selectedMaterialId}`).limit(1).maybeSingle()
    if (inv?.product_id) {
      materialProduct = (await supabase.from('products').select('id, code, evo_product_id, length_meters').eq('id', inv.product_id).maybeSingle()).data
    }
  }
  if (!materialProduct) throw new UserError('Esta orden no tiene chapa asignada. Elige una chapa antes de cortar.')

  const sheetLength = Number(materialProduct.length_meters) || extractSizeFromCode(materialProduct.code || '') || Number(materialLength) || 0
  const productSize = Number(cutOrder.product?.length_meters) ||
                     extractSizeFromCode(cutOrder.product?.code || '') ||
                     sheetLength // sin largo conocido: corte exacto, sin sobrante (quantity_requested son unidades)

  // De cada chapa salen todas las piezas que caben (lib/sheet-plan.ts). Cada
  // corte registrado abre y cierra sus chapas: lo que sobra vuelve al stock.
  const outcome = cutOutcome(sheetLength, productSize, quantityToCut)
  if (outcome.sheets === 0) throw new UserError('La chapa asignada es más corta que la pieza. Cambia de chapa antes de cortar.')
  const isExactMatch = outcome.exact
  const sheetsUsed = outcome.sheets
  // Sobrante de una chapa aprovechada entera (dato del historial)
  const remnantPerSheet = isExactMatch ? 0 : round2(Math.max(0, sheetLength - outcome.piecesPerSheet * productSize))

  console.log(`📏 Corte: ${quantityToCut} × ${productSize}m con ${sheetsUsed} × ${materialProduct.code} (${sheetLength}m, ${outcome.piecesPerSheet} por chapa)` +
    (isExactMatch ? ' · largo exacto' : ` · sobra ${describeLeftovers(outcome.leftovers) || 'nada'}`))

  const newQuantityCut = (cutOrder.quantity_cut || 0) + quantityToCut
  const isFullyCompleted = newQuantityCut >= cutOrder.quantity_requested

  // Lo cortado queda reservado en el producto de la pieza hasta la entrega
  const pieceInventoryId = await inventoryIdOf(supabase, cutOrder.product_id)

  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({
      status: isFullyCompleted ? 'completada' : 'pendiente',
      quantity_cut: newQuantityCut,
      finished_at: isFullyCompleted ? new Date().toISOString() : null,
      assigned_inventory_id: pieceInventoryId,
    })
    .eq('id', cutOrderId)

  if (updateError) {
    console.error('❌ Error actualizando cut_order:', updateError)
    throw updateError
  }

  // Reserva: se liberan las chapas que ya no hacen falta para lo pendiente y
  // se reservan las piezas cortadas (con largo exacto es el mismo producto)
  try {
    await moveCutReservation(
      supabase,
      cutOrder,
      { ...cutOrder, quantity_cut: newQuantityCut },
      `Corte de ${quantityToCut} pieza${quantityToCut !== 1 ? 's' : ''} (pedido ${cutOrder.order?.order_number || ''})`,
      { orderId: cutOrder.order_id },
    )
  } catch (reserveError) {
    console.error('⚠️ Error moviendo la reserva del corte (no bloqueante):', reserveError)
  }

  // Registrar cut_line (es la unidad que luego se puede deshacer: undoLastCut)
  const { data: cutLine } = await supabase
    .from('cut_lines')
    .insert({
      cut_order_id: cutOrderId,
      material_used_id: materialProduct.id,
      quantity_used: sheetsUsed,
      quantity_produced: quantityToCut,
      remnant_generated: outcome.leftoverMeters,
      is_scrap: false,
    })
    .select('id')
    .maybeSingle()
  // Evento que se manda a EVO por este corte (si se manda)
  let outboundEventId: string | null = null
  // Sobrantes de un largo que no existe como artículo: no se pueden dar de alta
  const leftoversWithoutProduct: Leftover[] = []

  await updateOrderStatus(cutOrder.order_id)

  const evoOrderId = cutOrder.order?.evo_order_id
  const refEvo = cutOrder.ref_evo || cutOrder.order?.ref_evo
  const movementBase = {
    clientId: cutOrder.order?.client_id, orderId: cutOrder.order_id, orderNumber: cutOrder.order?.order_number,
    source: 'corte', sourceRef: `${cutOrderId}:${newQuantityCut}`,
  }

  if (isExactMatch) {
    // ========== LARGO EXACTO: no hay corte, la chapa se prepara tal cual ==========
    // EVO: PREP de la línea. El stock no cambia hasta la entrega.
    try {
      if (!evoOrderId) {
        console.log(`⏭️ Pedido sin evo_order_id, no se notifica a EVO`)
      } else if (!refEvo) {
        console.log(`⏭️ Pedido sin ref_evo, no se notifica a EVO`)
      } else if (!cutOrder.product?.evo_product_id) {
        console.log(`⏭️ Producto sin evo_product_id, no se notifica a EVO`)
      } else {
        const nroItem = cutOrder.evo_item_number ? parseInt(cutOrder.evo_item_number, 10) :
                       refEvo.nro_item || refEvo.item_number || 1

        const movimientos: CorteMovimiento[] = [{
          tipo: 'PREP',
          nro_item: nroItem,
          id_articulo: cutOrder.product.evo_product_id,
          cantidad: quantityToCut,
        }]

        outboundEventId = await notifyChapaPreparada({
          cutOrderId,
          orderId: cutOrder.order_id,
          idPedido: evoOrderId,
          refEvo,
          operario,
          movimientos,
        })
        console.log(`✅ Evento chapa_preparada (PREP) encolado para EVO`)
      }
    } catch (notifyError) {
      // No bloqueamos el corte si falla la notificación
      console.error(`⚠️ Error notificando a EVO (no bloqueante):`, notifyError)
    }

  } else {
    // ========== CORTE REAL ==========
    // El stock local no se toca: EVO es la fuente de verdad y lo devuelve por
    // stock_actualizado. Se le avisa SIEMPRE, también cuando no sobra nada
    // (3 piezas de 4 m de una chapa de 12 m): baja de las chapas gastadas, alta
    // de las piezas (con el nro_item de la línea) y alta de cada sobrante.

    // Producto de cada sobrante: mismo artículo (familia) con ese largo
    const remnants: Array<{ leftover: Leftover; product: { id: string; evo_product_id: string | null } | null }> = []
    for (const leftover of outcome.leftovers) {
      const product = await findFamilyProductByLength(supabase, materialProduct.code, leftover.length)
      remnants.push({ leftover, product })
      if (!product?.evo_product_id) leftoversWithoutProduct.push(leftover)
    }
    const remnantMovements = remnants
      .filter(r => r.product?.id)
      .map(r => ({ ...movementBase, productId: r.product!.id, type: 'remanente' as const, units: r.leftover.count }))
    if (remnantMovements.length) await recordMovements(supabase, remnantMovements)

    try {
      if (!evoOrderId) {
        console.log(`⏭️ Pedido sin evo_order_id, no se notifica a EVO`)
      } else if (!refEvo) {
        console.log(`⏭️ Pedido sin ref_evo, no se notifica a EVO`)
      } else if (!materialProduct.evo_product_id) {
        console.log(`⏭️ Material usado sin evo_product_id, no se notifica a EVO`)
      } else if (!cutOrder.product?.evo_product_id) {
        console.log(`⏭️ Producto cortado sin evo_product_id, no se notifica a EVO`)
      } else {
        const nroItem = cutOrder.evo_item_number ? parseInt(cutOrder.evo_item_number, 10) : 0
        const movimientos = buildCutMovimientos({
          sheets: sheetsUsed,
          sheetEvoId: materialProduct.evo_product_id,
          pieces: quantityToCut,
          pieceEvoId: cutOrder.product.evo_product_id,
          nroItem,
          remnants: remnants.map(r => ({ evoId: r.product?.evo_product_id, count: r.leftover.count })),
        })

        console.log(`📤 Notificando a EVO corte_realizado:`, { id_pedido: evoOrderId, movimientos })

        outboundEventId = await notifyCorteRealizado({
          cutOrderId,
          orderId: cutOrder.order_id,
          idPedido: evoOrderId,
          refEvo,
          operario,
          movimientos,
        })
        console.log(`✅ Evento corte_realizado encolado para EVO`)
      }
    } catch (notifyError) {
      // No bloqueamos el corte si falla la notificación
      console.error(`⚠️ Error notificando a EVO (no bloqueante):`, notifyError)
    }

    // Historial: piezas cortadas de otro largo
    await recordMovements(supabase, [{ ...movementBase, productId: cutOrder.product_id, type: 'corte', units: quantityToCut }])
  }

  // Enlazar el corte con su evento a EVO: al deshacerlo hay que saber qué se envió
  if (cutLine?.id && outboundEventId) {
    await supabase.from('cut_lines').update({ outbound_event_id: outboundEventId }).eq('id', cutLine.id)
  }

  // Registrar actividad en el historial
  const { data: operatorRow } = await operatorPromise
  const operator = operatorRow ? { name: operatorRow.full_name } : null
  
  console.log(`📝 Registrando actividad en historial:`, {
    order_id: cutOrder.order_id,
    cut_order_id: cutOrderId,
    parent_cut_order_id: cutOrder.parent_cut_order_id,
    is_suborder: !!cutOrder.parent_cut_order_id
  })
  
  await supabase.from('order_activity_log').insert({
    order_id: cutOrder.order_id,
    cut_order_id: cutOrderId,
    activity_type: 'cut_completed',
    description: `${operator?.name || 'Operario'} cortó ${quantityToCut} unidad${quantityToCut !== 1 ? 'es' : ''} de ${cutOrder.product?.name || 'producto'} (${newQuantityCut}/${cutOrder.quantity_requested})${offlineNote(params.occurredAt)}${leftoversWithoutProduct.length ? `. Sobrante sin artículo, no se dio de alta: ${describeLeftovers(leftoversWithoutProduct)}` : ''}`,
    metadata: {
      action: `Corte ${isFullyCompleted ? 'completado' : 'parcial'}`,
      operator_name: operator?.name,
      quantity_cut: quantityToCut,
      total_cut: newQuantityCut,
      total_requested: cutOrder.quantity_requested,
      material_length: sheetLength,
      remnant_per_sheet: remnantPerSheet,
      sheets_used: sheetsUsed,
      pieces_per_sheet: outcome.piecesPerSheet,
      exact: isExactMatch,
      leftovers: outcome.leftovers,
      leftovers_without_product: leftoversWithoutProduct,
      is_completed: isFullyCompleted,
      occurred_at: params.occurredAt ?? null,
      cut_line_id: cutLine?.id ?? null,
    }
  })
  
  console.log(`📝 Actividad registrada en el historial`)

  // Revalidar rutas para actualizar la UI
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin/pedidos/[id]', 'page')
  revalidatePath('/planta/pedidos/[id]', 'page')

  return {
    success: true,
    isFullyCompleted,
    newQuantityCut,
    totalRequested: cutOrder.quantity_requested
  }
}
