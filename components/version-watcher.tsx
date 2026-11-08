'use client'

import { useEffect } from 'react'
import { looksLikeStaleDeploy, STALE_CHECK_EVENT } from '@/lib/stale-deploy'

// Recarga la página cuando se ha desplegado una versión nueva, para que una
// pestaña abierta durante horas (la tablet de planta, el panel) no se quede
// llamando a acciones que ya no existen. Solo recarga si no hay nada a medias:
// sin modales ni paneles abiertos, sin un campo con el foco y sin tocar la
// pantalla en los últimos segundos.
const CHECK_EVERY_MS = 2 * 60 * 1000
const RETRY_MS = 10 * 1000
const IDLE_MS = 20 * 1000
const LOOP_KEY = 'ram-reloaded-for-version'

export function VersionWatcher() {
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID
    if (!mine) return
    let lastInteraction = Date.now()
    let pendingVersion: string | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let checking = false

    const busy = () => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return true
      if (document.querySelector('[data-reload-guard], [role="dialog"], [aria-modal="true"], .fixed.inset-0')) return true
      return Date.now() - lastInteraction < IDLE_MS
    }

    const tryReload = () => {
      if (!pendingVersion) return
      if (!document.hidden && busy()) {
        retry = setTimeout(tryReload, RETRY_MS)
        return
      }
      try {
        // Evita bucles si el servidor sigue dando una versión distinta tras recargar
        if (sessionStorage.getItem(LOOP_KEY) === pendingVersion) return
        sessionStorage.setItem(LOOP_KEY, pendingVersion)
      } catch {}
      window.location.reload()
    }

    const check = async () => {
      if (checking || pendingVersion) return
      checking = true
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { version } = await res.json()
        if (version && version !== mine) {
          pendingVersion = version
          tryReload()
        }
      } catch {
        // Sin conexión: se vuelve a mirar al recuperarla
      } finally {
        checking = false
      }
    }

    const onInteract = () => { lastInteraction = Date.now() }
    const onVisible = () => { if (!document.hidden) check() }
    const onError = (e: ErrorEvent) => { if (looksLikeStaleDeploy(e.error || e.message)) check() }
    const onRejection = (e: PromiseRejectionEvent) => { if (looksLikeStaleDeploy(e.reason)) check() }

    const interval = setInterval(check, CHECK_EVERY_MS)
    window.addEventListener(STALE_CHECK_EVENT, check)
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, onInteract, { passive: true })
    check()

    return () => {
      clearInterval(interval)
      if (retry) clearTimeout(retry)
      window.removeEventListener(STALE_CHECK_EVENT, check)
      window.removeEventListener('online', check)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, onInteract)
    }
  }, [])

  return null
}
