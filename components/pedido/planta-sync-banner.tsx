'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { acknowledgePlantaOperation, getPlantaOrderSyncInfo } from '@/app/actions/planta-status'
import type { PlantaOrderSyncInfo } from '@/lib/planta-status'
import { cn } from '@/lib/utils'

function hora(iso: string) {
  const d = new Date(iso)
  const today = d.toDateString() === new Date().toDateString()
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...(today ? {} : { day: '2-digit', month: '2-digit' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/**
 * Avisos de planta en el detalle del pedido: tablets con acciones de este
 * pedido guardadas sin enviar (lo que se ve aquí aún no las incluye) y
 * acciones que planta hizo pero no se pudieron registrar.
 */
export function PlantaSyncBanner({ orderId, refreshKey }: { orderId: string; refreshKey?: unknown }) {
  const [info, setInfo] = useState<PlantaOrderSyncInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setInfo(await getPlantaOrderSyncInfo(orderId)) } catch (e) { console.error('Error cargando estado de planta:', e) }
  }, [orderId])

  useEffect(() => { void load() }, [load, refreshKey])
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void load() }, 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  async function ack(id: string) {
    setBusy(id)
    try {
      await acknowledgePlantaOperation(id)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo marcar como revisada')
    } finally {
      setBusy(null)
    }
  }

  if (!info || (!info.rejected.length && !info.pendingDevices.length)) return null
  return (
    <div className="space-y-2">
      {info.pendingDevices.map((d, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
          <span className="flex-1 text-sm text-foreground">
            La tablet de <strong>{d.operatorName || 'planta'}</strong> tiene {d.pendingOps} acción(es) guardadas sin enviar
            {d.offline ? ` y está sin conexión desde las ${hora(d.lastSeenAt)}` : ''}. Lo que ves aquí puede no incluirlas todavía.
          </span>
        </div>
      ))}
      {info.rejected.map(r => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" />
          <span className="flex-1 text-sm text-foreground">
            Planta ({r.operatorName || 'operario'}, {hora(r.occurredAt)}): «{r.label}» <strong>no se registró</strong>. {r.message}
          </span>
          <button type="button" disabled={busy === r.id} onClick={() => void ack(r.id)} className={cn('whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50')}>
            Marcar revisado
          </button>
        </div>
      ))}
    </div>
  )
}
