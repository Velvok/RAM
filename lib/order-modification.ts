import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

// Estados en los que una modificación de EVO se aplica por diferencias sobre lo
// ya aprobado. 'nuevo' se trata aparte (se sustituyen las líneas sin más) y el
// resto (entregado, parcialmente_entregado, cancelado) no admite modificación.
export const MODIFIABLE_APPROVED_STATUSES = ['aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'modificado']

export interface ModificationItem {
  id_articulo: string
  cantidad: number
  nro_item?: number
}

interface FulfillmentItem {
  id: string
  table: 'cut_orders' | 'preparation_items'
  doneColumn: 'quantity_cut' | 'quantity_prepared'
  requested: number
  done: number
  inventoryId: string | null
}

// Unidades aprobadas de una línea (mismo criterio que approveOrder)
export function lineUnits(line: { units: number | null; quantity: number }): number {
  return line.units || Math.ceil(Number(line.quantity)) || 0
}

// Campos a actualizar en la línea para que lineUnits() pase a valer `units`
export function lineUnitsUpdate(line: { units: number | null; quantity: number }, units: number) {
  if (line.units) {
    // quantity puede estar en metros (units * length_meters): mantener la proporción
    return { units, quantity: (Number(line.quantity) / line.units) * units }
  }
  return { quantity: units }
}

async function releaseReservation(
  supabase: SupabaseAdmin,
  inventoryId: string,
  quantity: number,
  note: string
) {
  const { data: current } = await supabase
    .from('inventory')
    .select('product_id, stock_reservado')
    .eq('id', inventoryId)
    .single()

  const { error } = await supabase.rpc('unreserve_stock', {
    p_inventory_id: inventoryId,
    p_quantity: quantity
  })
  if (error) throw new Error(`Error liberando reserva: ${error.message}`)

  if (current) {
    await supabase.from('stock_movements').insert({
      product_id: current.product_id,
      movement_type: 'liberacion',
      quantity: -quantity,
      stock_before: current.stock_reservado || 0,
      stock_after: Math.max(0, (current.stock_reservado || 0) - quantity),
      notes: note,
    })
  }
}

// Quita `amount` unidades de un corte / preparación y libera su reserva. Se
// aplica también sobre lo ya cortado / preparado: esas piezas ya están cargadas
// en EVO (que es quien inicia la modificación) y vuelven a stock disponible al
// liberar la reserva; no se envía nada a EVO. Si queda a 0 se elimina; si no se
// puede (historial que lo referencia), se deja a 0 como completado.
async function reduceFulfillmentItem(
  supabase: SupabaseAdmin,
  item: FulfillmentItem,
  amount: number,
  evoOrderId: string
) {
  if (item.inventoryId) {
    await releaseReservation(
      supabase,
      item.inventoryId,
      amount,
      `Reserva liberada por modificación del pedido ${evoOrderId} desde EVO`
    )
  }

  const newRequested = item.requested - amount
  const newDone = Math.min(item.done, newRequested)
  if (newRequested === 0) {
    const { error } = await supabase.from(item.table).delete().eq('id', item.id)
    if (!error) return
    console.warn(`⚠️ No se pudo eliminar ${item.table} ${item.id}, se deja a 0:`, error.message)
  }

  const { error } = await supabase
    .from(item.table)
    .update({
      quantity_requested: newRequested,
      [item.doneColumn]: newDone,
      ...(newDone >= newRequested ? { status: 'completada' } : {})
    })
    .eq('id', item.id)
  if (error) throw new Error(`Error actualizando ${item.table}: ${error.message}`)
}

/**
 * Aplica una modificación de EVO (estado completo nuevo de `items`) a un pedido
 * ya aprobado, comparando por artículo:
 * - Bajadas / líneas eliminadas: se aplican siempre, también sobre lo ya
 *   cortado / preparado (EVO ya tiene esos movimientos): se reducen cortes y
 *   preparaciones y se libera su reserva, que vuelve a stock disponible.
 * - Subidas / líneas nuevas: quedan en order_lines.quantity_pending_approval
 *   hasta aprobar la ampliación (approveOrderModification). Lo ya aprobado sigue.
 *   El webhook pone el pedido en 'modificado' mientras haya algo pendiente.
 *
 * Devuelve avisos (no bloqueantes) para registrar en evo_events.
 */
export async function applyOrderModification(
  supabase: SupabaseAdmin,
  order: { id: string; evo_order_id: string },
  items: ModificationItem[],
  productIds: Map<string, { id: string; category: string | null }>
): Promise<{ warnings: string[]; pendingApproval: boolean }> {
  const warnings: string[] = []

  // Cantidad objetivo por producto (sumando líneas del mismo artículo)
  const targets = new Map<string, { quantity: number; evoItemNumber: string | null }>()
  for (const item of items) {
    const product = productIds.get(item.id_articulo)
    if (!product) continue
    const prev = targets.get(product.id)
    targets.set(product.id, {
      quantity: (prev?.quantity || 0) + Number(item.cantidad),
      evoItemNumber: prev?.evoItemNumber ?? (item.nro_item != null ? String(item.nro_item) : null)
    })
  }

  const [linesRes, cutsRes, prepsRes] = await Promise.all([
    supabase
      .from('order_lines')
      .select('id, product_id, quantity, units, quantity_pending_approval, evo_item_number, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('cut_orders')
      .select('id, order_line_id, quantity_requested, quantity_cut, material_base_id, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('preparation_items')
      .select('id, order_line_id, quantity_requested, quantity_prepared, assigned_inventory_id, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
  ])
  if (linesRes.error) throw new Error(`Error leyendo líneas: ${linesRes.error.message}`)
  if (cutsRes.error) throw new Error(`Error leyendo cortes: ${cutsRes.error.message}`)
  if (prepsRes.error) throw new Error(`Error leyendo preparaciones: ${prepsRes.error.message}`)

  // La reserva de un corte está en el inventario de su material base
  const materialIds = [...new Set((cutsRes.data || []).map(c => c.material_base_id).filter(Boolean))]
  const inventoryByProduct = new Map<string, string>()
  if (materialIds.length > 0) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, product_id')
      .in('product_id', materialIds)
    for (const i of inv || []) inventoryByProduct.set(i.product_id, i.id)
  }

  const fulfillmentByLine = new Map<string, FulfillmentItem[]>()
  const addFulfillment = (lineId: string | null, item: FulfillmentItem) => {
    if (!lineId) return
    fulfillmentByLine.set(lineId, [...(fulfillmentByLine.get(lineId) || []), item])
  }
  for (const c of cutsRes.data || []) {
    addFulfillment(c.order_line_id, {
      id: c.id,
      table: 'cut_orders',
      doneColumn: 'quantity_cut',
      requested: c.quantity_requested,
      done: c.quantity_cut || 0,
      inventoryId: c.material_base_id ? inventoryByProduct.get(c.material_base_id) || null : null,
    })
  }
  for (const p of prepsRes.data || []) {
    addFulfillment(p.order_line_id, {
      id: p.id,
      table: 'preparation_items',
      doneColumn: 'quantity_prepared',
      requested: p.quantity_requested,
      done: p.quantity_prepared || 0,
      inventoryId: p.assigned_inventory_id,
    })
  }

  const lines = linesRes.data || []
  const productIdsInOrder = new Set([...lines.map(l => l.product_id), ...targets.keys()])
  let pendingApproval = false

  for (const productId of productIdsInOrder) {
    const productLines = lines.filter(l => l.product_id === productId)
    const target = targets.get(productId)?.quantity || 0
    const approved = productLines.reduce((sum, l) => sum + lineUnits(l), 0)

    // EVO retira una línea que solo tenía unidades pendientes de aprobar: se elimina
    if (target === 0 && approved === 0) {
      for (const line of productLines) {
        if ((fulfillmentByLine.get(line.id) || []).length > 0) continue
        const { error } = await supabase.from('order_lines').delete().eq('id', line.id)
        if (error) console.warn(`⚠️ No se pudo eliminar la línea ${line.id}:`, error.message)
      }
      continue
    }

    if (target >= approved) {
      // Aumento (o sin cambios): el delta queda pendiente de aprobar en la primera línea
      const pending = target - approved
      if (pending > 0) pendingApproval = true

      if (productLines.length === 0) {
        const { error } = await supabase.from('order_lines').insert({
          order_id: order.id,
          product_id: productId,
          quantity: 0,
          quantity_pending_approval: pending,
          unit_price: 0,
          subtotal: 0,
          evo_item_number: targets.get(productId)?.evoItemNumber ?? null,
        })
        if (error) throw new Error(`Error creando línea nueva: ${error.message}`)
        continue
      }

      for (const [i, line] of productLines.entries()) {
        const linePending = i === 0 ? pending : 0
        if (line.quantity_pending_approval !== linePending) {
          const { error } = await supabase
            .from('order_lines')
            .update({ quantity_pending_approval: linePending })
            .eq('id', line.id)
          if (error) throw new Error(`Error actualizando línea: ${error.message}`)
        }
      }
      continue
    }

    // Reducción: quitar de las líneas más recientes primero. Se aplica siempre lo
    // que pide EVO, también sobre lo ya cortado / preparado (ver reduceFulfillmentItem)
    let toReduce = approved - target
    for (const line of [...productLines].reverse()) {
      const fulfillment = fulfillmentByLine.get(line.id) || []
      const units = lineUnits(line)
      const lineReduction = Math.min(toReduce, units)
      toReduce -= lineReduction

      let remaining = lineReduction
      for (const item of [...fulfillment].reverse()) {
        if (remaining === 0) break
        const amount = Math.min(remaining, item.requested)
        if (amount === 0) continue
        await reduceFulfillmentItem(supabase, item, amount, order.evo_order_id)
        item.requested -= amount
        item.done = Math.min(item.done, item.requested)
        remaining -= amount
      }

      const newUnits = units - lineReduction
      const hasFulfillment = fulfillment.some(f => f.requested > 0)
      if (newUnits === 0 && !hasFulfillment) {
        const { error } = await supabase.from('order_lines').delete().eq('id', line.id)
        if (!error) continue
        console.warn(`⚠️ No se pudo eliminar la línea ${line.id}, se deja a 0:`, error.message)
      }

      const { error } = await supabase
        .from('order_lines')
        .update({ ...lineUnitsUpdate(line, newUnits), quantity_pending_approval: 0 })
        .eq('id', line.id)
      if (error) throw new Error(`Error actualizando línea: ${error.message}`)
    }
  }

  return { warnings, pendingApproval }
}
