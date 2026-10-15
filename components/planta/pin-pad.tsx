'use client'

import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  maxLength?: number
  disabled?: boolean
}

export function PinPad({ value, onChange, onClear, maxLength = 6, disabled }: PinPadProps) {
  const handleNumberClick = (num: string) => {
    if (value.length < maxLength) {
      onChange(value + num)
    }
  }

  const handleDelete = () => onChange(value.slice(0, -1))
  const handleClear = () => (onClear ? onClear() : onChange(''))

  return (
    <div>
      <div className="flex justify-center space-x-3 mb-6">
        {Array.from({ length: maxLength }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold',
              value.length > i
                ? 'bg-blue-500 border-blue-400 text-foreground'
                : 'bg-muted/50 border-border text-muted-foreground'
            )}
          >
            {value.length > i ? '•' : ''}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleNumberClick(num.toString())}
            disabled={disabled}
            className="h-20 text-3xl font-bold bg-muted hover:bg-secondary active:bg-secondary/80 text-foreground rounded-lg transition-colors disabled:opacity-50"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="h-20 text-lg font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors disabled:opacity-50"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => handleNumberClick('0')}
          disabled={disabled}
          className="h-20 text-3xl font-bold bg-muted hover:bg-secondary active:bg-secondary/80 text-foreground rounded-lg transition-colors disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled}
          className="h-20 flex items-center justify-center bg-warning hover:bg-warning/90 text-warning-foreground rounded-lg transition-colors disabled:opacity-50"
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  )
}
