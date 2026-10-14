'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Select } from './select'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  itemLabel?: string
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  itemsPerPageOptions?: number[]
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  itemLabel = 'resultados',
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <Select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value))
                onPageChange(0)
              }}
              className="h-8 w-20 py-0 text-sm"
            >
              {itemsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Mostrando {totalItems === 0 ? 0 : currentPage * itemsPerPage + 1} -{' '}
          {Math.min((currentPage + 1) * itemsPerPage, totalItems)} de {totalItems} {itemLabel}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="rounded-md p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i).map((page) => {
              if (
                page === 0 ||
                page === totalPages - 1 ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={cn(
                      'rounded-md px-3 py-1 text-sm',
                      page === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {page + 1}
                  </button>
                )
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span key={page} className="text-muted-foreground">
                    ...
                  </span>
                )
              }
              return null
            })}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="rounded-md p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}
