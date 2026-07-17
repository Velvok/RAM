'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Send, CheckCheck, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createOrderNote, getOrderNotes, deleteOrderNote, OrderNote } from '@/app/actions/order-notes'

interface OrderNotesAdminProps {
  orderId: string
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  return `hace ${diffDays}d`
}

export default function OrderNotesAdmin({ orderId }: OrderNotesAdminProps) {
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  async function loadNotes() {
    try {
      const data = await getOrderNotes(orderId)
      setNotes(data)
    } catch (e) {
      console.error('Error loading notes:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()

    const supabase = createClient()
    const channel = supabase
      .channel(`order_notes_admin_${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_notes', filter: `order_id=eq.${orderId}` },
        () => loadNotes()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  async function handleSend() {
    if (!content.trim()) return
    setSending(true)
    try {
      await createOrderNote(orderId, content)
      setContent('')
      await loadNotes()
    } catch (e) {
      console.error('Error sending note:', e)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('¿Eliminar esta nota?')) return
    try {
      await deleteOrderNote(noteId, orderId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (e) {
      console.error('Error deleting note:', e)
    }
  }

  const unreadCount = notes.filter(n => !n.read_at).length

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setCollapsed(v => !v)}>
        <MessageSquare className="w-5 h-5 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900">Notas para Operario</h3>
        {unreadCount > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {unreadCount} sin leer
          </span>
        )}
        <span className="ml-auto text-slate-400">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </div>

      {/* Input nueva nota - siempre visible */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Escribe una nota para el operario..."
          rows={2}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="self-end px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-1"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Lista de notas - colapsable */}
      {!collapsed && (
        loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Cargando...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No hay notas para este pedido</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notes.map(note => (
              <div
                key={note.id}
                className={`rounded-lg p-3 border ${
                  note.read_at
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-800 flex-1">{note.content}</p>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    {note.created_by_name} · {formatTimeAgo(note.created_at)}
                  </span>
                  {note.read_at ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCheck className="w-3.5 h-3.5" />
                      Leída por {note.read_by_operator_name} · {formatTimeAgo(note.read_at)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Pendiente de lectura
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
