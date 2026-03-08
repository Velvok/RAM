'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/register-sw'

export default function PlantaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    registerServiceWorker()
    
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  )
}
