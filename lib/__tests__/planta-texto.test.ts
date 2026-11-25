import { describe, expect, it } from 'vitest'
import { sinOrdenDeCorte } from '../planta-texto'

describe('sinOrdenDeCorte', () => {
  it('quita la orden de corte de una reasignación recibida', () => {
    expect(sinOrdenDeCorte('Chapa cortada AC25110.12,0 recibida desde pedido PRUEBA-GUILLE-1 (orden CUT-1795534602131-7qmq5cpve). Pendiente de confirmación por operario.'))
      .toBe('Chapa cortada AC25110.12,0 recibida desde pedido PRUEBA-GUILLE-1. Pendiente de confirmación por operario.')
  })

  it('quita origen y destino de una reasignación enviada', () => {
    expect(sinOrdenDeCorte('Chapa cortada AC25110.9,0 reasignada desde orden CUT-1795535095851-ttetg7ozc hacia pedido PRUEBA-GUILLE-7 (orden CUT-1795536905704-3xers4ws5)'))
      .toBe('Chapa cortada AC25110.9,0 reasignada hacia pedido PRUEBA-GUILLE-7')
  })

  it('deja igual un texto sin orden de corte', () => {
    const t = 'Juan cortó 2 unidades de CH.TRAPEZOIDAL ROJO X 7,5 M (2/2)'
    expect(sinOrdenDeCorte(t)).toBe(t)
  })
})
