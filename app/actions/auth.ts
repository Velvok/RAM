'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminUserIdFor, getAdminUserId, getPlantaOperatorId } from '@/lib/auth/guards'
import { PLANTA_COOKIE, PLANTA_SESSION_MAX_AGE, createPlantaToken } from '@/lib/auth/planta-session'
import { findOperatorWithPin, isValidPin } from '@/lib/auth/pin'
import { PENDING_KEY, isActivatable, validatePassword } from '@/lib/auth/invitations'

// Límite de PIN fallidos por IP. Las tablets de planta comparten IP pública,
// así que el umbral deja margen para equivocarse sin bloquear la planta.
const PIN_MAX_FAILURES = 20
const PIN_WINDOW_MINUTES = 15

export async function loginWithEmail(formData: FormData) {
  // El login debe pasar por el cliente SSR (sincroniza cookies de sesión);
  // el cliente de service role no persiste sesión en el navegador.
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: signIn, error } = await supabase.auth.signInWithPassword(data)

  if (error || !signIn.user) {
    return { error: 'Email o contraseña incorrectos' }
  }

  // Solo pueden entrar al panel los usuarios admin/manager activos
  if (!(await adminUserIdFor(signIn.user))) {
    await supabase.auth.signOut()
    return { error: 'Este usuario no tiene acceso al panel de administración' }
  }

  // Verificar si es primer login (bypass de RLS con service role)
  const adminClient = createAdminClient()
  const { data: user } = await adminClient
    .from('users')
    .select('first_login')
    .eq('email', data.email)
    .single()

  revalidatePath('/', 'layout')

  if (user?.first_login) {
    redirect('/admin/first-login')
  }

  redirect('/admin')
}

/**
 * Primer acceso de un usuario del panel dado de alta por un admin: pone su
 * email y elige su contraseña. Solo para cuentas pendientes y en plazo; una
 * cuenta ya activada no se puede volver a activar por aquí.
 */
export async function activateAccount(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const emailLower = String(email || '').trim().toLowerCase()
    if (!emailLower) return { ok: false, error: 'Introduce tu email' }
    const invalid = validatePassword(password)
    if (invalid) return { ok: false, error: invalid }

    const supabase = createAdminClient()
    const key = `activacion:${await clientIp()}`
    const since = new Date(Date.now() - 15 * 60_000).toISOString()
    const { count } = await supabase.from('pin_login_attempts').select('id', { count: 'exact', head: true }).eq('ip', key).gte('created_at', since)
    if ((count || 0) >= 10) return { ok: false, error: 'Demasiados intentos. Espera 15 minutos.' }

    const notPending = async () => {
      await supabase.from('pin_login_attempts').insert({ ip: key })
      return { ok: false, error: 'No hay ninguna cuenta pendiente de activar con ese email. Si ya la activaste, entra con tu contraseña.' }
    }

    const { data: row } = await supabase
      .from('users')
      .select('id, role, is_active')
      .eq('email', emailLower)
      .maybeSingle()
    if (!row || !row.is_active || !['admin', 'manager'].includes(row.role)) return notPending()

    const { data: authData } = await supabase.auth.admin.getUserById(row.id)
    if (!authData?.user || !isActivatable(authData.user)) return notPending()

    const { error } = await supabase.auth.admin.updateUserById(row.id, {
      password,
      user_metadata: { ...authData.user.user_metadata, [PENDING_KEY]: false, activated_at: new Date().toISOString() },
    })
    if (error) {
      console.error('Error activando cuenta:', error)
      return { ok: false, error: 'No se pudo activar la cuenta' }
    }
    await supabase.from('users').update({ first_login: false, updated_at: new Date().toISOString() }).eq('id', row.id)
    return { ok: true }
  } catch (e) {
    console.error('Error activando cuenta:', e)
    return { ok: false, error: 'Error del servidor. Inténtalo más tarde.' }
  }
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida'
}

export async function loginWithPin(pin: string) {
  try {
    if (!isValidPin(pin)) {
      return { error: 'PIN incorrecto' }
    }

    const supabase = createAdminClient()
    const ip = await clientIp()
    const since = new Date(Date.now() - PIN_WINDOW_MINUTES * 60_000).toISOString()

    const { count } = await supabase
      .from('pin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since)

    if ((count || 0) >= PIN_MAX_FAILURES) {
      return { error: `Demasiados intentos fallidos. Espera ${PIN_WINDOW_MINUTES} minutos.` }
    }

    const user = await findOperatorWithPin(supabase, pin)

    if (!user) {
      await supabase.from('pin_login_attempts').insert({ ip })
      return { error: 'PIN incorrecto' }
    }

    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    const store = await cookies()
    store.set(PLANTA_COOKIE, createPlantaToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: PLANTA_SESSION_MAX_AGE,
    })

    return {
      success: true,
      firstLogin: user.first_login,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role
      }
    }
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'Error del servidor. Por favor, intenta más tarde.' }
  }
}

export async function logoutPlanta() {
  const store = await cookies()
  store.delete(PLANTA_COOKIE)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function changePassword(_email: string, newPassword: string) {
  // updateUser() opera sobre la sesión activa: necesita el cliente SSR.
  // El email que manda el cliente se ignora: se usa siempre el de la sesión.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Sesión no válida. Vuelve a iniciar sesión.' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    console.error('Error cambiando contraseña:', error)
    return { error: 'No se pudo cambiar la contraseña' }
  }

  // Marcar first_login como false (bypass de RLS con service role)
  const adminClient = createAdminClient()
  await adminClient
    .from('users')
    .update({ first_login: false })
    .eq('email', user.email.toLowerCase())

  return { success: true }
}

export async function changePin(userId: string, newPin: string) {
  // Solo el propio operario (sesión de planta) o un admin
  const operatorId = await getPlantaOperatorId()
  if (operatorId !== userId && !(await getAdminUserId())) {
    return { error: 'No autorizado. Vuelve a iniciar sesión.' }
  }

  if (!isValidPin(newPin)) {
    return { error: 'El PIN debe tener entre 4 y 6 dígitos' }
  }

  const supabase = createAdminClient()

  const other = await findOperatorWithPin(supabase, newPin)
  if (other && other.id !== userId) {
    return { error: 'Ese PIN ya lo usa otro operario. Elige otro.' }
  }

  const { hashPin } = await import('@/lib/auth/pin')
  const { error } = await supabase
    .from('users')
    .update({
      pin_hash: await hashPin(newPin),
      first_login: false
    })
    .eq('id', userId)

  if (error) {
    console.error('Error cambiando PIN:', error)
    return { error: 'No se pudo cambiar el PIN' }
  }

  return { success: true }
}
