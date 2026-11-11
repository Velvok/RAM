import { describe, expect, it } from 'vitest'
import { reservationsToRelease } from '../order-cancel'

const inv = new Map([['p10', 'inv10'], ['p13', 'inv13']])

describe('reservationsToRelease', () => {
  it('libera lo pedido de cada corte y preparación, sumando por inventario', () => {
    const out = reservationsToRelease(
      [
        { material_base_id: 'p10', quantity_requested: 4 },
        { material_base_id: 'p10', quantity_requested: 2 },
        { material_base_id: 'p13', quantity_requested: 3 },
      ],
      [{ assigned_inventory_id: 'invTH2', quantity_requested: 5 }],
      inv,
    )
    expect(Object.fromEntries(out)).toEqual({ inv10: 6, inv13: 3, invTH2: 5 })
  })

  it('también libera lo ya cortado o preparado, pero no lo entregado', () => {
    const out = reservationsToRelease(
      [{ material_base_id: 'p10', quantity_requested: 6, quantity_delivered: 2 }],
      [{ assigned_inventory_id: 'invTH2', quantity_requested: 3, quantity_delivered: 3 }],
      inv,
    )
    expect(Object.fromEntries(out)).toEqual({ inv10: 4 })
  })

  it('no libera lo que no tiene stock asignado (aprobado en pausa)', () => {
    const out = reservationsToRelease(
      [{ material_base_id: null, quantity_requested: 4 }, { material_base_id: 'p99', quantity_requested: 1 }],
      [{ assigned_inventory_id: null, quantity_requested: 2 }],
      inv,
    )
    expect(out.size).toBe(0)
  })

  it('no libera las unidades que llegaron reasignadas desde otro pedido', () => {
    const out = reservationsToRelease(
      [{ material_base_id: 'p10', quantity_requested: 5, reassigned_from_order_id: 'otro', reassigned_quantity: 2 }],
      [],
      inv,
    )
    expect(Object.fromEntries(out)).toEqual({ inv10: 3 })
  })

  it('no libera lo que este pedido cedió a otro por reasignación', () => {
    const out = reservationsToRelease(
      [{ material_base_id: 'p10', quantity_requested: 5 }, { material_base_id: 'p13', quantity_requested: 1 }],
      [],
      inv,
      new Map([['inv10', 2], ['inv13', 4]]),
    )
    expect(Object.fromEntries(out)).toEqual({ inv10: 3 })
  })
})
