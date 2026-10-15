'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePin } from '@/app/actions/auth'
import { PinPad } from '@/components/planta/pin-pad'

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

  const handleClear = () => {
    setCurrentPin('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (currentPin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos')
      return
    }

    if (step === 'new') {
      setStep('confirm')
      setError(null)
    } else {
      if (pin !== confirmPin) {
        setError('Los PINs no coinciden')
        setConfirmPin('')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await changePin(operator.id, pin)
        if (result.error) {
          setError(result.error)
          setLoading(false)
        } else {
          router.push('/planta/ordenes')
        }
      } catch (e) {
        setError('Error al cambiar el PIN')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Primer Login
          </h1>
          <p className="text-foreground/90">
            {step === 'new' ? 'Ingresa tu nuevo PIN' : 'Confirma tu nuevo PIN'}
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-lg p-8 border border-border">
          {error && (
            <div className="mb-6 rounded-md bg-red-500/10 border border-red-500/30 p-4">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <PinPad
            value={currentPin}
            onChange={setCurrentPin}
            onClear={handleClear}
            disabled={loading}
          />

          <button
            onClick={handleSubmit}
            disabled={loading || currentPin.length < 4}
            className="w-full h-16 mt-6 text-xl font-bold bg-blue-600 hover:bg-blue-500 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : step === 'new' ? 'Continuar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
