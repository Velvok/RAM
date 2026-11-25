import { cutReservation } from '@/lib/sheet-plan'

// Reserva que libera un pedido al cancelarlo, por inventario.
//
// Un corte tiene reservado (lib/sheet-plan.ts, cutReservation):
// - lo que falta por cortar, en CHAPAS de su chapa base (de cada chapa pueden
//   salir varias piezas);
// - lo ya cortado y sin entregar, en PIEZAS del producto pedido.
// Una preparación, sus unidades en su inventario asignado. Lo ya entregado ya
// liberó su parte.
// Las unidades que llegan por reasignación desde otro pedido y aún no se han
// confirmado no se reservaron aquí (siguen reservadas en el pedido de origen),
// así que no se liberan. Y al revés: lo que este pedido cedió a otros por
// reasignación sigue reservado aquí pero lo va a usar el otro pedido (que lo
// liberará al entregarse), así que tampoco se libera (`outgoing`, por inventario).

export interface CancelCut {
  product_id?: string | null
  material_base_id: string | null
  quantity_requested: number | null
  quantity_cut?: number | null
  quantity_delivered?: number | null
  pieces_per_sheet?: number | null
  reassigned_from_order_id?: string | null
  reassigned_quantity?: number | null
}

export interface CancelPrep {
  assigned_inventory_id: string | null
  quantity_requested: number | null
  quantity_delivered?: number | null
}

export function reservationsToRelease(
  cuts: CancelCut[],
  preps: CancelPrep[],
  inventoryByProduct: Map<string, string>,
  outgoing: Map<string, number> = new Map(),
): Map<string, number> {
  const out = new Map<string, number>()
  const add = (inventoryId: string | null | undefined, amount: number) => {
    if (!inventoryId || !(amount > 0)) return
    out.set(inventoryId, (out.get(inventoryId) || 0) + amount)
  }
  for (const c of cuts) {
    const r = cutReservation(c)
    if (c.material_base_id) add(inventoryByProduct.get(c.material_base_id), r.sheets)
    if (c.product_id) add(inventoryByProduct.get(c.product_id), r.pieces)
  }
  for (const p of preps) {
    add(p.assigned_inventory_id, (Number(p.quantity_requested) || 0) - (Number(p.quantity_delivered) || 0))
  }
  for (const [inventoryId, given] of outgoing) {
    const left = (out.get(inventoryId) || 0) - given
    if (left > 0) out.set(inventoryId, left)
    else out.delete(inventoryId)
  }
  return out
}
