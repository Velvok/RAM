import type { PlantaOp } from '@/lib/planta-sync-core'

// Aplica en local (sobre los datos que tiene la tablet) las acciones que aún
// no han llegado al servidor, para que el operario vea lo que ya hizo aunque
// esté sin conexión. Lógica pura: no toca ni la red ni la base local.

const n = (v: unknown) => Number(v) || 0

/** Devuelve una copia del pedido con las acciones pendientes aplicadas. */
export function applyPendingToOrder<T extends { id: string; cut_orders?: any[] | null; preparation_items?: any[] | null }>(order: T, ops: PlantaOp[]): T & { _pendingOps: number } {
  const mine = ops.filter(o => o.orderId === order.id)
  const copy: any = {
    ...order,
    cut_orders: (order.cut_orders || []).map(c => ({ ...c })),
    preparation_items: (order.preparation_items || []).map(p => ({ ...p })),
    _pendingOps: mine.length,
  }
  for (const op of mine) {
    switch (op.kind) {
      case 'cut': {
        const p = op.payload as PlantaOp<'cut'>['payload']
        const c = copy.cut_orders.find((x: any) => x.id === p.cutOrderId)
        if (!c) break
        const done = Math.min(n(c.quantity_requested), n(c.quantity_cut) + p.quantity)
        c.quantity_cut = done
        if (done >= n(c.quantity_requested)) c.status = 'completada'
        c._pending = true
        break
      }
      case 'prepare': {
        const p = op.payload as PlantaOp<'prepare'>['payload']
        const it = copy.preparation_items.find((x: any) => x.id === p.itemId)
        if (!it) break
        const done = Math.min(n(it.quantity_requested), n(it.quantity_prepared) + p.quantity)
        it.quantity_prepared = done
        it.status = done >= n(it.quantity_requested) ? 'completada' : 'en_proceso'
        it._pending = true
        break
      }
      case 'confirm_pickup': {
        const p = op.payload as PlantaOp<'confirm_pickup'>['payload']
        const c = copy.cut_orders.find((x: any) => x.id === p.cutOrderId)
        if (!c) break
        c.quantity_cut = Math.min(n(c.quantity_requested), n(c.quantity_cut) + (n(c.reassigned_quantity) || n(c.quantity_requested)))
        c.status = n(c.quantity_cut) >= n(c.quantity_requested) ? 'completada' : 'pendiente'
        c._pending = true
        break
      }
      case 'change_sheet': {
        const p = op.payload as PlantaOp<'change_sheet'>['payload']
        const c = copy.cut_orders.find((x: any) => x.id === p.cutOrderId)
        if (!c) break
        c.material_base_id = p.productId
        c.material_base_quantity = p.size
        const code = (op.label.match(/a (\S+)$/) || [])[1]
        c.material_product = { ...(c.material_product || {}), id: p.productId, code: code || c.material_product?.code, length_meters: p.size }
        c._pending = true
        break
      }
    }
  }
  return copy
}

/** Notas con las pendientes añadidas (las escritas y las marcadas como leídas sin conexión). */
export function applyPendingToNotes(notes: any[], ops: PlantaOp[], orderId: string, operatorName: string): any[] {
  let out = notes.map(x => ({ ...x }))
  for (const op of ops.filter(o => o.orderId === orderId)) {
    if (op.kind === 'note') {
      const p = op.payload as PlantaOp<'note'>['payload']
      out = [{ id: op.opId, order_id: orderId, content: p.content, created_by_name: `${operatorName} (planta)`, created_at: op.occurredAt, read_at: op.occurredAt, _pending: true }, ...out]
    } else if (op.kind === 'note_read') {
      const p = op.payload as PlantaOp<'note_read'>['payload']
      out = out.map(x => (x.id === p.noteId && !x.read_at ? { ...x, read_at: op.occurredAt, read_by_operator_name: p.operatorName, _pending: true } : x))
    }
  }
  return out
}
