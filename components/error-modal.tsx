'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
}

export default function ErrorModal({
  isOpen,
  title = 'Error',
  message,
  onClose
}: ErrorModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
    }
  }, [isOpen])

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header con icono de error */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={20} strokeWidth={1.75} className="text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer con botón */}
        <div className="px-6 py-4 flex items-center justify-end">
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onClose, 200)
            }}
            className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg font-medium text-sm transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook para usar el modal fácilmente
export function useError() {
  const [config, setConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
  }>({
    isOpen: false,
    message: ''
  })

  const showError = (message: string, title?: string) => {
    setConfig({
      isOpen: true,
      title: title || 'Error',
      message
    })
  }

  const handleClose = useCallback(() => {
    setConfig(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Memoizado: si se redefine en cada render, React lo trata como un componente
  // distinto y remonta el modal (reinicia su animación de entrada = parpadeo)
  // cada vez que el componente que llama a useError() se vuelve a renderizar.
  const ErrorDialog = useCallback(() => (
    <ErrorModal
      isOpen={config.isOpen}
      title={config.title}
      message={config.message}
      onClose={handleClose}
    />
  ), [config, handleClose])

  return { showError, ErrorDialog }
}
