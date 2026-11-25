import { describe, expect, it } from 'vitest'
import { cutOutcome, cutReservation, describeLeftovers, isExactLength, piecesPerSheet, proposePlan, sheetsFor } from '../sheet-plan'

describe('piecesPerSheet y sheetsFor', () => {
  it('de 12 m salen 3 piezas de 4 m, justas', () => {
    expect(piecesPerSheet(12, 4)).toBe(3)
    expect(piecesPerSheet(12, 4.5)).toBe(2)
    expect(piecesPerSheet(9.5, 4.5)).toBe(2)
    expect(piecesPerSheet(4, 4)).toBe(1)
  })

  it('aguanta decimales que no son exactos en binario', () => {
    expect(piecesPerSheet(0.9, 0.3)).toBe(3)
    expect(piecesPerSheet(7.5, 2.5)).toBe(3)
  })

  it('una chapa más corta que la pieza no sirve', () => {
    expect(piecesPerSheet(3, 4)).toBe(0)
    expect(piecesPerSheet(0, 4)).toBe(0)
    expect(piecesPerSheet(12, 0)).toBe(0)
  })

  it('chapas necesarias', () => {
    expect(sheetsFor(3, 3)).toBe(1)
    expect(sheetsFor(5, 3)).toBe(2)
    expect(sheetsFor(0, 3)).toBe(0)
    expect(sheetsFor(4, 1)).toBe(4)
    expect(sheetsFor(4, 0)).toBe(4) // sin dato: una pieza por chapa, como antes
  })
})

describe('cutOutcome', () => {
  it('3 de 4 m con chapa de 12 m: 1 chapa, no sobra nada', () => {
    expect(cutOutcome(12, 4, 3)).toEqual({ exact: false, piecesPerSheet: 3, sheets: 1, leftovers: [], leftoverMeters: 0 })
  })

  it('2 de 4,5 m con chapa de 12 m: 1 chapa, sobra un trozo de 3 m', () => {
    expect(cutOutcome(12, 4.5, 2)).toMatchObject({ sheets: 1, leftovers: [{ length: 3, count: 1 }], leftoverMeters: 3 })
  })

  it('5 de 4 m con chapas de 12 m: 2 chapas, sobra un trozo de 4 m', () => {
    expect(cutOutcome(12, 4, 5)).toMatchObject({ sheets: 2, leftovers: [{ length: 4, count: 1 }], leftoverMeters: 4 })
  })

  it('corte a medias: 1 pieza de una chapa que da 3 deja 8 m', () => {
    expect(cutOutcome(12, 4, 1)).toMatchObject({ sheets: 1, leftovers: [{ length: 8, count: 1 }] })
  })

  it('varias chapas con sobrante cada una y una última a medias', () => {
    // 5 piezas de 4,5 m de chapas de 12 m: 2 completas (sobran 3 m cada una) + 1 con una pieza (sobran 7,5 m)
    expect(cutOutcome(12, 4.5, 5)).toMatchObject({
      sheets: 3,
      leftovers: [{ length: 7.5, count: 1 }, { length: 3, count: 2 }],
      leftoverMeters: 13.5,
    })
  })

  it('largo exacto: una chapa por pieza y sin sobrante', () => {
    expect(isExactLength(4, 4)).toBe(true)
    expect(cutOutcome(4, 4, 3)).toEqual({ exact: true, piecesPerSheet: 1, sheets: 3, leftovers: [], leftoverMeters: 0 })
  })

  it('una pieza por chapa: igual que el comportamiento anterior', () => {
    expect(cutOutcome(9.5, 5, 2)).toMatchObject({ piecesPerSheet: 1, sheets: 2, leftovers: [{ length: 4.5, count: 2 }], leftoverMeters: 9 })
  })

  it('chapa que no sirve o cantidad 0: nada', () => {
    expect(cutOutcome(3, 4, 2).sheets).toBe(0)
    expect(cutOutcome(12, 4, 0).sheets).toBe(0)
  })
})

