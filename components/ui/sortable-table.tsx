'use client'

import { useMemo, useState, type ReactNode, type ThHTMLAttributes } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ordenar tablas pinchando en el nombre de la columna (traído de Asentia-Demo):
// un clic ascendente, otro descendente y el tercero vuelve al orden original.
// Cada tabla dice con `accessors` por qué valor ordena cada columna (la fecha
// en ISO, la cantidad como número…), no por el texto que se ve en la celda.

export type SortDir = 'asc' | 'desc'
export type SortValue = string | number | boolean | null | undefined

export interface TableSort<K extends string> {
  key: K | null
  dir: SortDir
  toggle: (key: K) => void
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

const isEmpty = (v: SortValue) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))

/** Ordena `rows` según la columna elegida. Los vacíos van siempre al final. */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => SortValue>,
  initial: { key: K | null; dir: SortDir } = { key: null, dir: 'asc' },
): { sorted: T[]; sort: TableSort<K> } {
  const [state, setState] = useState<{ key: K | null; dir: SortDir }>(initial)

  const toggle = (key: K) =>
    setState((s) => {
      if (s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })

  // `accessors` suele ser un literal nuevo en cada render: solo importa la clave.
  const get = state.key ? accessors[state.key] : null
  const sorted = useMemo(() => {
    if (!get) return [...rows]
    const factor = state.dir === 'asc' ? 1 : -1
    return [...rows].sort((ra, rb) => {
      const a = get(ra)
      const b = get(rb)
      if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1
      return compareValues(a, b) * factor
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, state.key, state.dir])

  return { sorted, sort: { key: state.key, dir: state.dir, toggle } }
}

/** `<th>` clicable. Conserva las clases de la cabecera original. */
export function SortableTh<K extends string>({
  sort, sortKey, children, className, ...rest
}: {
  sort: TableSort<K>
  sortKey: K
  children: ReactNode
} & ThHTMLAttributes<HTMLTableCellElement>) {
  const active = sort.key === sortKey
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      {...rest}
    >
      <button
        type="button"
        onClick={() => sort.toggle(sortKey)}
        className={cn(
          'inline-flex cursor-pointer select-none items-center gap-1 transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground',
          active && 'text-foreground',
        )}
        style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
      >
        {children}
        {active && (sort.dir === 'asc'
          ? <ChevronUp size={12} strokeWidth={2} className="shrink-0" />
          : <ChevronDown size={12} strokeWidth={2} className="shrink-0" />)}
      </button>
    </th>
  )
}
