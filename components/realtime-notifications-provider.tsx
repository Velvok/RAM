'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowDownCircle, ArrowUpCircle, Package, ShoppingCart, AlertTriangle } from 'lucide-react'

/**
 * Provider global de notificaciones en tiempo real.
 * Escucha eventos de RAM (entrada) y de Velvok (salida) en todas las páginas.
 * Muestra toasts y auto-refresca la página activa cuando llega algo relevante.
 */
export function RealtimeNotificationsProvider() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    // Helper para iconos según tipo de evento
    const getEventLabel = (tipo: string): { label: string; icon: any } => {
      const t = (tipo || '').toLowerCase()
      if (t.includes('stock')) return { label: 'Stock actualizado', icon: <Package className="w-5 h-5 text-blue-500" /> }
      if (t.includes('pedido')) return { label: 'Pedido recibido', icon: <ShoppingCart className="w-5 h-5 text-green-500" /> }
      return { label: tipo, icon: <ArrowDownCircle className="w-5 h-5 text-blue-500" /> }
    }

    // Determina si debemos refrescar la página actual
    const shouldRefreshCurrentPage = (eventType: string): boolean => {
      const t = (eventType || '').toLowerCase()
      if (pathname?.startsWith('/admin/stock') && t.includes('stock')) return true
      if (pathname?.startsWith('/admin/pedidos') && t.includes('pedido')) return true
      if (pathname === '/admin') return true
      if (pathname?.startsWith('/admin/logs')) return true
      return false
    }

    // ============================================
    // ENTRADA: Eventos desde RAM (evo_events)
    // ============================================
    const inboundChannel = supabase
      .channel('global-inbound-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evo_events' },
        (payload) => {
          const event = payload.new as any
          const { label, icon } = getEventLabel(event.tipo_evento)

          if (event.success) {
            toast.success(`📥 ${label}`, {
              description: `Recibido de RAM • ${new Date(event.created_at).toLocaleTimeString('es-AR')}`,
              icon,
              duration: 5000,
              action: {
                label: 'Ver logs',
                onClick: () => router.push('/admin/logs'),
              },
            })
          } else {
            toast.error(`⚠️ Error procesando: ${label}`, {
              description: event.errors?.join('; ') || 'Error desconocido',
              icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
              duration: 10000,
              action: {
                label: 'Ver logs',
                onClick: () => router.push('/admin/logs'),
              },
            })
          }

          // Auto-refrescar la página activa si corresponde
          if (shouldRefreshCurrentPage(event.tipo_evento)) {
            setTimeout(() => router.refresh(), 1500)
          }
        }
      )
      .subscribe()

    // ============================================
    // SALIDA: Eventos hacia RAM (outbound_events)
    // ============================================
    const outboundChannel = supabase
      .channel('global-outbound-events')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'outbound_events' },
        (payload) => {
          const event = payload.new as any
          const oldEvent = payload.old as any

          // Solo notificar cuando cambia el estado
          if (event.status === oldEvent.status) return

          if (event.status === 'success') {
            toast.success(`📤 Enviado a RAM: ${event.event_type}`, {
              description: `Confirmado correctamente`,
              icon: <ArrowUpCircle className="w-5 h-5 text-purple-500" />,
              duration: 4000,
            })
          } else if (event.status === 'failed') {
            toast.error(`❌ Falló envío a RAM: ${event.event_type}`, {
              description: event.error_message || 'Error en el envío',
              icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
              duration: 10000,
              action: {
                label: 'Reintentar',
                onClick: () => router.push('/admin/logs'),
              },
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(inboundChannel)
      supabase.removeChannel(outboundChannel)
    }
  }, [router, pathname])

  return null
}
