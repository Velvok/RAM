'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OrdenesPlantaPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir a la nueva vista de pedidos
    router.push('/planta/pedidos')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white text-xl">Redirigiendo...</div>
    </div>
  )
}
