'use server'

import { createAdminClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function getUsers() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
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
  const supabase = createAdminClient()

  if (userData.role === 'operator') {
    const pinHash = await bcrypt.hash(userData.pin || '111111', 10)
    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: userData.full_name,
        role: userData.role,
        pin_hash: pinHash,
        is_active: true,
        first_login: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password || 'admin1',
      email_confirm: true,
    })

    if (authError) throw authError

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        is_active: true,
        first_login: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export async function updateUser(userId: string, userData: {
  full_name?: string
  role?: 'admin' | 'manager' | 'operator'
  is_active?: boolean
  newPin?: string
}) {
  const supabase = createAdminClient()

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (userData.full_name) updateData.full_name = userData.full_name
  if (userData.role) updateData.role = userData.role
  if (userData.is_active !== undefined) updateData.is_active = userData.is_active
  if (userData.newPin) {
    updateData.pin_hash = await bcrypt.hash(userData.newPin, 10)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) throw error

  revalidatePath('/admin/configuracion')
}
