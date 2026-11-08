'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { generateCutOrders, approveOrderOnHold } from '@/app/actions/orders'
import { useConfirm } from '@/components/confirm-modal'
import { Button } from '@/components/ui/button'

// Acciones de la cabecera del detalle: solo aprobar un pedido nuevo. La
// ampliación de EVO, la asignación en pausa y deshacer entregas viven en sus
// bloques del propio detalle.
export default function OrderActions({ order, onUpdate }: { order: any; onUpdate?: () => Promise<void>; isHeaderMode?: boolean }) {
  const [loading, setLoading] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  async function handleApprove() {
    const ok = await confirm(
      '¿Aprobar el pedido?',
      'Se crean sus órdenes de corte y preparación y se reserva el stock de cada línea. Si alguna línea no tiene stock, no se aprueba nada y te propone aprobar en pausa.',
      { variant: 'success', confirmText: 'Sí, aprobar' },
    )
    if (!ok) return
    setLoading(true)
    try {
      await generateCutOrders(order.id)
      toast.success('Pedido aprobado: la planta ya lo ve')
      await onUpdate?.()
    } catch (e: any) {
      toast.error('No se pudo aprobar', { description: e?.message, duration: 10000 })
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveOnHold() {
    const ok = await confirm(
      '¿Aprobar en pausa?',
      'Se crean las órdenes sin reservar stock. Después asignas cada línea desde este detalle; el pedido sale de la pausa al asignar la última.',
      { variant: 'warning', confirmText: 'Sí, en pausa' },
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await approveOrderOnHold(order.id)
      toast.success(res?.message || 'Pedido aprobado en pausa')
      await onUpdate?.()
    } catch (e: any) {
      toast.error('No se pudo aprobar en pausa', { description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  if (order.status !== 'nuevo') return <ConfirmDialog />

  return (
    <>
      <ConfirmDialog />
      <Button variant="success" size="sm" onClick={handleApprove} disabled={loading}>Aprobar pedido</Button>
      <Button variant="outline" size="sm" onClick={handleApproveOnHold} disabled={loading}>Aprobar en pausa</Button>
    </>
  )
}
