'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// Piezas compartidas del diseño de planta (tablet, fondo oscuro, botones de
// 56 a 72 px). Los colores son fijos a propósito: la tablet no cambia de tema.
export const P = {
  bg: 'bg-[#0b1220]',
  panel: 'bg-[#0f172a]',
  card: 'bg-[#111a2e]',
  border: 'border-[#233052]',
  text: 'text-[#f1f5f9]',
  muted: 'text-[#94a3b8]',
  soft: 'text-[#cbd5e1]',
  amber: '#f59e0b',
}

export function useClock() {
  const [now, setNow] = useState('')
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function initials(name?: string | null) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}

export function PlantaHeader({ operator, title, subtitle, left, right, onSearch }: {
  operator: { full_name?: string } | null
  title: ReactNode
  subtitle?: ReactNode
  left?: ReactNode
  right?: ReactNode
  onSearch?: () => void
}) {
  const router = useRouter()
  const clock = useClock()
  const [confirmExit, setConfirmExit] = useState(false)

  async function logout() {
    // Con acciones guardadas sin enviar, avisar: si entra otro operario se enviarían con su sesión
    const { getSyncState, flush } = await import('@/lib/planta-offline/store')
    const st = getSyncState()
    const mine = st.pending - st.heldOthers.reduce((a, h) => a + h.count, 0)
    if (mine > 0 && !confirmExit) {
      void flush()
      setConfirmExit(true)
      setTimeout(() => setConfirmExit(false), 6000)
      const { toast } = await import('sonner')
      const n = mine
      toast.warning(`Hay ${n} ${n === 1 ? 'acción' : 'acciones'} sin enviar. Espera a que vuelva la conexión o pulsa «Salir igualmente»: se enviarán cuando vuelvas a entrar con tu PIN en esta tablet.`, { duration: 6000 })
      return
    }
    const { clearLocalDataIfIdle } = await import('@/lib/planta-offline/store')
    await clearLocalDataIfIdle()
    localStorage.removeItem('operator')
    try {
      const { logoutPlanta } = await import('@/app/actions/auth')
      await logoutPlanta()
    } catch (e) {
      console.error('Error cerrando sesión de planta:', e)
    }
    router.push('/planta/login')
  }

  return (
    <header className={cn('flex items-center justify-between gap-4 border-b border-[#1e293b] px-6 py-4', P.panel)}>
      <div className="flex min-w-0 items-center gap-4">
        {left}
        {!left && (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-base font-extrabold text-[#0b1220]">{initials(operator?.full_name)}</span>
        )}
        <div className="min-w-0">
          <div className={cn('truncate text-xl font-bold', P.text)}>{title}</div>
          {subtitle && <div className={cn('truncate text-[15px]', P.muted)}>{subtitle}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        <span className={cn('px-2 text-[26px] font-bold tabular-nums', P.text)} suppressHydrationWarning>{clock}</span>
        {onSearch && (
          <button type="button" onClick={onSearch} aria-label="Buscar pedido" className={cn('inline-flex h-14 w-14 items-center justify-center rounded-2xl border', P.border, P.card, P.text)}>
            <Search className="h-6 w-6" />
          </button>
        )}
        <button type="button" onClick={logout} className={cn('inline-flex h-14 items-center gap-2 rounded-2xl border px-4 text-base font-semibold', P.border, P.card, P.muted)}>
          <LogOut className="h-5 w-5" /> {confirmExit ? 'Salir igualmente' : 'Salir'}
        </button>
      </div>
    </header>
  )
}

export function PlantaStepper({ value, onChange, min = 1, max, size = 'lg' }: { value: number; onChange: (v: number) => void; min?: number; max: number; size?: 'lg' | 'md' }) {
  const btn = size === 'lg' ? 'h-[72px] w-[72px] text-3xl' : 'h-14 w-14 text-2xl'
  const num = size === 'lg' ? 'w-[110px] text-4xl' : 'w-[76px] text-3xl'
  return (
    <div className={cn('inline-flex items-center overflow-hidden rounded-2xl border', P.border, P.panel)}>
      <button type="button" aria-label="Una menos" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={cn(btn, 'border-none font-semibold disabled:opacity-30', P.card, P.text)}>−</button>
      <span className={cn(num, 'text-center font-extrabold tabular-nums', P.text)}>{value}</span>
      <button type="button" aria-label="Una más" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={cn(btn, 'border-none font-semibold disabled:opacity-30', P.card, P.text)}>+</button>
    </div>
  )
}

export function BigButton({ children, tone = 'green', className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'green' | 'amber' | 'blue' | 'ghost' | 'outline-amber' }) {
  const tones: Record<string, string> = {
    green: 'bg-[#16a34a] text-white hover:bg-[#15803d]',
    amber: 'bg-[#f59e0b] text-[#0b1220] hover:bg-[#d97706]',
    blue: 'bg-[#1d4ed8] text-white hover:bg-[#1e40af]',
    ghost: cn('border', P.border, P.card, P.text, 'hover:bg-[#162138]'),
    'outline-amber': cn('border border-[#f59e0b]', P.card, 'text-[#fbbf24]'),
  }
  return (
    <button type="button" {...rest} className={cn('inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50', tones[tone], className)}>
      {children}
    </button>
  )
}

export function Label({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'amber' | 'green' | 'blue' }) {
  const c = { muted: P.muted, amber: 'text-[#fbbf24]', green: 'text-[#4ade80]', blue: 'text-[#93c5fd]' }[tone]
  return <span className={cn('text-[13px] font-bold uppercase tracking-[0.08em]', c)}>{children}</span>
}

export function PlantaPinPad({ value, onChange, onSubmit, disabled, submitLabel = 'Entrar', maxLength = 6 }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  submitLabel?: string
  maxLength?: number
}) {
  const press = (d: string) => { if (!disabled && value.length < maxLength) onChange(value + d) }
  const key = cn('h-[84px] rounded-2xl border text-[32px] font-semibold disabled:opacity-40', P.border, P.card, P.text)
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-3">
        <span className={cn('text-lg font-medium', P.muted)}>Tu PIN</span>
        <div className="flex gap-4" aria-label={`${value.length} dígitos introducidos`}>
          {Array.from({ length: maxLength }).map((_, i) => (
            <span key={i} className={cn('inline-block h-[22px] w-[22px] rounded-full', i < value.length ? 'bg-[#f59e0b]' : 'bg-[#334155]')} />
          ))}
        </div>
      </div>
      <div className="grid w-[390px] grid-cols-3 gap-3.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={key}>{d}</button>
        ))}
        <button type="button" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))} className={cn('h-[84px] rounded-2xl border text-lg font-semibold disabled:opacity-40', P.border, P.panel, P.muted)}>Borrar</button>
        <button type="button" disabled={disabled} onClick={() => press('0')} className={key}>0</button>
        <button type="button" disabled={disabled || value.length < 4} onClick={onSubmit} className="h-[84px] rounded-2xl bg-[#16a34a] text-xl font-bold text-white disabled:opacity-40">{submitLabel}</button>
      </div>
    </div>
  )
}
