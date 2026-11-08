'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Toaster } from 'sonner'
import { startPlantaSync } from '@/lib/planta-offline/store'

export default function PlantaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.classList.add('dark')

    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Sincronización con la oficina (cola local + latido) en cuanto hay operario
  useEffect(() => {
    if (pathname?.startsWith('/planta/login') || pathname?.startsWith('/planta/first-login')) return
    if (localStorage.getItem('operator')) startPlantaSync()
  }, [pathname])

  // Service worker de planta (solo producción): abre la app aunque la tablet
  // se recargue sin conexión. En desarrollo no, para no servir código antiguo.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register(`/planta-sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID || ''}`, { scope: '/planta/' }).catch(e => console.error('No se pudo registrar el service worker de planta:', e))
  }, [])

  // Pasarle al service worker lo ya cargado (la lista y los ficheros de la app)
  // para que la tablet pueda abrirse aunque se recargue sin conexión.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    if (pathname?.startsWith('/planta/login') || pathname?.startsWith('/planta/first-login')) return
    const t = setTimeout(() => {
      navigator.serviceWorker.ready.then(reg => {
        const assets = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.includes('/_next/static/'))
        reg.active?.postMessage({ type: 'warm', urls: ['/planta/pedidos', ...assets] })
      }).catch(() => {})
    }, 3000)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div className="min-h-screen bg-[#0b1220]">
      {children}
      {/* Avisos grandes, arriba y centrados: la tablet se mira de lejos */}
      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ style: { fontSize: 18, padding: '18px 20px' } }} />
    </div>
  )
}
