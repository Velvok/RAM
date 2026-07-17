'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changePin } from '@/app/actions/auth'

export default function PlantaFirstLoginPage() {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'new' | 'confirm'>('new')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const operatorData = typeof window !== 'undefined' ? localStorage.getItem('operator') : null
  const operator = operatorData ? JSON.parse(operatorData) : null

  const handleNumberClick = (num: string) => {
    const currentPin = step === 'new' ? pin : confirmPin
    if (currentPin.length < 6) {
      if (step === 'new') {
        setPin(currentPin + num)
      } else {
        setConfirmPin(currentPin + num)
      }
    }
  }

  const handleDelete = () => {
    if (step === 'new') {
      setPin(pin.slice(0, -1))
    } else {
      setConfirmPin(confirmPin.slice(0, -1))
    }
  }

  const handleClear = () => {
    if (step === 'new') {
      setPin('')
    } else {
      setConfirmPin('')
    }
    setError(null)
  }

  const handleSubmit = async () => {
    const currentPin = step === 'new' ? pin : confirmPin

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

  const currentPin = step === 'new' ? pin : confirmPin

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            Primer Login
          </h1>
          <p className="text-slate-300">
            {step === 'new' ? 'Ingresa tu nuevo PIN' : 'Confirma tu nuevo PIN'}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-8 border border-slate-700">
          {error && (
            <div className="mb-6 rounded-md bg-red-500/10 border border-red-500/30 p-4">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <div className="mb-8">
            <div className="flex justify-center space-x-3 mb-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                    currentPin.length > i
                      ? 'bg-blue-500 border-blue-400 text-white'
                      : 'bg-slate-700/50 border-slate-600 text-slate-500'
                  }`}
                >
                  {currentPin.length > i ? '•' : ''}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={loading}
                className="h-20 text-3xl font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loading}
              className="h-20 text-lg font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Limpiar
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={loading}
              className="h-20 text-3xl font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="h-20 text-lg font-semibold bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              ←
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || currentPin.length < 4}
            className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : step === 'new' ? 'Continuar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
