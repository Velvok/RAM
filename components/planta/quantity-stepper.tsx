'use client'

import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  size?: 'default' | 'sm'
}

export function QuantityStepper({ value, onChange, min = 1, max, size = 'default' }: QuantityStepperProps) {
  const isSmall = size === 'sm'
  const buttonSize = isSmall ? 'h-12 w-14 text-2xl' : 'h-16 w-20 text-4xl'
  const displaySize = isSmall ? 'h-12 text-3xl' : 'h-16 text-5xl'

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        className={cn(
          'bg-card hover:bg-muted active:bg-secondary text-foreground font-bold rounded-l-xl border-2 border-border transition-all transform active:scale-95 disabled:opacity-40 disabled:active:scale-100',
          buttonSize
        )}
      >
        −
      </button>

      <div className={cn('flex-1 bg-background border-y-2 border-border flex items-center justify-center', displaySize)}>
        <span className="font-bold text-foreground">{value || 0}</span>
      </div>

      <button
        type="button"
        onClick={() => value < max && onChange(value + 1)}
        disabled={value >= max}
        className={cn(
          'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-foreground font-bold rounded-r-xl border-2 border-blue-500 transition-all transform active:scale-95 shadow-lg shadow-blue-500/30 disabled:opacity-40 disabled:active:scale-100',
          buttonSize
        )}
      >
        +
      </button>
    </div>
  )
}
