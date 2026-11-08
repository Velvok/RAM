'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginWithPin } from '@/app/actions/auth'
import { PlantaPinPad, P, useClock } from '@/components/planta/planta-ui'
import { cn } from '@/lib/utils'

export default function PlantaLoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const clock = useClock()
  const today = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'short' })

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('El PIN tiene entre 4 y 6 dígitos')
      return
    }
    setLoading(true)
    setError(null)
    const result = await loginWithPin(pin)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      setPin('')
    } else if (result.success && result.user) {
      localStorage.setItem('operator', JSON.stringify(result.user))
      router.push(result.firstLogin ? '/planta/first-login' : '/planta/pedidos')
    }
  }

  return (
    <div className={cn('flex min-h-screen', P.bg)}>
      <aside className={cn('hidden w-[44%] max-w-[520px] flex-col justify-between border-r border-[#1e293b] p-14 md:flex', P.panel)}>
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-block h-10 w-10 rounded-xl bg-[#f59e0b]" />
            <span className={cn('text-xl font-extrabold tracking-[0.08em]', P.text)}>COMERCIAL RAM</span>
          </div>
          <h1 className={cn('mt-6 text-[44px] font-extrabold leading-[1.05]', P.text)}>Planta</h1>
          <p className={cn('mt-3 text-xl leading-snug', P.muted)}>Marca tu PIN para empezar el turno. Lo que cortes y prepares se registra a tu nombre.</p>
        </div>
        <div className={cn('flex flex-col gap-3 rounded-2xl border p-5', P.card, P.border)}>
          <div className={cn('flex justify-between text-base', P.muted)}><span>Hoy</span><span className={cn('font-semibold capitalize', P.text)} suppressHydrationWarning>{today} · {clock}</span></div>
          <div className={cn('flex justify-between text-base', P.muted)}><span>Primera vez</span><span className={cn('font-semibold', P.text)}>Te pediremos cambiar el PIN</span></div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className={cn('mb-2 text-center md:hidden', P.text)}>
          <div className="text-2xl font-extrabold">Planta · Comercial RAM</div>
        </div>
        {error && (
          <div role="alert" className="w-[390px] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-base text-red-300">{error}</div>
        )}
        <PlantaPinPad value={pin} onChange={v => { setPin(v); setError(null) }} onSubmit={handleSubmit} disabled={loading} submitLabel={loading ? '...' : 'Entrar'} />
      </main>
    </div>
  )
}
