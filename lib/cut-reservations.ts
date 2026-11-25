import type { createAdminClient } from '@/lib/supabase/server'
import { cutReservation, type ReservableCut } from '@/lib/sheet-plan'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

// Movimiento de reservas de las órdenes de corte (solo servidor). Las reglas
// están en lib/sheet-plan.ts (cutReservation): chapas de la chapa base para lo
// que falta por cortar y piezas del producto pedido para lo ya cortado.

/** Id de inventario de un producto (hay una fila por producto). Lo crea si falta. */
export async function inventoryIdOf(supabase: SupabaseAdmin, productId: string | null | undefined): Promise<string | null> {
  if (!productId) return null
  const { data } = await supabase.from('inventory').select('id').eq('product_id', productId).maybeSingle()
  if (data?.id) return data.id
  const { data: created } = await supabase.from('inventory').insert({ product_id: productId, stock_total: 0 }).select('id').maybeSingle()
  return created?.id ?? null
}

/** Sube (`delta` > 0) o baja (`delta` < 0) lo reservado de un inventario y lo deja en stock_movements. */
export async function changeReservation(
  supabase: SupabaseAdmin,
  inventoryId: string | null | undefined,
  delta: number,
  note: string,
  ref?: { orderId?: string | null; userId?: string | null },
): Promise<void> {
  if (!inventoryId || !delta) return
  const { data: current } = await supabase.from('inventory').select('product_id, stock_reservado').eq('id', inventoryId).maybeSingle()
  if (!current) return
  const before = Number(current.stock_reservado) || 0
  const after = Math.max(0, before + delta)
  if (delta > 0) {
    const { error } = await supabase.from('inventory').update({ stock_reservado: after }).eq('id', inventoryId)
    if (error) throw new Error(`Error reservando stock: ${error.message}`)
  } else {
    const { error } = await supabase.rpc('unreserve_stock', { p_inventory_id: inventoryId, p_quantity: -delta })
    if (error) throw new Error(`Error liberando reserva: ${error.message}`)
  }
  await supabase.from('stock_movements').insert({
    product_id: current.product_id,
    movement_type: delta > 0 ? 'reserva' : 'liberacion',
    quantity: delta,
    stock_before: before,
    stock_after: after,
    reference_id: ref?.orderId ?? null,
    reference_type: ref?.orderId ? 'order' : null,
    user_id: ref?.userId ?? null,
    notes: note,
  })
}

export interface CutForReservation extends ReservableCut {
  product_id: string
}

/**
 * Lleva la reserva de una orden de corte de su estado `before` al `after`
 * (cambió lo pedido, lo cortado, la chapa o las piezas por chapa): ajusta las
 * chapas de cada chapa base y las piezas del producto pedido.
 * Pasa `null` en `before` para una orden nueva o en `after` para una que desaparece.
 */
export async function moveCutReservation(
  supabase: SupabaseAdmin,
  before: CutForReservation | null,
  after: CutForReservation | null,
  note: string,
  ref?: { orderId?: string | null; userId?: string | null },
): Promise<void> {
  const deltas = new Map<string, number>() // por producto
  const add = (productId: string | null | undefined, amount: number) => {
    if (productId && amount) deltas.set(productId, (deltas.get(productId) || 0) + amount)
  }
  if (before) {
    const r = cutReservation(before)
    add(before.material_base_id, -r.sheets)
    add(before.product_id, -r.pieces)
  }
  if (after) {
    const r = cutReservation(after)
    add(after.material_base_id, r.sheets)
    add(after.product_id, r.pieces)
  }
  for (const [productId, delta] of deltas) {
    if (!delta) continue
    await changeReservation(supabase, await inventoryIdOf(supabase, productId), delta, note, ref)
  }
}
