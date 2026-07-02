'use client'

import { useEffect } from 'react'

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
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  )
}
