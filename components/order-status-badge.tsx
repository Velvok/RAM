import { Badge } from '@/components/ui/badge'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

// Chip de estado de pedido, único para listado, detalle y dashboard.
export function OrderStatusBadge({ status, size = 'sm', className }: { status: string; size?: 'sm' | 'md'; className?: string }) {
  const config = getOrderStatusConfig(status)
  const Icon = config.icon
  return (
    <Badge variant={config.badgeVariant} className={cn(size === 'md' && 'px-2.5 py-1 text-sm', className)}>
      <Icon size={size === 'md' ? 14 : 12} strokeWidth={2} />
      {config.label}
    </Badge>
  )
}
