'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, KeyRound } from 'lucide-react'
import { loginWithEmail, activateAccount } from '@/app/actions/auth'
import { cn } from '@/lib/utils'

const INPUT =
  'mt-1.5 block h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/30'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'activar'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function entrar(correo: string, clave: string) {
    const fd = new FormData()
    fd.set('email', correo)
    fd.set('password', clave)
    // Si va bien, la acción redirige al panel y esto no vuelve
    const result = await loginWithEmail(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'activar') {
      if (password !== confirm) {
        setError('Las contraseñas no coinciden')
        setLoading(false)
        return
      }
      const res = await activateAccount(email, password)
      if (!res.ok) {
        setError(res.error || 'No se pudo activar la cuenta')
        setLoading(false)
        return
      }
      // Activada: se entra directamente con la contraseña que acaba de elegir
      await entrar(email, password)
      return
    }

    await entrar(email, password)
  }

  function switchMode(next: 'login' | 'activar') {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">
            RAM <span className="text-primary">Velvok</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de Gestión de Corte y Stock</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div role="tablist" className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {([['login', 'Iniciar sesión'], ['activar', 'Primer acceso']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchMode(id)}
                className={cn(
                  'h-9 rounded-md text-sm font-medium transition-colors',
                  mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'activar' && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Si te hemos dado de alta, introduce tu email y elige tu contraseña. Solo hay que hacerlo la primera vez.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className={INPUT} />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-foreground">{mode === 'activar' ? 'Elige tu contraseña' : 'Contraseña'}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'activar' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'activar' ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'activar' ? 'Mínimo 8 caracteres' : ''}
                className={INPUT}
              />
            </div>

            {mode === 'activar' && (
              <div>
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">Repite la contraseña</label>
                <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={INPUT} />
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'activar' ? (loading ? 'Activando...' : 'Activar cuenta y entrar') : (loading ? 'Entrando...' : 'Iniciar sesión')}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link href="/planta/login" className="text-sm font-medium text-primary hover:text-primary/80">
            ¿Eres operario? Entra con tu PIN →
          </Link>
        </div>
      </div>
    </div>
  )
}
