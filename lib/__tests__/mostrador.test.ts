import { describe, expect, it } from 'vitest'
import { isMostrador, shouldAutoApprove } from '../mostrador'

describe('isMostrador', () => {
  it('reconoce el tercero MOSTRADO de EVO', () => {
    expect(isMostrador({ codter: 'MOSTRADO' })).toBe(true)
    expect(isMostrador({ codter: ' mostrado ' })).toBe(true)
  })

  it('reconoce todos los terceros que empiezan por MOSTRA (MOSTRAD4, MOSTRAD5, MOSTRA20)', () => {
    expect(isMostrador({ codter: 'MOSTRAD4' })).toBe(true)
    expect(isMostrador({ codter: 'MOSTRAD5' })).toBe(true)
    expect(isMostrador({ codter: 'MOSTRA20' })).toBe(true)
    expect(isMostrador({ codter: 'MOSTR' })).toBe(false)
    expect(shouldAutoApprove({ refEvo: { codter: 'MOSTRAD4' }, missingProducts: 0 })).toBe(true)
  })

  it('un cliente normal no es Mostrador', () => {
    expect(isMostrador({ codter: '22624' })).toBe(false)
    expect(isMostrador({ codter: '' })).toBe(false)
    expect(isMostrador(null)).toBe(false)
    expect(isMostrador(undefined)).toBe(false)
  })
})

describe('shouldAutoApprove', () => {
  it('Mostrador con todos los artículos reconocidos: se aprueba solo', () => {
    expect(shouldAutoApprove({ refEvo: { codter: 'MOSTRADO' }, missingProducts: 0 })).toBe(true)
  })

  it('Mostrador con algún artículo desconocido: lo revisa la oficina', () => {
    expect(shouldAutoApprove({ refEvo: { codter: 'MOSTRADO' }, missingProducts: 1 })).toBe(false)
  })

  it('pedido de un cliente normal: aprobación manual', () => {
    expect(shouldAutoApprove({ refEvo: { codter: '22624' }, missingProducts: 0 })).toBe(false)
  })
})
