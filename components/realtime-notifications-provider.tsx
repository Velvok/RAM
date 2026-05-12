'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getRecentEventsForNotifications } from '@/app/actions/integration-logs'
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
  const seenEventIds = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  useEffect(() => {
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
    const handleInboundEvent = (event: any) => {
      const { label, icon } = getEventLabel(event.tipo_evento)

      // Solo mostrar notificación si el evento tiene resultado (success no es null)
      if (event.success === null) return

      // Deduplicar por id+success (un evento puede entrar como INSERT y luego UPDATE)
      const dedupKey = `${event.id}_${event.success}`
      if (seenEventIds.current.has(dedupKey)) return
      seenEventIds.current.add(dedupKey)

      if (event.success) {
        // Agregar información de items procesados si es stock_actualizado
        let description = `Recibido de RAM • ${new Date(event.created_at).toLocaleTimeString('es-AR')}`
        if (event.tipo_evento === 'stock_actualizado' && event.payload?.items) {
          description = `${event.payload.items.length} productos actualizados • ${new Date(event.created_at).toLocaleTimeString('es-AR')}`
        }

        console.log(`🔔 Showing SUCCESS toast for ${event.tipo_evento}`)
        toast.success(`📥 ${label}`, {
          description,
          icon,
          duration: 8000,
          className: 'text-base',
          action: {
            label: 'Ver logs',
            onClick: () => router.push('/admin/logs'),
          },
        })
      } else {
        console.log(`🔔 Showing ERROR toast for ${event.tipo_evento}`)
        toast.error(`⚠️ Error procesando: ${label}`, {
          description: event.errors?.join('; ') || 'Error desconocido',
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          duration: 15000,
          className: 'text-base',
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

    // Handler para eventos de salida (outbound)
    const handleOutboundEvent = (event: any) => {
      const dedupKey = `out_${event.id}_${event.status}`
      if (seenEventIds.current.has(dedupKey)) return
      seenEventIds.current.add(dedupKey)

      if (event.status === 'success') {
        console.log(`🔔 Showing OUTBOUND SUCCESS toast for ${event.event_type}`)
        toast.success(`📤 Enviado a RAM: ${event.event_type}`, {
          description: `Confirmado correctamente`,
          icon: <ArrowUpCircle className="w-5 h-5 text-purple-500" />,
          duration: 5000,
          className: 'text-base',
        })
      } else if (event.status === 'failed') {
        console.log(`🔔 Showing OUTBOUND ERROR toast for ${event.event_type}`)
        toast.error(`❌ Falló envío a RAM: ${event.event_type}`, {
          description: event.error_message || 'Error en el envío',
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          duration: 12000,
          className: 'text-base',
          action: {
            label: 'Reintentar',
            onClick: () => router.push('/admin/logs'),
          },
        })
      }
    }

    // ============================================
    // Polling vía server action (bypassa RLS)
    // ============================================
    const pollEvents = async () => {
      try {
        const { inbound, outbound } = await getRecentEventsForNotifications()

        if (!initializedRef.current) {
          // Primera vez: marcar todos los eventos existentes como vistos sin notificar
          for (const event of inbound) {
            seenEventIds.current.add(`${event.id}_${event.success}`)
          }
          for (const event of outbound) {
            seenEventIds.current.add(`out_${event.id}_${event.status}`)
          }
          initializedRef.current = true
          console.log(`[Polling] Initialized with ${inbound.length} inbound + ${outbound.length} outbound events`)
          return
        }

        // Procesar nuevos eventos inbound
        const newInbound = inbound.filter((event: any) => {
          const dedupKey = `${event.id}_${event.success}`
          return !seenEventIds.current.has(dedupKey)
        })
        if (newInbound.length > 0) {
          console.log(`[Polling] Found ${newInbound.length} new inbound events`)
          for (const event of newInbound) {
            handleInboundEvent(event)
          }
        }

        // Procesar nuevos eventos outbound
        const newOutbound = outbound.filter((event: any) => {
          const dedupKey = `out_${event.id}_${event.status}`
          return !seenEventIds.current.has(dedupKey)
        })
        if (newOutbound.length > 0) {
          console.log(`[Polling] Found ${newOutbound.length} new outbound events`)
          for (const event of newOutbound) {
            handleOutboundEvent(event)
          }
        }
      } catch (e) {
        console.warn('[Polling] Error:', e)
      }
    }

    // Primer poll inmediato (inicialización)
    pollEvents()
    // Polling cada 5s
    const pollInterval = setInterval(pollEvents, 5000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [router, pathname])

  return null
}
