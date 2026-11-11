import { AsyncLocalStorage } from 'node:async_hooks'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PLANTA_COOKIE, verifyPlantaToken } from './planta-session'

// Guardas de acceso para las server actions. Todo export de un fichero
// 'use server' es un endpoint público: sin guarda, cualquiera que conozca el id
// de la acción (está en el bundle del navegador) puede ejecutarla.
//
// - requireAdmin: sesión de Supabase de un usuario admin/manager activo.
// - requireStaff: lo anterior o un operario de planta con sesión firmada.
// - runAsSystem: para código del servidor sin usuario (webhooks de EVO, cron).

export type Actor =
  | { kind: 'system' }
  | { kind: 'admin'; userId: string }
  | { kind: 'operator'; operatorId: string }

const systemContext = new AsyncLocalStorage<true>()

/** Ejecuta `fn` como sistema: las guardas dejan pasar las acciones que llame. */
export function runAsSystem<T>(fn: () => T): T {
  return systemContext.run(true, fn)
}

const ADMIN_ROLES = ['admin', 'manager']
const UNAUTHORIZED = 'No autorizado. Vuelve a iniciar sesión.'

/** Id (tabla users) del admin con sesión, o null. Memoizado por petición. */
export const getAdminUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ? await adminUserIdFor(data.user) : null
  } catch {
    return null
  }
})

/** Id en la tabla users si la cuenta de Auth es de un admin/manager activo. */
export async function adminUserIdFor(authUser: { id: string; email?: string | null }): Promise<string | null> {
  // Algunas cuentas enlazan con users por id y otras solo por email
  const admin = createAdminClient()
  const { data: byId } = await admin
    .from('users')
    .select('id, role, is_active')
    .eq('id', authUser.id)
    .maybeSingle()

  let row = byId
  if (!row && authUser.email) {
    const { data: byEmail } = await admin
      .from('users')
      .select('id, role, is_active')
      .eq('email', authUser.email.toLowerCase())
      .maybeSingle()
    row = byEmail
  }

  return row && row.is_active && ADMIN_ROLES.includes(row.role) ? row.id : null
}

/** Id del operario con sesión de planta válida, o null. */
export async function getPlantaOperatorId(): Promise<string | null> {
  try {
    const store = await cookies()
    return verifyPlantaToken(store.get(PLANTA_COOKIE)?.value)
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<Actor> {
  if (systemContext.getStore()) return { kind: 'system' }
  const userId = await getAdminUserId()
  if (userId) return { kind: 'admin', userId }
  throw new Error(UNAUTHORIZED)
}

/**
 * Solo rol 'admin' (no 'manager'): gestión de usuarios e invitaciones. Un
 * manager no puede crear, editar, renovar ni dar de baja cuentas; si pudiera,
 * se invitaría a sí mismo como admin y activaría esa cuenta.
 */
export async function requireAdminRole(): Promise<Actor> {
  const actor = await requireAdmin()
  if (actor.kind !== 'admin') return actor
  const { data } = await createAdminClient()
    .from('users')
    .select('role')
    .eq('id', actor.userId)
    .maybeSingle()
  if (data?.role !== 'admin') throw new Error('Solo un administrador puede gestionar usuarios.')
  return actor
}

/**
 * Quién puede eliminar (cancelar) pedidos: correos de ORDER_DELETE_EMAILS,
 * separados por comas. Sin la variable, nadie. Mientras EVO no avise de las
 * cancelaciones, lo hace a mano quien las hace en EVO.
 */
export const canDeleteOrders = cache(async (): Promise<boolean> => {
  const allowed = (process.env.ORDER_DELETE_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return false
  const userId = await getAdminUserId()
  if (!userId) return false
  const { data } = await createAdminClient().from('users').select('email').eq('id', userId).maybeSingle()
  return !!data?.email && allowed.includes(data.email.toLowerCase())
})

export async function requireOrderDeleter(): Promise<Actor> {
  const actor = await requireAdmin()
  if (actor.kind === 'admin' && !(await canDeleteOrders())) {
    throw new Error('No tienes permiso para eliminar pedidos.')
  }
  return actor
}

export async function requireStaff(): Promise<Actor> {
  if (systemContext.getStore()) return { kind: 'system' }
  // Primero la cookie de planta: se valida en local, sin ir a la red
  const operatorId = await getPlantaOperatorId()
  if (operatorId) return { kind: 'operator', operatorId }
  const userId = await getAdminUserId()
  if (userId) return { kind: 'admin', userId }
  throw new Error(UNAUTHORIZED)
}
