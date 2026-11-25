import { describe, expect, it } from 'vitest'
import { evoEventLabel, explainEvoError, isUnconfirmedOutcome } from '../evo-errors'

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

describe('isUnconfirmedOutcome', () => {
  it('espera agotada, corte de red o error interno de EVO: no sabemos si lo aplicó', () => {
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: 0 })).toBe(true)
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: null })).toBe(true)
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: 502 })).toBe(true)
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: 200, response_body: {} })).toBe(true)
  })

  it('un rechazo claro de EVO sí es un fallo', () => {
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: 400 })).toBe(false)
    expect(isUnconfirmedOutcome({ status: 'failed', http_status: 200, response_body: { evo_confirmation: { estado: 'error' } } })).toBe(false)
  })

  it('solo aplica a los marcados como fallidos', () => {
    expect(isUnconfirmedOutcome({ status: 'processing', http_status: 0 })).toBe(false)
    expect(isUnconfirmedOutcome({ status: 'success', http_status: 200 })).toBe(false)
    expect(isUnconfirmedOutcome({ status: 'cancelled' })).toBe(false)
  })
})
