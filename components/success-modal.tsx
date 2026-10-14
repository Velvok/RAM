'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface SuccessModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
}

export default function SuccessModal({
  isOpen,
  title = '¡Éxito!',
  message,
  onClose
}: SuccessModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
    } else {
      setShow(false)
    }
  }, [isOpen])

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header con icono de éxito */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 w-11 h-11 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 size={20} strokeWidth={1.75} className="text-success" />
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
            className="px-4 py-2 bg-success hover:bg-success/90 text-success-foreground rounded-lg font-medium text-sm transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook para usar el modal fácilmente
export function useSuccess() {
  const [config, setConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
  }>({
    isOpen: false,
    message: ''
  })

  const showSuccess = (message: string, title?: string) => {
    // Mostrar siempre el mensaje, sin importar si es repetido
    setConfig({
      isOpen: true,
      title: title || '¡Éxito!',
      message
    })
  }

  const handleClose = () => {
    setConfig({
      isOpen: false,
      title: undefined,
      message: ''
    })
  }

  const SuccessDialog = () => (
    <SuccessModal
      isOpen={config.isOpen}
      title={config.title}
      message={config.message}
      onClose={handleClose}
    />
  )

  return { showSuccess, SuccessDialog }
}
