import { describe, expect, it } from 'vitest'
import { applyPendingToNotes, applyPendingToOrder } from '../planta-offline/apply'
import type { PlantaOp } from '../planta-sync-core'

const op = (kind: PlantaOp['kind'], payload: any, orderId = 'o1', label = ''): PlantaOp => ({ v: 1, opId: `${kind}-${Math.random()}`, kind, orderId, payload, occurredAt: '2026-11-08T10:00:00Z', label })

const order = {
  id: 'o1',
  cut_orders: [
    { id: 'c1', status: 'pendiente', quantity_requested: 6, quantity_cut: 2, material_base_id: 'p9' },
    { id: 'c2', status: 'pendiente_confirmacion', quantity_requested: 2, quantity_cut: 0, reassigned_quantity: 2, material_base_id: 'p10' },
  ],
  preparation_items: [{ id: 'i1', status: 'pendiente', quantity_requested: 3, quantity_prepared: 0 }],
}

describe('applyPendingToOrder', () => {
  it('suma cortes, preparaciones y recogidas pendientes sin tocar el original', () => {
    const out = applyPendingToOrder(order, [
      op('cut', { cutOrderId: 'c1', quantity: 4 }),
      op('prepare', { itemId: 'i1', quantity: 1 }),
      op('confirm_pickup', { cutOrderId: 'c2' }),
    ])
    expect(out.cut_orders![0]).toMatchObject({ quantity_cut: 6, status: 'completada', _pending: true })
    expect(out.cut_orders![1]).toMatchObject({ quantity_cut: 2, status: 'completada' })
    expect(out.preparation_items![0]).toMatchObject({ quantity_prepared: 1, status: 'en_proceso' })
    expect(out._pendingOps).toBe(3)
    expect(order.cut_orders[0].quantity_cut).toBe(2)
  })

  it('no pasa de lo pedido aunque haya dos cortes pendientes que suman de más', () => {
    const out = applyPendingToOrder(order, [op('cut', { cutOrderId: 'c1', quantity: 3 }), op('cut', { cutOrderId: 'c1', quantity: 3 })])
    expect(out.cut_orders![0].quantity_cut).toBe(6)
  })

  it('ignora acciones de otros pedidos', () => {
    const out = applyPendingToOrder(order, [op('cut', { cutOrderId: 'c1', quantity: 1 }, 'otro')])
    expect(out.cut_orders![0].quantity_cut).toBe(2)
    expect(out._pendingOps).toBe(0)
  })

  it('cambia la chapa en local', () => {
    const out = applyPendingToOrder(order, [op('change_sheet', { cutOrderId: 'c1', productId: 'p13', size: 13, inventoryId: 'x', quantity: 4 }, 'o1', 'Cambiar a AC25110.13,0')])
    expect(out.cut_orders![0]).toMatchObject({ material_base_id: 'p13', material_base_quantity: 13 })
    expect((out.cut_orders![0] as any).material_product.code).toBe('AC25110.13,0')
  })
})

describe('applyPendingToNotes', () => {
  it('añade notas escritas y marca leídas sin conexión', () => {
    const notes = [{ id: 'n1', content: 'hola', read_at: null }]
    const out = applyPendingToNotes(notes, [op('note', { content: 'Falta material' }), op('note_read', { noteId: 'n1', operatorName: 'Juan' })], 'o1', 'Juan')
    expect(out[0]).toMatchObject({ content: 'Falta material', _pending: true })
    expect(out[1]).toMatchObject({ id: 'n1', read_by_operator_name: 'Juan' })
  })
})
