'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { cancelOrder } from '@/app/actions/orders'
import { useConfirm } from '@/components/confirm-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * "Eliminar pedido" (lo deja cancelado). Solo se pinta para quien tiene
 * permiso (ORDER_DELETE_EMAILS); el servidor lo vuelve a comprobar.
 * `compact`: icono para la fila del listado.
 */
export function DeleteOrderButton({ order, onDone, compact }: {
  order: { id: string; order_number: string; status: string }
  onDone?: () => void | Promise<void>
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  if (order.status === 'cancelado' || order.status === 'entregado') return null

  async function handle(e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm(
      `¿Eliminar el pedido ${order.order_number}?`,
      'Queda como cancelado: la planta deja de verlo, se libera todo su stock reservado (también lo ya cortado o preparado) y se descarta lo que quedara por enviar a EVO. Elimínalo también en EVO. No se puede deshacer.',
      { variant: 'danger', confirmText: 'Sí, eliminar' },
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await cancelOrder(order.id)
      if (res.warnings.length) toast.warning('Pedido eliminado con avisos', { description: res.warnings.join(' · ') })
      else toast.success(`Pedido ${order.order_number} eliminado`, { description: res.released ? `${res.released} uds vuelven a estar disponibles` : undefined })
      await onDone?.()
    } catch (err: any) {
      toast.error('No se pudo eliminar el pedido', { description: err?.message })
    } finally {
      setLoading(false)
    }
  }

  // El span evita que los clics en el botón o el diálogo abran la fila del listado
  return (
    <span className="contents text-left" onClick={e => e.stopPropagation()}>
      <ConfirmDialog />
      {compact ? (
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          title="Eliminar pedido"
          aria-label={`Eliminar pedido ${order.order_number}`}
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50')}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={handle} disabled={loading} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
          Eliminar pedido
        </Button>
      )}
    </span>
  )
}
