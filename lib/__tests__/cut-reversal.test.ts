import { describe, expect, it } from 'vitest'
import { buildCutMovimientos, buildReversalMovimientos, evoActionFor, orderStatusAfterUndo, stockEffect, undoBlocker } from '../cut-reversal'
import type { CorteMovimiento } from '../ram-outbound'

// Corte real: 2 chapas de 12 m → 2 piezas de 10 m (línea 3 del pedido) + 2 remanentes de 2 m
const corteReal: CorteMovimiento[] = [
  { tipo: 'BAJA', nro_item: 0, id_articulo: 'CH12', cantidad: 2 },
  { tipo: 'ALTA', nro_item: 3, id_articulo: 'CH10', cantidad: 2 },
  { tipo: 'ALTA', nro_item: 0, id_articulo: 'CH2', cantidad: 2 },
]
const prep: CorteMovimiento[] = [{ tipo: 'PREP', nro_item: 1, id_articulo: 'CH5', cantidad: 3 }]

describe('buildReversalMovimientos', () => {
  it('modo negativo: mismos movimientos con la cantidad en negativo', () => {
    expect(buildReversalMovimientos(corteReal, 'negativo')).toEqual([
      { tipo: 'BAJA', nro_item: 0, id_articulo: 'CH12', cantidad: -2 },
      { tipo: 'ALTA', nro_item: 3, id_articulo: 'CH10', cantidad: -2 },
      { tipo: 'ALTA', nro_item: 0, id_articulo: 'CH2', cantidad: -2 },
    ])
  })

  it('modo intercambio: BAJA↔ALTA con la cantidad en positivo y el mismo nro_item', () => {
    expect(buildReversalMovimientos(corteReal, 'intercambio')).toEqual([
      { tipo: 'ALTA', nro_item: 0, id_articulo: 'CH12', cantidad: 2 },
      { tipo: 'BAJA', nro_item: 3, id_articulo: 'CH10', cantidad: 2 },
      { tipo: 'BAJA', nro_item: 0, id_articulo: 'CH2', cantidad: 2 },
    ])
  })

  it('el PREP siempre se invierte en negativo, en los dos modos', () => {
    const esperado = [{ tipo: 'PREP', nro_item: 1, id_articulo: 'CH5', cantidad: -3 }]
    expect(buildReversalMovimientos(prep, 'negativo')).toEqual(esperado)
    expect(buildReversalMovimientos(prep, 'intercambio')).toEqual(esperado)
  })

  it('no modifica los movimientos originales', () => {
    const copia = JSON.parse(JSON.stringify(corteReal))
    buildReversalMovimientos(corteReal, 'negativo')
    expect(corteReal).toEqual(copia)
  })

  it('original + inverso dejan el stock de cada artículo como estaba, en los dos modos', () => {
    const neto = (movs: CorteMovimiento[]) => {
      const out: Record<string, number> = {}
      for (const m of movs) out[m.id_articulo] = (out[m.id_articulo] || 0) + (m.tipo === 'ALTA' ? m.cantidad : -m.cantidad)
      return out
    }
    for (const mode of ['negativo', 'intercambio'] as const) {
      expect(neto([...corteReal, ...buildReversalMovimientos(corteReal, mode)])).toEqual({ CH12: 0, CH10: 0, CH2: 0 })
    }
  })
})

describe('stockEffect', () => {
  it('devuelve la chapa y retira la pieza y el remanente', () => {
    expect(stockEffect(corteReal)).toEqual([
      { id_articulo: 'CH12', delta: 2 },
      { id_articulo: 'CH10', delta: -2 },
      { id_articulo: 'CH2', delta: -2 },
    ])
  })

  it('un corte exacto (PREP) no mueve stock', () => {
    expect(stockEffect(prep)).toEqual([])
  })
})

describe('evoActionFor', () => {
  it('sin evento o descartado: EVO nunca supo del corte', () => {
    expect(evoActionFor(null)).toEqual({ action: 'ninguno' })
    expect(evoActionFor({ status: 'cancelled' })).toEqual({ action: 'ninguno' })
  })

  it('pendiente de enviar: basta con descartarlo', () => {
    expect(evoActionFor({ status: 'pending' })).toEqual({ action: 'descartar' })
  })

  it('confirmado por EVO: hay que mandar el inverso', () => {
    expect(evoActionFor({ status: 'success', http_status: 200 })).toEqual({ action: 'inverso' })
  })

  it('enviado sin confirmar: bloqueado', () => {
    expect(evoActionFor({ status: 'processing' }).action).toBe('bloqueado')
  })

  it('rechazado por EVO (4xx o confirmación con error): se descarta', () => {
    expect(evoActionFor({ status: 'failed', http_status: 400 })).toEqual({ action: 'descartar' })
    expect(evoActionFor({ status: 'failed', http_status: 200, response_body: { evo_confirmation: { estado: 'error' } } })).toEqual({ action: 'descartar' })
  })

  it('fallo sin saber si EVO lo aplicó (timeout, 5xx, 200 sin confirmación): bloqueado', () => {
    expect(evoActionFor({ status: 'failed', http_status: 0 }).action).toBe('bloqueado')
    expect(evoActionFor({ status: 'failed', http_status: 502 }).action).toBe('bloqueado')
    expect(evoActionFor({ status: 'failed', http_status: 200, response_body: {} }).action).toBe('bloqueado')
  })
})

