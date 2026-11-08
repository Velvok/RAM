'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getUsers, createUser, updateUser, setUserActive, renewInvitation } from '@/app/actions/users'
import { getEvoConnectionInfo } from '@/app/actions/integration-logs'
import { Button } from '@/components/ui/button'
import { SelectField, FIELD_CLS } from '@/components/ui/select-field'
import { PageLoader } from '@/components/ui/spinner'
import { useConfirm } from '@/components/confirm-modal'
import { cn } from '@/lib/utils'

type User = Awaited<ReturnType<typeof getUsers>>[number]
type Evo = Awaited<ReturnType<typeof getEvoConnectionInfo>>
type Side = { type: 'invite' } | { type: 'operator' } | { type: 'edit'; user: User }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', operator: 'Operario' }
const inputCls = cn(FIELD_CLS, 'pr-3')

function initials(name?: string | null) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}
function when(iso: string | null) {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  if (days === 0 && new Date().toDateString() === d.toDateString()) return `hoy ${time}`
  if (days <= 1) return `ayer ${time}`
  return d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: '2-digit' })
}
function randomPin() {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(1000 + (a[0] % 9000))
}

const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'muted' | 'info'; children: ReactNode }) => (
  <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
    tone === 'ok' && 'bg-success/10 text-success', tone === 'warn' && 'bg-warning/10 text-warning',
    tone === 'muted' && 'bg-muted text-muted-foreground', tone === 'info' && 'bg-primary/10 text-primary')}>{children}</span>
)

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}

