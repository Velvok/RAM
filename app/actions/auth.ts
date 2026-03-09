'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function loginWithPin(pin: string) {
  try {
    const supabase = await createClient()

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'operator')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching users:', error)
      return { error: 'Error de conexión. Verifica tu conexión a internet.' }
    }

    if (!users || users.length === 0) {
      return { error: 'No hay operarios registrados en el sistema' }
    }

    for (const user of users) {
      if (user.pin_hash && await bcrypt.compare(pin, user.pin_hash)) {
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)

        return { 
          success: true, 
          user: {
            id: user.id,
            full_name: user.full_name,
            role: user.role
          }
        }
      }
    }

    return { error: 'PIN incorrecto' }
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Error del servidor. Por favor, intenta más tarde.' }
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function createOperatorWithPin(fullName: string, pin: string) {
  const supabase = await createClient()

  const pinHash = await bcrypt.hash(pin, 10)

  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name: fullName,
      role: 'operator',
      pin_hash: pinHash,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, user: data }
}
