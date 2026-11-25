'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { approveOrderOrHold, approveOrderOnHold } from '@/app/actions/orders'
import { useConfirm } from '@/components/confirm-modal'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/lib/user-error'

// Acciones de la cabecera del detalle: solo aprobar un pedido nuevo. La
// ampliación de EVO, la asignación en pausa y deshacer entregas viven en sus
// bloques del propio detalle.
export default function OrderActions({ order, onUpdate }: { order: any; onUpdate?: () => Promise<void>; isHeaderMode?: boolean }) {
  const [loading, setLoading] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  async function handleApprove() {
    const ok = await confirm(
      '¿Aprobar el pedido?',
      'Se crean sus órdenes de corte y preparación y se reserva el stock de cada línea. Si alguna línea no tiene stock, se aprueba en pausa: se reserva lo que hay y el resto lo asignas después.',
      { variant: 'success', confirmText: 'Sí, aprobar' },
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await approveOrderOrHold(order.id)
      if (res.mode === 'en_pausa') toast.warning('Aprobado en pausa: falta stock', { description: 'Se ha reservado lo que hay. Asigna el resto desde este detalle.', duration: 10000 })
      else if (res.success) toast.success('Pedido aprobado: la planta ya lo ve')
      else toast.error('Aprobado con incidencias', { description: res.errors?.join('\n'), duration: 12000 })
      await onUpdate?.()
    } catch (e: any) {
      toast.error('No se pudo aprobar', { description: userMessage(e), duration: 10000 })
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveOnHold() {
    const ok = await confirm(
      '¿Aprobar en pausa?',
      'Se reserva el stock de las líneas que lo tienen y las demás quedan sin asignar. Después las asignas desde este detalle (o el operario desde la tablet); el pedido sale de la pausa al asignar la última.',
      { variant: 'warning', confirmText: 'Sí, en pausa' },
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await approveOrderOnHold(order.id)
      toast.success(res?.message || 'Pedido aprobado en pausa')
      await onUpdate?.()
    } catch (e: any) {
      toast.error('No se pudo aprobar en pausa', { description: userMessage(e) })
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
