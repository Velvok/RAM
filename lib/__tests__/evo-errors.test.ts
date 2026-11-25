import { describe, expect, it } from 'vitest'
import { evoEventLabel, explainEvoError } from '../evo-errors'

describe('explainEvoError', () => {
  const casos: Array<[string | null, number | null, RegExp]> = [
    ['Timeout después de 30000ms', 0, /tardó demasiado/],
    ['HTTP 400: Faltan datos en ref_evo: codtipmov, nromov, a_b_c o codter', 400, /no tiene los datos de EVO/],
    ['HTTP 401: Unauthorized', 401, /credenciales/],
    ['HTTP 404: Not Found', null, /no reconoce la dirección/],
    ['HTTP 422: Error desconocido', 422, /no aceptó los datos/],
    ['HTTP 503: Service Unavailable', 503, /error al procesarlo/],
    ['fetch failed', 0, /No se pudo conectar/],
    ['Max attempts exceeded', 0, /agotaron los intentos/],
    [null, null, /no confirmó/],
  ]
  it.each(casos)('%s → explicación en llano', (msg, http, esperado) => {
    const texto = explainEvoError(msg, http)
    expect(texto).toMatch(esperado)
    // Nunca se cuela lo técnico
    expect(texto).not.toMatch(/HTTP|\d{3}|ref_evo:|codtipmov|Unauthorized|ms\b/)
  })
})

describe('evoEventLabel', () => {
  it('nombra los avisos conocidos y tiene un genérico', () => {
    expect(evoEventLabel('corte_realizado')).toBe('un corte')
    expect(evoEventLabel('chapa_preparada')).toBe('una preparación')
    expect(evoEventLabel('algo_nuevo')).toBe('un movimiento')
    expect(evoEventLabel(null)).toBe('un movimiento')
  })
})
