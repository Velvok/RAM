import bcrypt from 'bcryptjs'
import type { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}

export function hashPin(pin: string) {
  return bcrypt.hash(pin, 10)
}

/**
 * Operario activo cuyo PIN coincide, o null. El login es solo por PIN, así que
 * los PIN tienen que ser únicos: esto se usa también para impedir duplicados.
 */
export async function findOperatorWithPin(supabase: SupabaseAdmin, pin: string) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, role, first_login, pin_hash')
    .eq('role', 'operator')
    .eq('is_active', true)

  if (error) throw error

  for (const user of users || []) {
    if (user.pin_hash && await bcrypt.compare(pin, user.pin_hash)) {
      const { pin_hash: _omit, ...rest } = user
      return rest
    }
  }
  return null
}