describe('undoBlocker', () => {
  const base = {
    orderStatus: 'finalizado',
    cutOrder: { status: 'completada', quantity_requested: 2, quantity_cut: 2, quantity_delivered: 0 },
    lineQuantity: 2,
    activeLinesTotal: 2,
    givenToOthers: false,
  }

  it('un corte normal se puede deshacer', () => {
    expect(undoBlocker(base)).toBeNull()
  })

  it('un corte parcial también, si es el último', () => {
    expect(undoBlocker({ ...base, orderStatus: 'en_corte', cutOrder: { status: 'pendiente', quantity_requested: 5, quantity_cut: 3 }, lineQuantity: 1, activeLinesTotal: 3 })).toBeNull()
  })

  it('no en pedidos entregados o eliminados', () => {
    expect(undoBlocker({ ...base, orderStatus: 'entregado' })).toMatch(/entregado/)
    expect(undoBlocker({ ...base, orderStatus: 'cancelado' })).toMatch(/eliminado/)
  })

  it('no si la orden ya se entregó o el corte dejaría menos de lo entregado', () => {
    expect(undoBlocker({ ...base, cutOrder: { ...base.cutOrder, status: 'entregado' } })).toMatch(/entregó/)
    expect(undoBlocker({ ...base, orderStatus: 'parcialmente_entregado', cutOrder: { ...base.cutOrder, quantity_delivered: 1 } })).toMatch(/entregó/)
  })

  it('sí si lo entregado es de un corte anterior', () => {
    expect(undoBlocker({
      ...base, orderStatus: 'parcialmente_entregado',
      cutOrder: { status: 'completada', quantity_requested: 4, quantity_cut: 4, quantity_delivered: 2 },
      lineQuantity: 2, activeLinesTotal: 4,
    })).toBeNull()
  })

  it('no con una reasignación en curso (destino u origen)', () => {
    expect(undoBlocker({ ...base, cutOrder: { ...base.cutOrder, status: 'pendiente_confirmacion' } })).toMatch(/reasignación/)
    expect(undoBlocker({ ...base, cutOrder: { ...base.cutOrder, reassigned_from_cut_order_id: 'x' } })).toMatch(/reasignación/)
    expect(undoBlocker({ ...base, givenToOthers: true })).toMatch(/reasignación/)
  })

  it('no si lo cortado no coincide con los cortes registrados (reasignación ya confirmada)', () => {
    expect(undoBlocker({ ...base, cutOrder: { ...base.cutOrder, quantity_cut: 1 }, lineQuantity: 2, activeLinesTotal: 2 })).toMatch(/reasignaciones/)
    expect(undoBlocker({ ...base, cutOrder: { ...base.cutOrder, quantity_requested: 3, quantity_cut: 3 }, lineQuantity: 2, activeLinesTotal: 2 })).toMatch(/reasignaciones/)
  })
})

describe('orderStatusAfterUndo', () => {
  it('finalizado o en corte → en corte si queda algo hecho', () => {
    expect(orderStatusAfterUndo('finalizado', false)).toBe('en_corte')
    expect(orderStatusAfterUndo('en_corte', false)).toBe('en_corte')
  })

  it('vuelve a aprobado si ya no queda nada hecho', () => {
    expect(orderStatusAfterUndo('finalizado', true)).toBe('aprobado')
    expect(orderStatusAfterUndo('en_corte', true)).toBe('aprobado')
  })

  it('conserva los estados que no dependen del avance', () => {
    for (const s of ['parcialmente_entregado', 'aprobado_en_pausa', 'modificado']) {
      expect(orderStatusAfterUndo(s, true)).toBe(s)
      expect(orderStatusAfterUndo(s, false)).toBe(s)
    }
  })
})

describe('buildCutMovimientos (varias piezas por chapa)', () => {
  it('3 piezas de 4 m de una chapa de 12 m: baja 1, alta 3, sin sobrante', () => {
    expect(buildCutMovimientos({ sheets: 1, sheetEvoId: 'CH12', pieces: 3, pieceEvoId: 'CH4', nroItem: 2, remnants: [] })).toEqual([
      { tipo: 'BAJA', nro_item: 0, id_articulo: 'CH12', cantidad: 1 },
      { tipo: 'ALTA', nro_item: 2, id_articulo: 'CH4', cantidad: 3 },
    ])
  })

  it('con sobrantes: un alta por cada largo, sin nro_item de línea', () => {
    const movs = buildCutMovimientos({
      sheets: 3, sheetEvoId: 'CH12', pieces: 5, pieceEvoId: 'CH4,5', nroItem: 1,
      remnants: [{ evoId: 'CH7,5', count: 1 }, { evoId: 'CH3', count: 2 }],
    })
    expect(movs.slice(2)).toEqual([
      { tipo: 'ALTA', nro_item: 0, id_articulo: 'CH7,5', cantidad: 1 },
      { tipo: 'ALTA', nro_item: 0, id_articulo: 'CH3', cantidad: 2 },
    ])
  })

  it('un sobrante sin artículo en EVO no se manda', () => {
    expect(buildCutMovimientos({ sheets: 1, sheetEvoId: 'CH12', pieces: 2, pieceEvoId: 'CH4,3', nroItem: 1, remnants: [{ evoId: null, count: 1 }] })).toHaveLength(2)
  })

  it('deshacerlo deja el stock de cada artículo como estaba', () => {
    const movs = buildCutMovimientos({ sheets: 1, sheetEvoId: 'CH12', pieces: 2, pieceEvoId: 'CH4,5', nroItem: 1, remnants: [{ evoId: 'CH3', count: 1 }] })
    expect(stockEffect(movs)).toEqual([
      { id_articulo: 'CH12', delta: 1 },
      { id_articulo: 'CH4,5', delta: -2 },
      { id_articulo: 'CH3', delta: -1 },
    ])
    expect(buildReversalMovimientos(movs, 'negativo').map(m => m.cantidad)).toEqual([-1, -2, -1])
  })
})
