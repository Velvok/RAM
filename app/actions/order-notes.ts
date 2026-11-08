'use server'

import { requireAdmin, requireStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface OrderNote {
  id: string
  order_id: string
  content: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
  read_at: string | null
  read_by_operator_name: string | null
}

export async function createOrderNote(orderId: string, content: string): Promise<OrderNote> {
  await requireAdmin()

  const supabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  let createdByName = 'Admin'
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()
    if (userData?.full_name) createdByName = userData.full_name
  }

  const { data, error } = await supabase
    .from('order_notes')
    .insert({
      order_id: orderId,
      content: content.trim(),
      created_by: user?.id || null,
      created_by_name: createdByName,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath(`/admin/pedidos/${orderId}`)
  revalidatePath(`/planta/pedidos`)

  return data
}

/**
 * Nota escrita desde planta (respuesta rápida o aviso al admin). Queda marcada
 * como leída por el propio operario para que en el admin no cuente como pendiente.
 */
export async function createPlantaNote(orderId: string, content: string): Promise<OrderNote> {
  const actor = await requireStaff()
  const text = String(content || '').trim().slice(0, 500)
  if (!text) throw new Error('La nota está vacía')
  const supabase = createAdminClient()
  let name = 'Planta'
  if (actor.kind === 'operator') {
    const { data } = await supabase.from('users').select('full_name').eq('id', actor.operatorId).maybeSingle()
    if (data?.full_name) name = data.full_name
  } else if (actor.kind === 'admin') {
    const { data } = await supabase.from('users').select('full_name').eq('id', actor.userId).maybeSingle()
    if (data?.full_name) name = data.full_name
  }
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('order_notes')
    .insert({ order_id: orderId, content: text, created_by: null, created_by_name: `${name} (planta)`, read_at: now, read_by_operator_name: name })
    .select()
    .single()
  if (error) throw error
  revalidatePath(`/admin/pedidos/${orderId}`)
  return data
}

export async function getOrderNotes(orderId: string): Promise<OrderNote[]> {
  await requireStaff()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('order_notes')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function markNoteAsRead(noteId: string, operatorName: string): Promise<void> {
  await requireStaff()

  const supabase = createAdminClient()

  const { data: note, error: fetchError } = await supabase
    .from('order_notes')
    .select('order_id, read_at')
    .eq('id', noteId)
    .single()

  if (fetchError) throw fetchError
  if (note.read_at) return // Ya leída, no hacer nada

  const { error } = await supabase
    .from('order_notes')
    .update({
      read_at: new Date().toISOString(),
      read_by_operator_name: operatorName,
    })
    .eq('id', noteId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${note.order_id}`)
  revalidatePath(`/planta/pedidos`)
}

export async function getUnreadNotesCountByOrders(orderIds: string[]): Promise<Record<string, number>> {
  await requireStaff()

  if (!orderIds.length) return {}
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('order_notes')
    .select('order_id')
    .in('order_id', orderIds)
    .is('read_at', null)

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    counts[row.order_id] = (counts[row.order_id] || 0) + 1
  }
  return counts
}

export async function deleteOrderNote(noteId: string, orderId: string): Promise<void> {
  await requireAdmin()

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('order_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${orderId}`)
}
