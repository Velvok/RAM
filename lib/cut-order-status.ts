import { AlertTriangle, CheckCircle2, Clock, LucideIcon } from 'lucide-react'
import type { BadgeProps } from '@/components/ui/badge'

export type CutOrderStatus = 'pendiente' | 'completada' | 'pendiente_confirmacion'

interface CutOrderStatusConfig {
  label: string
  badgeVariant: NonNullable<BadgeProps['variant']>
  icon: LucideIcon
}

const CUT_ORDER_STATUS_CONFIG: Record<CutOrderStatus, CutOrderStatusConfig> = {
  pendiente: { label: 'Pendiente', badgeVariant: 'warning', icon: Clock },
  completada: { label: 'Completada', badgeVariant: 'success', icon: CheckCircle2 },
  pendiente_confirmacion: { label: 'Confirmar Recogida', badgeVariant: 'warning', icon: AlertTriangle },
}

const FALLBACK_STATUS: CutOrderStatusConfig = CUT_ORDER_STATUS_CONFIG.pendiente

export function getCutOrderStatusConfig(status: string): CutOrderStatusConfig {
  return CUT_ORDER_STATUS_CONFIG[status as CutOrderStatus] ?? FALLBACK_STATUS
}
