import { randomBytes } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

// Alta de usuarios del panel sin contraseña (mismo modelo que Asentia-Demo):
// el admin da de alta el email y la cuenta queda pendiente de activar. La
// persona entra en /login → "Primer acceso", pone su email y elige su
// contraseña. Solo se puede activar una cuenta pendiente y dentro del plazo.

export const PENDING_KEY = 'pending_activation'
export const INVITED_AT_KEY = 'invited_at'
export const INVITE_VALID_DAYS = 14
export const MIN_PASSWORD = 8

export function validatePassword(pwd: unknown): string | null {
  if (typeof pwd !== 'string' || pwd.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
  if (pwd.length > 72) return 'La contraseña es demasiado larga'
  return null
}

/** Crea la cuenta de Auth (con una contraseña aleatoria que nadie conoce) y la fila en users. */
export async function inviteStaffUser(
  supabase: SupabaseAdmin,
  input: { email: string; fullName: string; role: 'admin' | 'manager' },
) {
  const email = input.email.trim().toLowerCase()
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { [PENDING_KEY]: true, [INVITED_AT_KEY]: new Date().toISOString(), full_name: input.fullName },
  })
  if (authError) throw authError

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      full_name: input.fullName,
      role: input.role,
      is_active: true,
      first_login: true, // = pendiente de activar (se muestra así en Configuración)
    })
    .select('id, email, full_name, role, is_active, first_login, created_at')
    .single()

  if (error) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw error
  }
  return data
}

/** ¿La cuenta de Auth está pendiente de activar y dentro de plazo? */
export function isActivatable(user: { user_metadata?: Record<string, any> } | null | undefined): boolean {
  const meta = user?.user_metadata || {}
  if (meta[PENDING_KEY] !== true) return false
  const invitedAt = Date.parse(meta[INVITED_AT_KEY] || '')
  if (!Number.isFinite(invitedAt)) return false
  return Date.now() - invitedAt <= INVITE_VALID_DAYS * 24 * 3600 * 1000
}
