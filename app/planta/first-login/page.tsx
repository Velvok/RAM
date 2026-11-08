'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePin } from '@/app/actions/auth'
import { PlantaPinPad, P } from '@/components/planta/planta-ui'
import { cn } from '@/lib/utils'

export default function PlantaFirstLoginPage() {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'new' | 'confirm'>('new')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const operatorData = typeof window !== 'undefined' ? localStorage.getItem('operator') : null
  const operator = operatorData ? JSON.parse(operatorData) : null
  const currentPin = step === 'new' ? pin : confirmPin
  const setCurrentPin = step === 'new' ? setPin : setConfirmPin

  const handleSubmit = async () => {
    if (currentPin.length < 4) {
      setError('El PIN tiene entre 4 y 6 dígitos')
      return
    }
    if (step === 'new') {
      setStep('confirm')
      setError(null)
      return
    }
    if (pin !== confirmPin) {
      setError('Los dos PIN no coinciden. Vuelve a repetirlo.')
      setConfirmPin('')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await changePin(operator.id, pin)
      if (result.error) {
        setError(result.error)
        setStep('new')
        setPin('')
        setConfirmPin('')
      } else {
        router.push('/planta/pedidos')
      }
    } catch {
      setError('No se pudo cambiar el PIN. Inténtalo otra vez.')
    } finally {
      setLoading(false)
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
          <h1 className={cn('mt-6 text-[40px] font-extrabold leading-[1.05]', P.text)}>Hola{operator?.full_name ? `, ${operator.full_name.split(' ')[0]}` : ''}</h1>
          <p className={cn('mt-3 text-xl leading-snug', P.muted)}>Es tu primera vez. Elige un PIN nuevo de 4 a 6 dígitos que solo sepas tú.</p>
        </div>
        <ol className={cn('flex flex-col gap-3 rounded-2xl border p-5 text-base', P.card, P.border, P.muted)}>
          <li className={cn(step === 'new' && 'font-bold text-[#fbbf24]')}>1. Marca tu PIN nuevo</li>
          <li className={cn(step === 'confirm' && 'font-bold text-[#fbbf24]')}>2. Repítelo para confirmar</li>
        </ol>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className={cn('text-center text-2xl font-bold', P.text)}>{step === 'new' ? 'Marca tu PIN nuevo' : 'Repite el PIN'}</div>
        {error && <div role="alert" className="w-[390px] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-base text-red-300">{error}</div>}
        <PlantaPinPad value={currentPin} onChange={v => { setCurrentPin(v); setError(null) }} onSubmit={handleSubmit} disabled={loading} submitLabel={step === 'new' ? 'Seguir' : loading ? '...' : 'Guardar'} />
      </main>
    </div>
  )
}
