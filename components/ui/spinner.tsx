import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
  size?: number
  label?: string
}

export function Spinner({ className, size = 20, label }: SpinnerProps) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function PageLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center">
      <Spinner size={24} label={label} />
    </div>
  )
}
