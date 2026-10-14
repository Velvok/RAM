import { AlertCircle, CheckCircle, Clock, Package, PauseCircle, XCircle, LucideIcon } from 'lucide-react'
import type { BadgeProps } from '@/components/ui/badge'

export type OrderStatus =
  | 'nuevo'
  | 'aprobado'
  | 'aprobado_en_pausa'
  | 'en_corte'
  | 'finalizado'
  | 'entregado'
  | 'cancelado'

interface OrderStatusConfig {
  label: string
  badgeVariant: NonNullable<BadgeProps['variant']>
  icon: LucideIcon
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  nuevo: { label: 'Nuevo pedido', badgeVariant: 'muted', icon: AlertCircle },
  aprobado: { label: 'Aprobado', badgeVariant: 'warning', icon: Package },
  aprobado_en_pausa: { label: 'En pausa', badgeVariant: 'warning', icon: PauseCircle },
  en_corte: { label: 'En corte', badgeVariant: 'info', icon: Clock },
  finalizado: { label: 'Finalizado', badgeVariant: 'success', icon: CheckCircle },
  entregado: { label: 'Entregado', badgeVariant: 'default', icon: CheckCircle },
  cancelado: { label: 'Cancelado', badgeVariant: 'destructive', icon: XCircle },
}

const FALLBACK_STATUS: OrderStatusConfig = ORDER_STATUS_CONFIG.nuevo

export function getOrderStatusConfig(status: string): OrderStatusConfig {
  return ORDER_STATUS_CONFIG[status as OrderStatus] ?? FALLBACK_STATUS
}

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]
