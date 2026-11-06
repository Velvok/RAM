'use client'

import {
  Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Selector de la app (traído de Asentia-Demo y adaptado a los tokens de RAM).
// Se usa exactamente como un <select> nativo (hijos <option>, value, onChange
// con e.target.value), pero abre un desplegable propio: mismo aspecto en todos
// los navegadores, buscador a partir de 9 opciones y navegación con teclado.

/** Aspecto único de los campos de formulario compactos (selects e inputs de filtros). */
export const FIELD_CLS =
  'h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm text-foreground transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50'

/** Panel desplegable compartido. */
export const MENU_CLS =
  'z-[60] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl'
export const MENU_ITEM_CLS =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40'

/** A partir de cuántas opciones se ofrece buscar. */
const BUSCAR_DESDE = 9

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Clases del contenedor (ancho, márgenes). */
  wrapperClassName?: string
}

interface Opcion {
  value: string
  label: ReactNode
  texto: string
  disabled: boolean
}

function textoDe(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textoDe).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textoDe(node.props.children)
  return ''
}

function leerOpciones(children: ReactNode): Opcion[] {
  const out: Opcion[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      out.push(...leerOpciones((child as ReactElement<{ children?: ReactNode }>).props.children))
      return
    }
    if (child.type !== 'option') return
    const p = (child as ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>).props
    const texto = textoDe(p.children)
    out.push({ value: String(p.value ?? texto), label: p.children, texto, disabled: !!p.disabled })
  })
  return out
}

export function SelectField({
  wrapperClassName, className, children, value, defaultValue, onChange, disabled, id, title, name,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby,
}: SelectFieldProps) {
  const opciones = useMemo(() => leerOpciones(children), [children])
  const [interno, setInterno] = useState(String(defaultValue ?? ''))
  const actualValue = value !== undefined ? String(value) : interno
  // Como el <select> nativo: si el valor no está entre las opciones, se ve la primera.
  const actual = opciones.find((o) => o.value === actualValue) ?? opciones[0]

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const conBuscador = opciones.length >= BUSCAR_DESDE
  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? opciones.filter((o) => o.texto.toLowerCase().includes(q)) : opciones
  }, [opciones, search])

  useEffect(() => {
    if (!open) return
    setSearch('')
    setActivo(Math.max(0, opciones.findIndex((o) => o.value === actual?.value)))
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activo, open])

  const elegir = (o: Opcion) => {
    if (o.disabled) return
    setOpen(false)
    if (o.value === actualValue) return
    if (value === undefined) setInterno(o.value)
    onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } } as unknown as ChangeEvent<HTMLSelectElement>)
  }

  const mover = (paso: number) => {
    if (filtradas.length === 0) return
    let i = activo
    for (let n = 0; n < filtradas.length; n++) {
      i = (i + paso + filtradas.length) % filtradas.length
      if (!filtradas[i].disabled) break
    }
    setActivo(i)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActivo(0) }
    else if (e.key === 'End') { e.preventDefault(); setActivo(filtradas.length - 1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtradas[activo]
      if (o) elegir(o)
    }
  }

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={id}
            title={title}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            aria-haspopup="listbox"
            aria-expanded={open}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true) }
            }}
            className={cn(FIELD_CLS, 'truncate text-left', className)}
          >
            {actual?.label ?? ' '}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            onKeyDown={onKeyDown}
            onOpenAutoFocus={(e) => {
              // Sin buscador, el foco va a la lista para moverse con las flechas.
              if (!conBuscador) { e.preventDefault(); listRef.current?.focus() }
            }}
            className={cn(MENU_CLS, 'min-w-[var(--radix-popover-trigger-width)] max-w-[min(440px,calc(100vw-16px))]')}
          >
            {conBuscador && (
              <input
                autoFocus
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActivo(0) }}
                placeholder="Buscar"
                aria-label="Buscar opción"
                className={cn(FIELD_CLS, 'mb-1.5 h-9 pr-3')}
              />
            )}
            <div ref={listRef} role="listbox" tabIndex={-1} className="max-h-72 overflow-auto focus:outline-none">
              {filtradas.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Sin resultados.</p>}
              {filtradas.map((o, i) => {
                const elegida = o.value === actual?.value
                return (
                  <button
                    key={`${o.value}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={elegida}
                    data-idx={i}
                    disabled={o.disabled}
                    tabIndex={-1}
                    onClick={() => elegir(o)}
                    onMouseMove={() => activo !== i && setActivo(i)}
                    className={cn(MENU_ITEM_CLS, i === activo && 'bg-primary/10', elegida && 'font-medium')}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {elegida && <Check size={14} className="shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ChevronDown
        size={14}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
