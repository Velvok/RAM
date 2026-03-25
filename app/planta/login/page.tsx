'use client'

import { useState } from 'react'
import { loginWithPin } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'

export default function PlantaLoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(pin + num)
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
  }

  const handleClear = () => {
    setPin('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos')
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
      router.push('/planta/ordenes')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            Acceso Operarios
          </h1>
          <p className="text-slate-300">
            Ingresa tu PIN de 4-6 dígitos
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
                    pin.length > i
                      ? 'bg-blue-500 border-blue-400 text-white'
                      : 'bg-slate-700/50 border-slate-600 text-slate-500'
                  }`}
                >
                  {pin.length > i ? '•' : ''}
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
            disabled={loading || pin.length < 4}
            className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}
