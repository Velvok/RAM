import { cn } from '@/lib/utils'
import { formatMeters } from '@/lib/planta-tasks'
import { sheetLayouts } from '@/lib/sheet-plan'

// Plano de corte: la chapa dibujada a escala solo con las piezas que se van a
// cortar y, con borde punteado, el trozo que sobra. El texto va fuera de la
// barra (largo de la chapa arriba, leyenda abajo) para que no se amontone.
// Lo usan la oficina (asignar chapa) y la tablet (tarjeta de corte y cambio de chapa).

const TONES = {
  admin: {
    gap: 'gap-[18px]',
    count: 'text-base text-foreground',
    top: 'text-xs text-muted-foreground',
    bar: 'h-10 gap-[3px]',
    seg: 'rounded-md text-sm',
    piece: 'bg-primary text-primary-foreground',
    rest: 'border-warning bg-warning/15 text-warning text-xs',
    legend: 'text-[13px] text-foreground',
    swPiece: 'bg-primary',
    swRest: 'border-warning',
    restText: 'text-warning',
    okText: 'text-success',
    miniPiece: 'bg-primary',
    miniRest: 'bg-warning/15 outline-warning',
  },
  planta: {
    gap: 'gap-[22px]',
    count: 'text-[26px] text-[#f1f5f9]',
    top: 'text-[15px] text-[#94a3b8]',
    bar: 'h-16 gap-[3px]',
    seg: 'rounded-lg text-[22px]',
    piece: 'bg-[#f59e0b] text-[#0b1220]',
    rest: 'border-[#7dd3fc] bg-[#10263d] text-[#7dd3fc] text-lg',
    legend: 'text-[17px] text-[#cbd5e1]',
    swPiece: 'bg-[#f59e0b]',
    swRest: 'border-[#7dd3fc]',
    restText: 'text-[#7dd3fc]',
    okText: 'text-[#4ade80]',
    miniPiece: 'bg-[#f59e0b]',
    miniRest: 'bg-[#10263d] outline-[#7dd3fc]',
  },
} as const

type Variant = keyof typeof TONES

export function SheetPlan({ sheetLength, pieceLength, pieces, variant = 'admin', className }: {
  sheetLength: number
  pieceLength: number
  /** Piezas que se cortan de esta chapa (no las que caben) */
  pieces: number
  variant?: Variant
  className?: string
}) {
  const layouts = sheetLayouts(sheetLength, pieceLength, pieces)
  if (!layouts.length) return null
  const t = TONES[variant]
  const multi = layouts.length > 1 || layouts.some(l => l.count > 1)
  return (
    <div className={cn('flex flex-col', t.gap, className)}>
      {layouts.map((l, i) => (
        <div key={i} className="flex items-center gap-3.5">
          {multi && <span className={cn('shrink-0 whitespace-nowrap pt-1 font-extrabold tabular-nums', t.count)}>{l.count} ×</span>}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Cota con el largo de la chapa */}
            <div className={cn('flex items-center gap-2.5 whitespace-nowrap border-x border-current/40 font-semibold', t.top)}>
              <span className="h-px flex-1 bg-current opacity-40" />
              Chapa de {formatMeters(sheetLength)}
              <span className="h-px flex-1 bg-current opacity-40" />
            </div>
            <div className={cn('flex', t.bar)} aria-hidden>
              {Array.from({ length: l.pieces }, (_, j) => (
                <span key={j} style={{ flex: pieceLength }} className={cn('flex min-w-0 items-center justify-center overflow-hidden font-extrabold tabular-nums', t.seg, t.piece)}>
                  {l.pieces <= 14 ? j + 1 : ''}
                </span>
              ))}
              {l.leftover > 0.009 && (
                <span style={{ flex: l.leftover }} className={cn('flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap border-2 border-dashed font-extrabold tabular-nums', t.seg, t.rest)}>
                  {l.leftover / sheetLength > 0.16 ? formatMeters(l.leftover) : ''}
                </span>
              )}
            </div>
            <div className={cn('flex flex-wrap justify-between gap-x-6 gap-y-1.5', t.legend)}>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className={cn('h-3.5 w-3.5 shrink-0 rounded', t.swPiece)} />
                <span><b>{l.pieces} {l.pieces === 1 ? 'pieza' : 'piezas'}</b> de {formatMeters(pieceLength)}</span>
              </span>
              {l.leftover > 0.009 ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className={cn('h-3.5 w-3.5 shrink-0 rounded border-2 border-dashed', t.swRest)} />
                  <span><b className={t.restText}>Sobra {formatMeters(l.leftover)}</b> · va al estante</span>
                </span>
              ) : (
                <b className={t.okText}>Sin sobrante</b>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Miniatura sin texto de la última chapa de un corte, para comparar opciones de un vistazo. */
export function SheetMini({ sheetLength, pieceLength, pieces, variant = 'admin', className }: {
  sheetLength: number
  pieceLength: number
  pieces: number
  variant?: Variant
  className?: string
}) {
  const l = sheetLayouts(sheetLength, pieceLength, pieces).slice(-1)[0]
  if (!l) return null
  const t = TONES[variant]
  return (
    <div className={cn('flex gap-0.5', variant === 'planta' ? 'h-3.5' : 'h-2.5', className)} aria-hidden>
      {Array.from({ length: l.pieces }, (_, j) => <span key={j} style={{ flex: pieceLength }} className={cn('min-w-0 rounded-[3px]', t.miniPiece)} />)}
      {l.leftover > 0.009 && <span style={{ flex: l.leftover }} className={cn('min-w-0 rounded-[3px] outline-dashed outline-[1.5px] -outline-offset-[1.5px]', t.miniRest)} />}
    </div>
  )
}