describe('proposePlan', () => {
  const c = (id: string, length: number, available: number) => ({ id, length, available })

  it('3 de 4 m: una chapa de 12 m antes que tres de 9,5 m', () => {
    expect(proposePlan(3, 4, [c('a', 9.5, 5), c('b', 12, 2)])).toEqual({
      parts: [{ id: 'b', length: 12, sheets: 1, pieces: 3, piecesPerSheet: 3, leftoverMeters: 0 }],
      uncovered: 0,
    })
  })

  it('prefiere el largo exacto aunque haya que completar con otra chapa', () => {
    const plan = proposePlan(5, 4, [c('e', 4, 1), c('a', 12, 4), c('b', 9.5, 2)])
    expect(plan.uncovered).toBe(0)
    expect(plan.parts).toEqual([
      { id: 'e', length: 4, sheets: 1, pieces: 1, piecesPerSheet: 1, leftoverMeters: 0 },
      { id: 'b', length: 9.5, sheets: 2, pieces: 4, piecesPerSheet: 2, leftoverMeters: 3 },
    ])
  })

  it('a igual sobrante, menos chapas', () => {
    // 2 de 4 m: una de 8 m (0 sobra, 1 chapa) frente a… otra de 8 m no hay; 12 m deja 4
    expect(proposePlan(2, 4, [c('a', 12, 3), c('b', 8, 1)]).parts[0]).toMatchObject({ id: 'b', sheets: 1, leftoverMeters: 0 })
  })

  it('si una chapa sola no alcanza, usa la que más cubre y sigue con otra', () => {
    const plan = proposePlan(5, 4, [c('a', 12, 1), c('b', 8, 1)])
    expect(plan.uncovered).toBe(0)
    expect(plan.parts.map(p => [p.id, p.pieces, p.sheets])).toEqual([['a', 3, 1], ['b', 2, 1]])
  })

  it('si no hay stock para todo, dice cuántas piezas quedan sin chapa', () => {
    expect(proposePlan(7, 4, [c('a', 12, 1)])).toMatchObject({ uncovered: 4 })
    expect(proposePlan(2, 4, [])).toEqual({ parts: [], uncovered: 2 })
    expect(proposePlan(2, 4, [c('corta', 3, 9)])).toEqual({ parts: [], uncovered: 2 })
  })

  it('no cuenta medias chapas disponibles', () => {
    expect(proposePlan(3, 4, [c('a', 12, 0.5)]).uncovered).toBe(3)
  })
})

describe('cutReservation', () => {
  const base = { material_base_id: 'chapa', pieces_per_sheet: 3, quantity_requested: 5, quantity_cut: 0, quantity_delivered: 0 }

  it('sin cortar: chapas de lo pendiente', () => {
    expect(cutReservation(base)).toEqual({ sheets: 2, pieces: 0 })
  })

  it('al cortar, la reserva pasa de chapas a piezas', () => {
    expect(cutReservation({ ...base, quantity_cut: 3 })).toEqual({ sheets: 1, pieces: 3 })
    expect(cutReservation({ ...base, quantity_cut: 5 })).toEqual({ sheets: 0, pieces: 5 })
  })

  it('lo entregado ya no está reservado', () => {
    expect(cutReservation({ ...base, quantity_cut: 5, quantity_delivered: 2 })).toEqual({ sheets: 0, pieces: 3 })
    expect(cutReservation({ ...base, quantity_cut: 5, quantity_delivered: 5 })).toEqual({ sheets: 0, pieces: 0 })
  })

  it('sin chapa asignada no hay nada reservado', () => {
    expect(cutReservation({ ...base, material_base_id: null })).toEqual({ sheets: 0, pieces: 0 })
  })

  it('una pieza por chapa (órdenes anteriores al cambio): chapas = piezas', () => {
    expect(cutReservation({ ...base, pieces_per_sheet: 1 })).toEqual({ sheets: 5, pieces: 0 })
    expect(cutReservation({ ...base, pieces_per_sheet: null, quantity_cut: 2 })).toEqual({ sheets: 3, pieces: 2 })
  })

  it('las piezas que llegan de otro pedido no necesitan chapa', () => {
    expect(cutReservation({ ...base, pieces_per_sheet: 1, quantity_requested: 4, reassigned_from_order_id: 'x', reassigned_quantity: 2 })).toEqual({ sheets: 2, pieces: 0 })
  })
})

describe('describeLeftovers', () => {
  it('une los trozos en una frase', () => {
    expect(describeLeftovers([])).toBe('')
    expect(describeLeftovers([{ length: 8, count: 1 }])).toBe('1 de 8,0 m')
    expect(describeLeftovers([{ length: 7.5, count: 1 }, { length: 3, count: 2 }])).toBe('1 de 7,5 m y 2 de 3,0 m')
  })
})
