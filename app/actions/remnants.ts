'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

export async function getRemnants(status?: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('remnants')
    .select(`
      *,
      product:products(*),
      cut_order:cut_orders(
        *,
        order:orders(*, client:clients(*))
      )
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching remnants:', error)
    throw error
  }

  return data
}

export async function getRemnantById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('remnants')
    .select(`
      *,
      product:products(*),
      cut_order:cut_orders(
        *,
        order:orders(*, client:clients(*)),
        product:products!cut_orders_product_id_fkey(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching remnant:', error)
    throw error
  }

  return data
}

export async function markAsScrap(remnantId: string, notes?: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('remnants')
    .update({
      status: 'descartado',
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', remnantId)

  if (error) {
    console.error('Error marking remnant as scrap:', error)
    throw error
  }

  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/admin/recortes', 'layout')
  revalidatePath(`/admin/recortes/${remnantId}`, 'page')
  return { success: true }
}

export async function useRemnant(remnantId: string, usedInOrderId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('remnants')
    .update({
      status: 'consumido',
      updated_at: new Date().toISOString(),
    })
    .eq('id', remnantId)

  if (error) {
    console.error('Error marking remnant as used:', error)
    throw error
  }

  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/admin/recortes', 'layout')
  revalidatePath(`/admin/recortes/${remnantId}`, 'page')
  return { success: true }
}

export async function reserveRemnant(remnantId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('remnants')
    .update({
      status: 'reservado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', remnantId)

  if (error) {
    console.error('Error reserving remnant:', error)
    throw error
  }

  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/admin/recortes', 'layout')
  revalidatePath(`/admin/recortes/${remnantId}`, 'page')
  return { success: true }
}

export async function releaseRemnant(remnantId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('remnants')
    .update({
      status: 'disponible',
      updated_at: new Date().toISOString(),
    })
    .eq('id', remnantId)

  if (error) {
    console.error('Error releasing remnant:', error)
    throw error
  }

  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/admin/recortes', 'layout')
  revalidatePath(`/admin/recortes/${remnantId}`, 'page')
  return { success: true }
}

export async function getRemnantStats() {
  const supabase = createAdminClient()

  const { data: remnants, error } = await supabase
    .from('remnants')
    .select('status, quantity')

  if (error) {
    console.error('Error fetching remnant stats:', error)
    // Retornar stats vacías en lugar de lanzar error
    return {
      total: 0,
      disponible: 0,
      reservado: 0,
      consumido: 0,
      descartado: 0,
      totalQuantity: 0,
      avgUtilization: 0,
    }
  }

  const stats = {
    total: remnants?.length || 0,
    disponible: remnants?.filter((r: any) => r.status === 'disponible').length || 0,
    reservado: remnants?.filter((r: any) => r.status === 'reservado').length || 0,
    consumido: remnants?.filter((r: any) => r.status === 'consumido').length || 0,
    descartado: remnants?.filter((r: any) => r.status === 'descartado').length || 0,
    totalQuantity: remnants?.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0) || 0,
    avgUtilization: 0, // No existe utilization_score en la tabla
  }

  return stats
}
