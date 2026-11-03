import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPlantaToken,
  verifyPlantaToken,
  safeEqual,
  PLANTA_SESSION_MAX_AGE,
} from '../planta-session'
import { isValidPin } from '../pin'

describe('sesión de planta', () => {
  beforeEach(() => {
    delete process.env.PLANTA_SESSION_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba'
  })

  it('verifica un token recién creado y devuelve el operario', () => {
    const token = createPlantaToken('op-1')
    expect(verifyPlantaToken(token)).toBe('op-1')
  })

  it('rechaza un token caducado', () => {
    const now = Date.now()
    const token = createPlantaToken('op-1', now)
    expect(verifyPlantaToken(token, now + PLANTA_SESSION_MAX_AGE * 1000 + 1)).toBeNull()
  })

  it('rechaza un token con el operario cambiado (firma no coincide)', () => {
    const [, signature] = createPlantaToken('op-1').split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: Date.now() + 1e9 })).toString('base64url')
    expect(verifyPlantaToken(`${forged}.${signature}`)).toBeNull()
  })

  it('rechaza un token firmado con otra clave', () => {
    const token = createPlantaToken('op-1')
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'otra-clave'
    expect(verifyPlantaToken(token)).toBeNull()
  })

  it('usa PLANTA_SESSION_SECRET si está definido', () => {
    process.env.PLANTA_SESSION_SECRET = 'secreto-explicito'
    const token = createPlantaToken('op-1')
    delete process.env.PLANTA_SESSION_SECRET
    expect(verifyPlantaToken(token)).toBeNull()
  })

  it('rechaza entradas vacías o mal formadas', () => {
    for (const bad of [undefined, null, '', 'abc', 'a.b.c', '.']) {
      expect(verifyPlantaToken(bad as any)).toBeNull()
    }
  })
})

describe('safeEqual', () => {
  it('compara secretos', () => {
    expect(safeEqual('Bearer abc', 'Bearer abc')).toBe(true)
    expect(safeEqual('Bearer abc', 'Bearer abd')).toBe(false)
    expect(safeEqual('Bearer abc', 'Bearer abcd')).toBe(false)
  })

  it('nunca da por bueno un secreto ausente', () => {
    expect(safeEqual(undefined, undefined)).toBe(false)
    expect(safeEqual(null, '')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })
})

describe('isValidPin', () => {
  it('acepta de 4 a 6 dígitos', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
  })

  it('rechaza el resto', () => {
    for (const bad of ['123', '1234567', '12a4', ' 1234', '', 1234, null]) {
      expect(isValidPin(bad)).toBe(false)
    }
  })
})
