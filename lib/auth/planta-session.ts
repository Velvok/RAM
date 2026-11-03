import { createHmac, timingSafeEqual } from 'node:crypto'

// Sesión de operario de planta: cookie httpOnly firmada con HMAC. Sustituye a
// confiar en el JSON de localStorage, que cualquiera puede falsificar.
// Sin dependencias de next/* para poder usarse desde proxy.ts y desde acciones.

export const PLANTA_COOKIE = 'planta_session'
export const PLANTA_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 días (tablets fijas en planta)

function signingKey(): Buffer {
  const explicit = process.env.PLANTA_SESSION_SECRET
  if (explicit) return Buffer.from(explicit)
  // Sin secreto propio se deriva de la service role key (solo servidor). Al
  // rotarla se invalidan las sesiones y los operarios vuelven a meter el PIN.
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para firmar la sesión de planta')
  return createHmac('sha256', base).update('planta-session-v1').digest()
}

function sign(data: string): string {
  return createHmac('sha256', signingKey()).update(data).digest('base64url')
}

export function createPlantaToken(operatorId: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: operatorId, exp: now + PLANTA_SESSION_MAX_AGE * 1000 })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Devuelve el id del operario si el token es válido y no ha caducado. */
export function verifyPlantaToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof sub !== 'string' || typeof exp !== 'number' || exp < now) return null
    return sub
  } catch {
    return null
  }
}

/** Comparación de secretos en tiempo constante (cabeceras Bearer, etc.). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
