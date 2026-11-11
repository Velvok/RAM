// Reserva que libera un pedido al cancelarlo, por inventario.
//
// Igual que en approveOrder y en las modificaciones de EVO: un corte tiene
// reservadas sus unidades pedidas en el inventario de su material base y una
// preparación en su inventario asignado. Lo ya entregado ya liberó su parte.
// Las unidades que llegaron por reasignación desde otro pedido no se
// reservaron aquí (siguen reservadas en el pedido de origen), así que no se
// liberan. Y al revés: lo que este pedido cedió a otros por reasignación sigue
// reservado aquí pero lo va a usar el otro pedido (que lo liberará al
// entregarse), así que tampoco se libera (`outgoing`, por inventario).

export interface CancelCut {
  material_base_id: string | null
  quantity_requested: number | null
  quantity_delivered?: number | null
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
    if (!c.material_base_id) continue
    const reassigned = c.reassigned_from_order_id ? Number(c.reassigned_quantity) || 0 : 0
    add(inventoryByProduct.get(c.material_base_id), (Number(c.quantity_requested) || 0) - (Number(c.quantity_delivered) || 0) - reassigned)
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
