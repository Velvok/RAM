'use server'

import { requireAdminRole } from '@/lib/auth/guards'
import { findOperatorWithPin, hashPin, isValidPin } from '@/lib/auth/pin'
import { inviteStaffUser, PENDING_KEY, INVITED_AT_KEY, INVITE_VALID_DAYS } from '@/lib/auth/invitations'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Nunca pin_hash: estas filas llegan al navegador
const USER_COLUMNS = 'id, email, full_name, role, is_active, first_login, last_login_at, created_at, updated_at'

export async function getUsers() {
  await requireAdminRole()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error

  // Admin y manager entran por Supabase Auth: de ahí sale su último acceso y,
  // si no han activado la cuenta, cuándo caduca la invitación.
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authById = new Map((authList?.users || []).map(u => [u.id, u]))
  const authByEmail = new Map((authList?.users || []).filter(u => u.email).map(u => [u.email!.toLowerCase(), u]))
  return (data || []).map(u => {
    const au = u.role === 'operator' ? undefined : authById.get(u.id) || (u.email ? authByEmail.get(u.email.toLowerCase()) : undefined)
    const meta = (au?.user_metadata || {}) as Record<string, any>
    const pending = meta[PENDING_KEY] === true
    const invitedAt = pending ? Date.parse(meta[INVITED_AT_KEY] || '') : NaN
    return {
      ...u,
      last_access_at: (u.role === 'operator' ? u.last_login_at : au?.last_sign_in_at) || null,
      invite_pending: pending,
      invite_expires_at: Number.isFinite(invitedAt) ? new Date(invitedAt + INVITE_VALID_DAYS * 24 * 3600 * 1000).toISOString() : null,
    }
  })
}

/** Vuelve a dar 14 días a una invitación sin activar. */
export async function renewInvitation(userId: string) {
  await requireAdminRole()
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return { error: 'No se encontró la cuenta' }
  const meta = (data.user.user_metadata || {}) as Record<string, any>
  if (meta[PENDING_KEY] !== true) return { error: 'Esta cuenta ya está activada' }
  const { error: upErr } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { ...meta, [INVITED_AT_KEY]: new Date().toISOString() },
  })
  if (upErr) throw upErr
  revalidatePath('/admin/configuracion')
  return { success: true }
}

export async function createUser(userData: {
  email?: string
  full_name: string
  role: 'admin' | 'manager' | 'operator'
  pin?: string
  password?: string
}) {
  await requireAdminRole()

  const supabase = createAdminClient()

  if (userData.role === 'operator') {
    if (!isValidPin(userData.pin)) {
      return { error: 'El PIN debe tener entre 4 y 6 dígitos' }
    }
    if (await findOperatorWithPin(supabase, userData.pin)) {
      return { error: 'Ese PIN ya lo usa otro operario. Elige otro.' }
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: userData.full_name,
        role: userData.role,
        pin_hash: await hashPin(userData.pin),
        is_active: true,
        first_login: true,
      })
      .select(USER_COLUMNS)
      .single()

    if (error) throw error
    return data
  } else {
    if (!userData.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userData.email.trim())) {
      return { error: 'Introduce un email válido' }
    }
    const { data: existing } = await supabase.from('users').select('id').eq('email', userData.email.trim().toLowerCase()).maybeSingle()
    if (existing) return { error: 'Ya existe un usuario con ese email' }
    // Sin contraseña: la persona la elige en /login → "Primer acceso"
    return await inviteStaffUser(supabase, { email: userData.email, fullName: userData.full_name, role: userData.role })
  }
}

export async function updateUser(userId: string, userData: {
  full_name?: string
  role?: 'admin' | 'manager' | 'operator'
  is_active?: boolean
  newPin?: string
}) {
  await requireAdminRole()

  const supabase = createAdminClient()

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (userData.full_name) updateData.full_name = userData.full_name
  if (userData.role) updateData.role = userData.role
  if (userData.is_active !== undefined) updateData.is_active = userData.is_active
  if (userData.newPin) {
    if (!isValidPin(userData.newPin)) {
      return { error: 'El PIN debe tener entre 4 y 6 dígitos' }
    }
    const other = await findOperatorWithPin(supabase, userData.newPin)
    if (other && other.id !== userId) {
      return { error: 'Ese PIN ya lo usa otro operario. Elige otro.' }
    }
    updateData.pin_hash = await hashPin(userData.newPin)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select(USER_COLUMNS)
    .single()

  if (error) throw error
  return data
}

// No se borra a nadie: dar de baja conserva su historial de cortes y pedidos.
export async function setUserActive(userId: string, active: boolean) {
  const actor = await requireAdminRole()
  if (!active && actor.kind === 'admin' && actor.userId === userId) {
    return { error: 'No puedes darte de baja a ti mismo' }
  }
  const supabase = createAdminClient()
  // requireAdmin y el login por PIN ya rechazan a los usuarios inactivos
  const { error } = await supabase
    .from('users')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
  revalidatePath('/admin/configuracion')
  return { success: true }
}