export default function ConfiguracionPage() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [evo, setEvo] = useState<Evo | null>(null)
  const [side, setSide] = useState<Side>({ type: 'invite' })
  const [busy, setBusy] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  const [invite, setInvite] = useState({ full_name: '', email: '', role: 'manager' as 'admin' | 'manager' })
  const [op, setOp] = useState({ full_name: '', pin: '' })
  const [edit, setEdit] = useState({ full_name: '', role: 'manager' as 'admin' | 'manager' | 'operator', pin: '' })

  const load = useCallback(async () => {
    try {
      setUsers(await getUsers())
    } catch (e) {
      console.error('Error cargando usuarios:', e)
      setUsers([])
    }
  }, [])

  useEffect(() => {
    load()
    getEvoConnectionInfo().then(setEvo).catch(e => console.error('Error cargando conexión EVO:', e))
    setOp(o => ({ ...o, pin: randomPin() }))
  }, [load])

  function openEdit(u: User) {
    setEdit({ full_name: u.full_name || '', role: u.role as any, pin: '' })
    setSide({ type: 'edit', user: u })
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res: any = await createUser({ full_name: invite.full_name.trim(), email: invite.email.trim(), role: invite.role })
      if (res?.error) { toast.error(res.error); return }
      toast.success(`Invitación creada para ${invite.email.trim()}`, { description: 'Entra en /login → «Primer acceso» con ese email y elige su contraseña.' })
      setInvite({ full_name: '', email: '', role: 'manager' })
      await load()
    } catch (err: any) {
      toast.error('No se pudo crear la invitación', { description: err?.message })
    } finally {
      setBusy(false)
    }
  }

  async function submitOperator(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res: any = await createUser({ full_name: op.full_name.trim(), role: 'operator', pin: op.pin })
      if (res?.error) {
        toast.error(res.error)
        if (/PIN ya lo usa/.test(res.error)) setOp(o => ({ ...o, pin: randomPin() }))
        return
      }
      toast.success(`${op.full_name.trim()} dado de alta`, { description: `PIN inicial ${op.pin}. La tablet le pedirá cambiarlo la primera vez.`, duration: 15000 })
      setOp({ full_name: '', pin: randomPin() })
      await load()
    } catch (err: any) {
      toast.error('No se pudo dar de alta', { description: err?.message })
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (side.type !== 'edit') return
    setBusy(true)
    try {
      const res: any = await updateUser(side.user.id, {
        full_name: edit.full_name.trim(),
        role: side.user.role === 'operator' ? undefined : (edit.role as any),
        newPin: side.user.role === 'operator' && edit.pin ? edit.pin : undefined,
      })
      if (res?.error) { toast.error(res.error); return }
      toast.success(edit.pin ? `Cambios guardados. Nuevo PIN: ${edit.pin}` : 'Cambios guardados', { duration: edit.pin ? 15000 : 4000 })
      setSide({ type: 'invite' })
      await load()
    } catch (err: any) {
      toast.error('No se pudo guardar', { description: err?.message })
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(u: User) {
    const off = u.is_active
    const ok = await confirm(
      off ? `¿Dar de baja a ${u.full_name}?` : `¿Reactivar a ${u.full_name}?`,
      off
        ? `${u.role === 'operator' ? 'No podrá entrar en la tablet' : 'No podrá entrar en el panel'}. Su historial de cortes, notas y aprobaciones se conserva. Se puede reactivar cuando quieras.`
        : 'Vuelve a poder entrar con su PIN o su contraseña de siempre.',
      { variant: off ? 'danger' : 'success', confirmText: off ? 'Dar de baja' : 'Reactivar' },
    )
    if (!ok) return
    try {
      const res: any = await setUserActive(u.id, !off)
      if (res?.error) { toast.error(res.error); return }
      toast.success(off ? `${u.full_name} dado de baja` : `${u.full_name} reactivado`)
      await load()
    } catch (err: any) {
      toast.error('No se pudo cambiar el estado', { description: err?.message })
    }
  }

  async function renew(u: User) {
    try {
      const res: any = await renewInvitation(u.id)
      if (res?.error) { toast.error(res.error); return }
      toast.success('Invitación renovada 14 días', { description: `${u.email} puede activar su cuenta en /login → «Primer acceso».` })
      await load()
    } catch (err: any) {
      toast.error('No se pudo renovar', { description: err?.message })
    }
  }

  if (!users) return <div className="flex min-h-[400px] items-center justify-center"><PageLoader label="Cargando usuarios…" /></div>

  const staff = users.filter(u => u.role !== 'operator')
  const operators = users.filter(u => u.role === 'operator')
  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-3 text-[13px] align-middle'
  const linkBtn = 'whitespace-nowrap text-xs font-semibold text-primary hover:underline'

  const staffState = (u: User) => {
    if (!u.is_active) return <Pill tone="muted">De baja</Pill>
    if (u.invite_pending) {
      const expired = u.invite_expires_at && new Date(u.invite_expires_at).getTime() < Date.now()
      if (expired) return <Pill tone="warn">Invitación caducada</Pill>
      const days = u.invite_expires_at ? Math.max(0, Math.ceil((new Date(u.invite_expires_at).getTime() - Date.now()) / 86400000)) : null
      return <Pill tone="warn">Pendiente{days != null ? ` · caduca en ${days} ${days === 1 ? 'día' : 'días'}` : ''}</Pill>
    }
    return <Pill tone="ok">Activo</Pill>
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Quién entra en RAM, cómo entra la planta y cómo está conectado EVO</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSide({ type: 'operator' })}>Nuevo operario</Button>
          <Button onClick={() => setSide({ type: 'invite' })}>Invitar usuario</Button>
        </div>
      </div>

      <div className="admin-split" style={{ ['--aside-w' as string]: 'clamp(320px, 26vw, 360px)' }}>
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">Acceso al panel</h2>
            <span className="text-xs text-muted-foreground">admin y manager entran con email y contraseña</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-y border-border bg-muted/40"><tr><th className={th}>Usuario</th><th className={th}>Rol</th><th className={th}>Estado</th><th className={th}>Último acceso</th><th className={cn(th, 'text-right')}>Acciones</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {staff.map(u => (
                  <tr key={u.id} className={cn(!u.is_active && 'opacity-60', u.invite_pending && u.is_active && 'bg-warning/5', side.type === 'edit' && side.user.id === u.id && 'bg-primary/5')}>
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{initials(u.full_name)}</span>
                        <div className="min-w-0"><div className="font-semibold text-foreground">{u.full_name}</div><div className="truncate text-xs text-muted-foreground">{u.email}</div></div>
                      </div>
                    </td>
                    <td className={td}><Pill tone="info">{ROLE_LABEL[u.role] || u.role}</Pill></td>
                    <td className={td}>{staffState(u)}</td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{u.invite_pending ? 'nunca' : when(u.last_access_at)}</td>
                    <td className={cn(td, 'text-right')}>
                      <span className="inline-flex gap-3">
                        {u.invite_pending && u.is_active && <button type="button" className={linkBtn} onClick={() => renew(u)}>Renovar invitación</button>}
                        <button type="button" className={linkBtn} onClick={() => openEdit(u)}>Editar</button>
                        <button type="button" className={cn(linkBtn, u.is_active ? 'text-destructive' : '')} onClick={() => toggleActive(u)}>{u.is_active ? 'Dar de baja' : 'Reactivar'}</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 pb-3 pt-5">
            <h2 className="text-base font-semibold text-foreground">Operarios de planta</h2>
            <span className="text-xs text-muted-foreground">entran con PIN en la tablet · el PIN es único por operario</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-y border-border bg-muted/40"><tr><th className={th}>Operario</th><th className={th}>PIN</th><th className={th}>Estado</th><th className={th}>Último acceso</th><th className={cn(th, 'text-right')}>Acciones</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {operators.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">Todavía no hay operarios.</td></tr>}
                {operators.map(u => (
                  <tr key={u.id} className={cn(!u.is_active && 'opacity-60', u.first_login && u.is_active && 'bg-warning/5', side.type === 'edit' && side.user.id === u.id && 'bg-primary/5')}>
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">{initials(u.full_name)}</span>
                        <span className="font-semibold text-foreground">{u.full_name}</span>
                      </div>
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>●●●● <span className={cn('text-xs', u.first_login && 'text-warning')}>· {u.first_login ? 'inicial, debe cambiarlo' : 'propio'}</span></td>
                    <td className={td}>{!u.is_active ? <Pill tone="muted">De baja</Pill> : u.first_login ? <Pill tone="warn">Primer acceso pendiente</Pill> : <Pill tone="ok">Activo</Pill>}</td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{when(u.last_access_at)}</td>
                    <td className={cn(td, 'text-right')}>
                      <span className="inline-flex gap-3">
                        <button type="button" className={linkBtn} onClick={() => openEdit(u)}>Nuevo PIN</button>
                        <button type="button" className={cn(linkBtn, u.is_active ? 'text-destructive' : '')} onClick={() => toggleActive(u)}>{u.is_active ? 'Dar de baja' : 'Reactivar'}</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Dar de baja impide entrar y conserva el historial. No se borra a nadie que haya trabajado.</div>
        </section>

        <aside className="flex min-w-0 flex-col gap-5 ">
          {side.type === 'invite' && (
            <form onSubmit={submitInvite} className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
              <div><h2 className="text-base font-semibold text-foreground">Invitar usuario</h2><p className="text-xs text-muted-foreground">Sin contraseña: la elige en «Primer acceso»</p></div>
              <Field label="Nombre completo"><input required value={invite.full_name} onChange={e => setInvite(v => ({ ...v, full_name: e.target.value }))} placeholder="Ej: Laura Méndez" className={inputCls} /></Field>
              <Field label="Email"><input required type="email" value={invite.email} onChange={e => setInvite(v => ({ ...v, email: e.target.value }))} placeholder="laura@empresa.com" className={inputCls} /></Field>
              <Field label="Rol" hint={invite.role === 'admin' ? 'Todo, incluida esta pantalla de usuarios.' : 'Ve y aprueba pedidos, asigna stock. No gestiona usuarios.'}>
                <SelectField value={invite.role} onChange={e => setInvite(v => ({ ...v, role: e.target.value as any }))}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </SelectField>
              </Field>
              <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                Pásale el enlace de acceso: en <strong className="text-foreground">/login</strong>, pestaña <strong className="text-foreground">Primer acceso</strong>, con este email. La invitación caduca a los 14 días.
              </div>
              <Button type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear invitación'}</Button>
            </form>
          )}

          {side.type === 'operator' && (
            <form onSubmit={submitOperator} className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold text-foreground">Nuevo operario</h2><p className="text-xs text-muted-foreground">Solo nombre y PIN, sin email</p></div>
                <button type="button" onClick={() => setSide({ type: 'invite' })} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cerrar</button>
              </div>
              <Field label="Nombre"><input required value={op.full_name} onChange={e => setOp(v => ({ ...v, full_name: e.target.value }))} placeholder="Ej: Roberto Torres" className={inputCls} /></Field>
              <Field label="PIN inicial" hint="Generado al azar. Se lo das en mano; la tablet le pedirá cambiarlo la primera vez.">
                <div className="flex gap-2">
                  <input required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={op.pin} onChange={e => setOp(v => ({ ...v, pin: e.target.value.replace(/\D/g, '') }))} className={cn(inputCls, 'font-semibold tracking-[0.3em]')} />
                  <Button type="button" variant="outline" onClick={() => setOp(v => ({ ...v, pin: randomPin() }))}>Otro</Button>
                </div>
              </Field>
              <Button type="submit" disabled={busy}>{busy ? 'Dando de alta…' : 'Dar de alta'}</Button>
            </form>
          )}

          {side.type === 'edit' && (
            <form onSubmit={submitEdit} className="flex flex-col gap-3.5 rounded-xl border border-primary/60 bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold text-foreground">Editar · {side.user.full_name}</h2><p className="text-xs text-muted-foreground">{side.user.role === 'operator' ? 'Operario de planta' : side.user.email}</p></div>
                <button type="button" onClick={() => setSide({ type: 'invite' })} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cerrar</button>
              </div>
              <Field label="Nombre"><input required value={edit.full_name} onChange={e => setEdit(v => ({ ...v, full_name: e.target.value }))} className={inputCls} /></Field>
              {side.user.role === 'operator' ? (
                <Field label="Nuevo PIN" hint="Déjalo vacío para no cambiarlo. Si lo cambias, díselo en mano.">
                  <div className="flex gap-2">
                    <input inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={edit.pin} onChange={e => setEdit(v => ({ ...v, pin: e.target.value.replace(/\D/g, '') }))} placeholder="4 a 6 dígitos" className={cn(inputCls, 'tracking-[0.3em]')} />
                    <Button type="button" variant="outline" onClick={() => setEdit(v => ({ ...v, pin: randomPin() }))}>Generar</Button>
                  </div>
                </Field>
              ) : (
                <Field label="Rol">
                  <SelectField value={edit.role} onChange={e => setEdit(v => ({ ...v, role: e.target.value as any }))}>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </SelectField>
                </Field>
              )}
              <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
            </form>
          )}

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Conexión EVO</h2>
            {!evo ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Último mensaje de EVO</span><strong>{when(evo.lastInboundAt)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">URL de EVO</span><strong className={evo.apiConfigured ? 'text-success' : 'text-destructive'}>{evo.apiConfigured ? 'configurada' : 'falta'}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Secreto de webhooks</span><strong className={evo.webhookSecretConfigured ? 'text-success' : 'text-destructive'}>{evo.webhookSecretConfigured ? 'configurado' : 'falta'}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Webhooks que llama EVO</span><strong>{evo.webhooks.length}</strong></div>
                {evo.region && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Región del servidor</span><strong>{evo.region}</strong></div>}
              </div>
            )}
            <Link href="/admin/logs" className="text-xs font-semibold text-primary hover:underline">Ver Integración EVO</Link>
            <p className="text-xs text-muted-foreground">Las claves no se muestran ni se editan aquí: viven en Vercel.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
