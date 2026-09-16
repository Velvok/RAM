'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Zap, Info, CheckCircle2, type LucideIcon } from 'lucide-react'

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

  const variantStyles: Record<string, { bg: string; icon: LucideIcon; iconBg: string; iconText: string }> = {
    danger: {
      bg: 'bg-red-600 hover:bg-red-500',
      icon: AlertTriangle,
      iconBg: 'bg-red-100',
      iconText: 'text-red-600'
    },
    warning: {
      bg: 'bg-yellow-600 hover:bg-yellow-500',
      icon: Zap,
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600'
    },
    info: {
      bg: 'bg-blue-600 hover:bg-blue-500',
      icon: Info,
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    success: {
      bg: 'bg-green-600 hover:bg-green-500',
      icon: CheckCircle2,
      iconBg: 'bg-green-100',
      iconText: 'text-green-600'
    }
  }

  const style = variantStyles[variant]
  const Icon = style.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header con icono */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className={`shrink-0 w-11 h-11 rounded-full ${style.iconBg} flex items-center justify-center`}>
              <Icon size={20} strokeWidth={1.75} className={style.iconText} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onCancel, 200)
            }}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onConfirm, 200)
            }}
            className={`px-4 py-2 ${style.bg} text-white text-sm rounded-lg font-medium transition-colors`}
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
