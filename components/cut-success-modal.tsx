'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface CutSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  cutInfo: {
    quantityCut: number
    totalCut: number
    totalRequested: number
    materialName: string
    remnantLength: number
    isFullyCompleted: boolean
  }
}

export default function CutSuccessModal({ 
  isOpen, 
  onClose, 
  cutInfo 
}: CutSuccessModalProps) {
  if (!isOpen) return null

  const successLines = [
    `✂️ Cortadas: ${cutInfo.quantityCut} unidades`,
    `📊 Progreso: ${cutInfo.totalCut}/${cutInfo.totalRequested}`,
    ``,
    `📦 Material usado:`,
    `   ${cutInfo.materialName}`,
    ``,
    `📏 Recorte generado:`,
    `   ${cutInfo.remnantLength.toFixed(1)}m`,
  ]
  
  if (cutInfo.remnantLength > 0) {
    successLines.push(``)
    successLines.push(`✅ Stock de recorte actualizado`)
  }
  
  if (!cutInfo.isFullyCompleted) {
    successLines.push(``)
    successLines.push(`⚠️ Pendientes: ${cutInfo.totalRequested - cutInfo.totalCut} unidades`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-green-500/60 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header con icono de éxito */}
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 w-11 h-11 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={20} strokeWidth={1.75} className="text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">
                {cutInfo.isFullyCompleted ? 'Orden Completada' : 'Corte Parcial Confirmado'}
              </h3>
              <div className="mt-2 text-sm text-slate-300 leading-relaxed font-mono">
                {successLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botón */}
        <div className="px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook simple y robusto
export function useCutSuccess() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    cutInfo: CutSuccessModalProps['cutInfo'] | null
  }>({
    isOpen: false,
    cutInfo: null
  })

  const showCutSuccess = (cutInfo: CutSuccessModalProps['cutInfo']) => {
    setModalState({
      isOpen: true,
      cutInfo
    })
  }

  const hideCutSuccess = () => {
    setModalState({
      isOpen: false,
      cutInfo: null
    })
  }

  const CutSuccessDialog = () => {
    if (!modalState.cutInfo) return null
    return (
      <CutSuccessModal
        isOpen={modalState.isOpen}
        onClose={hideCutSuccess}
        cutInfo={modalState.cutInfo}
      />
    )
  }

  return { showCutSuccess, hideCutSuccess, CutSuccessDialog }
}
