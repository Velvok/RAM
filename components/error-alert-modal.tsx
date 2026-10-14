'use client'

import { AlertCircle, X } from 'lucide-react'

interface ErrorAlertModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
}

export default function ErrorAlertModal({ isOpen, onClose, title = 'Error', message }: ErrorAlertModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle size={18} strokeWidth={1.75} className="text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-red-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X size={18} strokeWidth={1.75} className="text-red-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
