import { describe, expect, it } from 'vitest'
import { clampQuantity, parsePlantaOp, PLANTA_OP_VERSION } from '../planta-sync-core'

const NOW = Date.parse('2026-11-08T15:00:00Z')
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const base = { v: PLANTA_OP_VERSION, opId: id(1), orderId: id(2), occurredAt: '2026-11-08T09:00:00Z', label: 'Corte 2 × AC' }

describe('parsePlantaOp', () => {
  it('conserva el operario que hizo la acción y rechaza uno no válido', () => {
    const prep = { ...base, kind: 'prepare', payload: { itemId: id(3), quantity: 1 } }
    const r = parsePlantaOp({ ...prep, operatorId: id(9) }, NOW)
    expect(r.ok && r.op.operatorId).toBe(id(9))
    const sin = parsePlantaOp(prep, NOW)
    expect(sin.ok && sin.op.operatorId).toBeUndefined()
    expect(parsePlantaOp({ ...prep, operatorId: 'juan' }, NOW).ok).toBe(false)
  })

  it('acepta un corte hecho horas antes sin conexión', () => {
    const r = parsePlantaOp({ ...base, kind: 'cut', payload: { cutOrderId: id(3), selectedMaterialId: id(4), materialLength: 9, quantity: 2 } }, NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.op.payload).toEqual({ cutOrderId: id(3), selectedMaterialId: id(4), materialLength: 9, quantity: 2 })
  })

  it('rechaza datos incompletos o cantidades raras', () => {
    expect(parsePlantaOp({ ...base, kind: 'cut', payload: { cutOrderId: id(3), quantity: 2 } }, NOW).ok).toBe(false)
    expect(parsePlantaOp({ ...base, kind: 'prepare', payload: { itemId: id(3), quantity: 0 } }, NOW).ok).toBe(false)
    expect(parsePlantaOp({ ...base, kind: 'prepare', payload: { itemId: id(3), quantity: 1.5 } }, NOW).ok).toBe(false)
    expect(parsePlantaOp({ ...base, kind: 'borrar_todo', payload: {} }, NOW).ok).toBe(false)
  })

  it('rechaza horas fuera de rango (reloj mal puesto)', () => {
    const op = { ...base, kind: 'confirm_pickup', payload: { cutOrderId: id(3) } }
    expect(parsePlantaOp({ ...op, occurredAt: '2026-10-01T00:00:00Z' }, NOW).ok).toBe(false)
    expect(parsePlantaOp({ ...op, occurredAt: '2026-11-08T16:00:00Z' }, NOW).ok).toBe(false)
    expect(parsePlantaOp(op, NOW).ok).toBe(true)
  })

  it('devuelve el opId aunque la operación no valga, para poder responderla', () => {
    const r = parsePlantaOp({ ...base, v: 99, kind: 'note', payload: { content: 'hola' } }, NOW)
    expect(r).toMatchObject({ ok: false, opId: id(1) })
  })

  it('recorta notas largas y rechaza las vacías', () => {
    const r = parsePlantaOp({ ...base, kind: 'note', payload: { content: 'x'.repeat(900) } }, NOW)
    expect(r.ok && (r.op.payload as any).content.length).toBe(500)
    expect(parsePlantaOp({ ...base, kind: 'note', payload: { content: '   ' } }, NOW).ok).toBe(false)
  })
})

describe('clampQuantity', () => {
  it('aplica todo si cabe', () => expect(clampQuantity(6, 2, 3)).toEqual({ apply: 3, excess: 0 }))
  it('aplica solo lo que falta y cuenta el exceso', () => expect(clampQuantity(6, 5, 3)).toEqual({ apply: 1, excess: 2 }))
  it('no aplica nada si ya estaba hecho', () => expect(clampQuantity(6, 6, 2)).toEqual({ apply: 0, excess: 2 }))
})
