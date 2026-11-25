import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, OFFLINE_ERROR, UserError, isUserError, userMessage } from '../user-error'

describe('userMessage', () => {
  it('enseña el mensaje de un UserError', () => {
    expect(userMessage(new UserError('No hay stock suficiente'))).toBe('No hay stock suficiente')
  })

  it('lo recupera del digest, que es lo único que llega del servidor en producción', () => {
    const llegado = { message: 'An error occurred in the Server Components render. The specific message is omitted in production builds', digest: new UserError('El pedido ya está entregado').digest }
    expect(userMessage(llegado)).toBe('El pedido ya está entregado')
    expect(isUserError(llegado)).toBe(true)
  })

  it('nunca enseña un error técnico: usa el aviso genérico o el que se le pase', () => {
    const tecnicos = [
      new Error('duplicate key value violates unique constraint "cut_orders_pkey"'),
      { message: 'An error occurred in the Server Components render.', digest: '948291715' },
      new Error('HTTP 400: Faltan datos en ref_evo: codtipmov, nromov, a_b_c o codter'),
      new TypeError("Cannot read properties of undefined (reading 'id')"),
      'texto suelto', null, undefined, 42,
    ]
    for (const e of tecnicos) {
      expect(userMessage(e)).toBe(GENERIC_ERROR)
      expect(userMessage(e, 'No se pudo aprobar')).toBe('No se pudo aprobar')
      expect(isUserError(e)).toBe(false)
    }
  })

  it('avisa de que no hay conexión cuando falla la red', () => {
    expect(userMessage(new TypeError('Failed to fetch'))).toBe(OFFLINE_ERROR)
    expect(userMessage(new TypeError('Load failed'), 'No se pudo guardar')).toBe(OFFLINE_ERROR)
  })

  it('un UserError vacío cae en el aviso genérico', () => {
    expect(userMessage(new UserError(''))).toBe(GENERIC_ERROR)
  })
})
