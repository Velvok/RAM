'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'

export default function PlantaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.documentElement.classList.add('dark')

    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0b1220]">
      {children}
      {/* Avisos grandes, arriba y centrados: la tablet se mira de lejos */}
      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ style: { fontSize: 18, padding: '18px 20px' } }} />
    </div>
  )
}
