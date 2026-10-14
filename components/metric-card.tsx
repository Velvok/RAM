import { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  onClick?: () => void
  className?: string
}

const variantStyles: Record<NonNullable<MetricCardProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  onClick,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn('p-6', onClick && 'cursor-pointer transition-colors hover:border-primary/30', className)}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">{value}</p>
          {trend && <p className="mt-1 text-sm text-muted-foreground/80">{trend}</p>}
        </div>
        <div className={cn('rounded-lg p-3', variantStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  )
}
