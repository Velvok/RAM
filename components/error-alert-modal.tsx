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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-700 whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
