'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CloudOff, RefreshCw, Wifi, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dismissNotice, flush, getSyncState, subscribeSync, type SyncState } from '@/lib/planta-offline/store'
import { P } from './planta-ui'

export function useSyncState(): SyncState {
  const [s, setS] = useState<SyncState>(getSyncState())
  useEffect(() => subscribeSync(setS), [])
  return s
}

function hora(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = d.toDateString() === new Date().toDateString()
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...(today ? {} : { day: '2-digit', month: '2-digit' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Píldora de conexión para la cabecera de planta, con el panel de avisos. */
export function PlantaSyncBadge() {
  const s = useSyncState()
  const [open, setOpen] = useState(false)
  const problems = s.notices.filter(x => x.kind === 'rejected').length

  let tone = 'border-[#16a34a]/50 text-[#4ade80]'
  let icon = <Wifi className="h-5 w-5" />
  let text = 'Conectado'
  if (s.sessionExpired) { tone = 'border-red-500/60 bg-red-500/10 text-red-300'; icon = <AlertTriangle className="h-5 w-5" />; text = 'Vuelve a entrar' }
  else if (!s.online) { tone = 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#fbbf24]'; icon = <CloudOff className="h-5 w-5" />; text = s.pending ? `Sin conexión · ${s.pending} guardada${s.pending === 1 ? '' : 's'}` : 'Sin conexión' }
  else if (s.syncing || s.pending) { tone = 'border-[#3b82f6]/60 bg-[#3b82f6]/10 text-[#93c5fd]'; icon = <RefreshCw className="h-5 w-5 animate-spin" />; text = `Enviando ${s.pending}` }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('relative inline-flex h-14 items-center gap-2 rounded-2xl border px-4 text-base font-semibold', P.card, tone)}>
        {icon}{text}
        {problems > 0 && <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-sm font-bold text-white">{problems}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#0b1220]/70" onClick={() => setOpen(false)}>
          <div className={cn('flex h-full w-full max-w-[480px] flex-col border-l', P.panel, P.border)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
              <div className={cn('text-xl font-bold', P.text)}>Conexión con la oficina</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className={cn('inline-flex h-12 w-12 items-center justify-center rounded-xl border', P.border, P.card, P.muted)}><X className="h-6 w-6" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className={cn('flex flex-col gap-2 rounded-xl border p-4 text-[16px]', P.border, P.card, P.soft)}>
                <div className="flex justify-between"><span className={P.muted}>Estado</span><strong className={P.text}>{s.sessionExpired ? 'Sesión caducada' : s.online ? 'Conectado' : 'Sin conexión'}</strong></div>
                <div className="flex justify-between"><span className={P.muted}>Acciones guardadas sin enviar</span><strong className={P.text}>{s.pending}</strong></div>
                {s.pending > 0 && <div className="flex justify-between"><span className={P.muted}>La más antigua</span><strong className={P.text}>{hora(s.oldestPendingAt)}</strong></div>}
                <div className="flex justify-between"><span className={P.muted}>Último envío</span><strong className={P.text}>{hora(s.lastSyncAt)}</strong></div>
              </div>
              {!s.online && (
                <div className="rounded-xl border border-[#f59e0b]/60 bg-[#f59e0b]/10 px-4 py-3 text-[15px] leading-snug text-[#fbbf24]">
                  Puedes seguir cortando y preparando. Todo se guarda en la tablet y se envía solo en cuanto vuelva la conexión. No cierres sesión hasta entonces.
                </div>
              )}
              {s.sessionExpired && (
                <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-[15px] leading-snug text-red-300">
                  La sesión de la tablet caducó. Sal y vuelve a entrar con tu PIN: lo guardado se enviará después, no se pierde.
                </div>
              )}
              <button type="button" onClick={() => void flush()} className={cn('inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border text-base font-semibold', P.border, P.card, P.text)}>
                <RefreshCw className="h-5 w-5" /> Intentar enviar ahora
              </button>
              <div className="flex flex-col gap-2">
                <div className={cn('text-[13px] font-bold uppercase tracking-[0.08em]', P.muted)}>Avisos al enviar</div>
                {s.notices.length === 0 && <div className={cn('text-[15px]', P.muted)}>Ninguno. Todo lo enviado se registró bien.</div>}
                {s.notices.map(nt => (
                  <div key={nt.opId} className={cn('flex flex-col gap-2 rounded-xl border p-4', nt.kind === 'rejected' ? 'border-red-500/50 bg-red-500/10' : 'border-[#f59e0b]/50 bg-[#f59e0b]/10')}>
                    <div className={cn('text-[16px] font-bold', P.text)}>{nt.label || 'Acción de planta'}</div>
                    <div className={cn('text-[15px]', nt.kind === 'rejected' ? 'text-red-300' : 'text-[#fbbf24]')}>{nt.kind === 'rejected' ? 'No se registró: ' : ''}{nt.message}</div>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[13px]', P.muted)}>Hecha a las {hora(nt.occurredAt)} · la oficina también lo ve</span>
                      <button type="button" onClick={() => void dismissNotice(nt.opId)} className={cn('h-11 rounded-xl border px-4 text-[15px] font-semibold', P.border, P.card, P.text)}>Entendido</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Franja bajo la cabecera cuando lo que se ve es la foto guardada en la tablet. */
export function PlantaOfflineBanner({ savedAt, fromCache }: { savedAt: string | null; fromCache: boolean }) {
  const s = useSyncState()
  if (s.online && !fromCache) return null
  return (
    <div className="border-b border-[#f59e0b]/40 bg-[#f59e0b]/10 px-6 py-2.5 text-center text-[15px] font-semibold text-[#fbbf24]">
      Sin conexión · datos de las {hora(savedAt)} · lo que hagas se guarda en la tablet y se envía al volver la conexión
    </div>
  )
}
