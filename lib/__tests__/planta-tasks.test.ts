import { describe, it, expect } from 'vitest'
import { cutCardState, orderTasks, mainTask, orderProgress, cutPlan, sortByRemnant, productLength } from '../planta-tasks'

describe('cutCardState', () => {
  it('distingue los cinco estados', () => {
    expect(cutCardState({ status: 'pendiente', quantity_requested: 6, quantity_cut: 0, material_base_id: null })).toBe('sin_chapa')
    expect(cutCardState({ status: 'pendiente', quantity_requested: 6, quantity_cut: 0, material_base_id: 'x' })).toBe('por_empezar')
    expect(cutCardState({ status: 'pendiente', quantity_requested: 6, quantity_cut: 2, material_base_id: 'x' })).toBe('cortando')
    expect(cutCardState({ status: 'pendiente_confirmacion', quantity_requested: 4, quantity_cut: 2, material_base_id: 'x' })).toBe('confirmar_recogida')
    expect(cutCardState({ status: 'completada', quantity_requested: 6, quantity_cut: 6, material_base_id: 'x' })).toBe('terminada')
    expect(cutCardState({ status: 'pendiente', quantity_requested: 6, quantity_cut: 6, material_base_id: 'x' })).toBe('terminada')
  })
})

describe('orderTasks', () => {
  it('ordena por urgencia y deduplica', () => {
    const order = {
      cut_orders: [
        { status: 'pendiente', quantity_requested: 3, quantity_cut: 0, material_base_id: null },
        { status: 'pendiente_confirmacion', quantity_requested: 2, quantity_cut: 0, material_base_id: 'x' },
        { status: 'pendiente', quantity_requested: 5, quantity_cut: 1, material_base_id: 'x' },
      ],
      preparation_items: [{ quantity_requested: 4, quantity_prepared: 1 }],
    }
    expect(orderTasks(order)).toEqual(['confirmar', 'cortar', 'preparar', 'sin_stock'])
    expect(mainTask(order)).toBe('confirmar')
  })

  it('un pedido sin nada pendiente está terminado', () => {
    expect(orderTasks({ cut_orders: [{ status: 'completada', quantity_requested: 2, quantity_cut: 2, material_base_id: 'x' }], preparation_items: [{ quantity_requested: 1, quantity_prepared: 1 }] })).toEqual(['terminado'])
    expect(orderTasks({ cut_orders: [], preparation_items: [] })).toEqual(['terminado'])
  })

  it('las preparaciones sin stock asignado siguen siendo tarea de preparar', () => {
    expect(orderTasks({ preparation_items: [{ quantity_requested: 2, quantity_prepared: 0, assigned_inventory_id: null }] })).toEqual(['preparar'])
  })
})

describe('orderProgress', () => {
  it('suma cortes y preparaciones', () => {
    expect(orderProgress({ cut_orders: [{ status: 'pendiente', quantity_requested: 6, quantity_cut: 4 }], preparation_items: [{ quantity_requested: '3', quantity_prepared: '1' }] })).toEqual({ done: 5, total: 9 })
  })
})

describe('cutPlan y sortByRemnant', () => {
  it('calcula sobrante y detecta chapa exacta', () => {
    expect(cutPlan(9.5, 4.5)).toEqual({ exact: false, remnant: 5, piecesPerSheet: 1 })
    expect(cutPlan(10, 10)).toEqual({ exact: true, remnant: 0, piecesPerSheet: 1 })
    expect(cutPlan(0, 4.5).piecesPerSheet).toBe(0)
  })

  it('ordena por menos sobrante y luego por más stock', () => {
    const sorted = sortByRemnant([
      { code: 'AC25110.13,0', stock_disponible: 4000 },
      { code: 'AC25110.9,0', stock_disponible: 14 },
      { code: 'AC25110.9,5', stock_disponible: 6 },
      { code: 'AC25110.10,0', stock_disponible: 1000 },
    ], 4.5).map(o => o.code)
    expect(sorted).toEqual(['AC25110.9,0', 'AC25110.9,5', 'AC25110.10,0', 'AC25110.13,0'])
  })

  it('productLength usa el campo o el código', () => {
    expect(productLength({ length_meters: 7.5, code: 'AC25110.4,5' })).toBe(7.5)
    expect(productLength({ length_meters: null, code: 'AC25110.4,5' })).toBe(4.5)
    expect(productLength(null)).toBe(0)
  })
})
