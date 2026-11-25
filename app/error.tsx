'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { reportPossibleStaleDeploy } from '@/lib/stale-deploy'

// Pantalla cuando una página falla al cargar: sin detalles técnicos (quedan en
// los logs del servidor) y con una salida clara.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Error al cargar la página:', error)
    reportPossibleStaleDeploy(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">No se ha podido cargar esta pantalla</h1>
        <p className="text-sm text-muted-foreground">
          Ha fallado algo al traer los datos. No se ha perdido nada: vuelve a intentarlo y, si sigue pasando, avisa a soporte.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={reset}>Volver a intentarlo</Button>
          <Button variant="outline" onClick={() => { window.location.href = '/' }}>Ir al inicio</Button>
        </div>
      </div>
    </main>
  )
}
