'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Package, X } from 'lucide-react'
import { PlantaHeader, P, Label } from '@/components/planta/planta-ui'
import { cutCardState, mainTask, orderProgress, orderTasks, TASK_ACTION, TASK_LABEL, type PlantaTask } from '@/lib/planta-tasks'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

// Filtros por tarea, no por estado del pedido: el operario piensa en "qué me
// toca hacer", no en el estado administrativo.
const FILTERS: PlantaTask[] = ['cortar', 'preparar', 'confirmar', 'sin_stock', 'terminado']

const TASK_TONE: Record<PlantaTask, 'amber' | 'blue' | 'green' | 'muted'> = {
  cortar: 'amber',
  preparar: 'blue',
  confirmar: 'amber',
  sin_stock: 'muted',
  terminado: 'green',
}

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PlantaTask | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [unreadNotes, setUnreadNotes] = useState<Record<string, number>>({})

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedidos()
  }, [router])

  async function loadPedidos() {
    try {
      const { getOrdersForPlanta } = await import('@/app/actions/client-queries')
      const data = await getOrdersForPlanta()
      setPedidos(data || [])
      if (data && data.length > 0) {
        const { getUnreadNotesCountByOrders } = await import('@/app/actions/order-notes')
        setUnreadNotes(await getUnreadNotesCountByOrders(data.map((p: any) => p.id)))
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Refresco periódico de la lista completa (cambios desde admin, notas nuevas)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) loadPedidos()
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const counts = useMemo(() => {
    const c: Record<PlantaTask, number> = { cortar: 0, preparar: 0, confirmar: 0, sin_stock: 0, terminado: 0 }
    for (const p of pedidos) for (const t of orderTasks(p)) c[t]++
    return c
  }, [pedidos])

  const filtered = useMemo(() => {
    let list = pedidos
    if (filter !== 'todos') list = list.filter(p => orderTasks(p).includes(filter))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.order_number?.toLowerCase().includes(q) || p.client?.business_name?.toLowerCase().includes(q))
    }
    // Primero lo urgente (confirmar), luego cortar, preparar, sin stock, terminados
    const rank: Record<PlantaTask, number> = { confirmar: 0, cortar: 1, preparar: 2, sin_stock: 3, terminado: 4 }
    return [...list].sort((a, b) => rank[mainTask(a)] - rank[mainTask(b)])
  }, [pedidos, filter, search])

  if (loading) {
    return <div className={cn('flex min-h-screen items-center justify-center text-xl', P.bg, P.muted)}>Cargando pedidos...</div>
  }

  const pendientes = counts.cortar + counts.preparar + counts.confirmar

  return (
    <div className={cn('min-h-screen', P.bg)}>
      <PlantaHeader
        operator={operator}
        title="Pedidos"
        subtitle={pendientes === 0 ? 'Nada pendiente ahora mismo' : `${counts.cortar} para cortar · ${counts.preparar} para preparar${counts.confirmar ? ` · ${counts.confirmar} por confirmar` : ''}`}
        onSearch={() => setShowSearch(v => !v)}
      />

      <main className="mx-auto max-w-[1180px] px-6 py-5">
        {showSearch && (
          <div className="mb-4 flex items-center gap-3">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Número de pedido o cliente"
              className={cn('h-14 flex-1 rounded-2xl border px-5 text-lg outline-none placeholder:text-[#64748b] focus:border-[#f59e0b]', P.border, P.card, P.text)}
            />
            <button type="button" onClick={() => { setShowSearch(false); setSearch('') }} aria-label="Cerrar búsqueda" className={cn('inline-flex h-14 w-14 items-center justify-center rounded-2xl border', P.border, P.card, P.muted)}>
              <X className="h-6 w-6" />
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2.5">
          <Chip active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos <span className="opacity-70">{pedidos.length}</span></Chip>
          {FILTERS.map(t => (
            <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>
              {TASK_LABEL[t]} <span className="opacity-70">{counts[t]}</span>
            </Chip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={cn('flex flex-col items-center gap-3 rounded-2xl border p-14 text-center', P.card, P.border)}>
            <Package className={cn('h-12 w-12', P.muted)} />
            <div className={cn('text-2xl font-bold', P.text)}>{pedidos.length === 0 ? 'No hay pedidos aprobados' : 'Nada en este filtro'}</div>
            <div className={cn('text-lg', P.muted)}>{pedidos.length === 0 ? 'Cuando el admin apruebe un pedido aparecerá aquí.' : 'Prueba con otro filtro o quita la búsqueda.'}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map(pedido => (
              <OrderCard key={pedido.id} pedido={pedido} unread={unreadNotes[pedido.id] || 0} onOpen={() => router.push(`/planta/pedidos/${pedido.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex h-12 items-center gap-2 rounded-full border px-5 text-base font-semibold transition-colors', active ? 'border-[#f59e0b] bg-[#f59e0b] text-[#0b1220]' : cn(P.border, P.card, P.soft))}
    >
      {children}
    </button>
  )
}

function OrderCard({ pedido, unread, onOpen }: { pedido: any; unread: number; onOpen: () => void }) {
  const task = mainTask(pedido)
  const progress = orderProgress(pedido)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const status = getOrderStatusConfig(pedido.status)
  const cuts: any[] = pedido.cut_orders || []
  const preps: any[] = pedido.preparation_items || []
  const lines = [
    ...cuts.map(c => ({ key: `c-${c.id}`, code: c.product?.code, qty: Number(c.quantity_requested), done: Number(c.quantity_cut) || 0, state: cutCardState(c) })),
    ...preps.map(p => ({ key: `p-${p.id}`, code: p.product?.code, qty: Number(p.quantity_requested), done: Number(p.quantity_prepared) || 0, state: Number(p.quantity_prepared) >= Number(p.quantity_requested) ? 'terminada' : 'preparar' })),
  ]
  const visible = lines.slice(0, 4)
  const barColor = task === 'terminado' ? 'bg-[#16a34a]' : task === 'preparar' ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex flex-col gap-4 rounded-2xl border p-5 text-left transition-colors hover:border-[#f59e0b]/60 active:bg-[#162138]', P.card, task === 'confirmar' ? 'border-[#f59e0b]' : P.border)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('text-[26px] font-extrabold leading-tight', P.text)}>{pedido.order_number}</div>
          <div className={cn('truncate text-lg', P.soft)}>{pedido.client?.business_name || 'Sin cliente'}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Label tone={TASK_TONE[task]}>{TASK_LABEL[task]}</Label>
          {pedido.status === 'modificado' && <Label tone="muted">Ampliación pendiente</Label>}
          {pedido.status === 'aprobado_en_pausa' && <Label tone="muted">{status.label}</Label>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map(l => (
          <span key={l.key} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[15px] font-semibold', P.border, l.state === 'terminada' ? 'text-[#4ade80]' : l.state === 'sin_chapa' ? 'text-[#94a3b8] line-through decoration-[#64748b]' : P.text)}>
            {l.code || '—'} <span className="opacity-70">×{l.qty}</span>
          </span>
        ))}
        {lines.length > visible.length && <span className={cn('px-1 py-1 text-[15px]', P.muted)}>+{lines.length - visible.length} más</span>}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1e293b]">
          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('w-[64px] text-right text-base font-bold tabular-nums', P.soft)}>{progress.done}/{progress.total}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/60 bg-[#f59e0b]/15 px-3 py-1 text-[15px] font-bold text-[#fbbf24]">
              <MessageSquare className="h-4 w-4" /> {unread} {unread === 1 ? 'nota' : 'notas'}
            </span>
          )}
        </div>
        <span className={cn('text-lg font-bold', task === 'terminado' ? 'text-[#4ade80]' : task === 'preparar' ? 'text-[#93c5fd]' : task === 'sin_stock' ? P.muted : 'text-[#fbbf24]')}>{TASK_ACTION[task]}</span>
      </div>
    </button>
  )
}
