'use client'

import { useState } from 'react'
import { loginWithPin } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'
import { PinPad } from '@/components/planta/pin-pad'

export default function PlantaLoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
      if (result.firstLogin) {
        router.push('/planta/first-login')
      } else {
        router.push('/planta/ordenes')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Acceso Operarios
          </h1>
          <p className="text-foreground/90">
            Ingresa tu PIN de 4-6 dígitos
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-lg p-8 border border-border">
          {error && (
            <div className="mb-6 rounded-md bg-red-500/10 border border-red-500/30 p-4">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <PinPad
            value={pin}
            onChange={setPin}
            onClear={() => { setPin(''); setError(null) }}
            disabled={loading}
          />

          <button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="w-full h-16 mt-6 text-xl font-bold bg-blue-600 hover:bg-blue-500 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}
