'use client'

import { useState, useEffect } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'info' | 'success'
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'info'
}: ConfirmModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
    }
  }, [isOpen])

  if (!show) return null

  const variantStyles = {
    danger: {
      bg: 'bg-red-600 hover:bg-red-500',
      icon: '⚠️',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600'
    },
    warning: {
      bg: 'bg-yellow-600 hover:bg-yellow-500',
      icon: '⚡',
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600'
    },
    info: {
      bg: 'bg-blue-600 hover:bg-blue-500',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    success: {
      bg: 'bg-green-600 hover:bg-green-500',
      icon: '✓',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600'
    }
  }

  const style = variantStyles[variant]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
        {/* Header con icono */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center`}>
              <span className={`text-2xl ${style.iconText}`}>{style.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="p-6 bg-slate-50 rounded-b-xl flex space-x-3">
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onCancel, 200)
            }}
            className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onConfirm, 200)
            }}
            className={`flex-1 px-4 py-3 ${style.bg} text-white rounded-lg font-semibold transition-colors shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook para usar el modal fácilmente
export function useConfirm() {
  const [config, setConfig] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info' | 'success'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const confirm = (
    title: string,
    message: string,
    options?: {
      confirmText?: string
      cancelText?: string
      variant?: 'danger' | 'warning' | 'info' | 'success'
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({
        isOpen: true,
        title,
        message,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.variant,
        onConfirm: () => {
          setConfig(prev => ({ ...prev, isOpen: false }))
          resolve(true)
        }
      })
    })
  }

  const handleCancel = () => {
    setConfig(prev => ({ ...prev, isOpen: false }))
  }

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={config.isOpen}
      title={config.title}
      message={config.message}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      variant={config.variant}
      onConfirm={config.onConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialog }
}
