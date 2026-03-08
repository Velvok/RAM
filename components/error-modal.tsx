'use client'

import { useState, useEffect } from 'react'

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-500 animate-in zoom-in duration-200">
        {/* Header con icono de error */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white">
                {title}
              </h3>
              <p className="mt-3 text-base text-slate-300 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer con botón */}
        <div className="p-6 bg-slate-900/50 rounded-b-2xl">
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onClose, 200)
            }}
            className="w-full px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
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

  const handleClose = () => {
    setConfig(prev => ({ ...prev, isOpen: false }))
  }

  const ErrorDialog = () => (
    <ErrorModal
      isOpen={config.isOpen}
      title={config.title}
      message={config.message}
      onClose={handleClose}
    />
  )

  return { showError, ErrorDialog }
}
