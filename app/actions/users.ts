'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { findOperatorWithPin, hashPin, isValidPin } from '@/lib/auth/pin'
import { inviteStaffUser } from '@/lib/auth/invitations'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Nunca pin_hash: estas filas llegan al navegador
const USER_COLUMNS = 'id, email, full_name, role, is_active, first_login, last_login_at, created_at, updated_at'

export async function getUsers() {
  await requireAdmin()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createUser(userData: {
  email?: string
  full_name: string
  role: 'admin' | 'manager' | 'operator'
  pin?: string
  password?: string
}) {
  await requireAdmin()

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
  await requireAdmin()

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

export async function deleteUser(userId: string) {
  await requireAdmin()

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) throw error

  revalidatePath('/admin/configuracion')
}
