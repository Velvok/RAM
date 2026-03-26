'use client'

import { useState } from 'react'

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border-2 border-green-500">
        {/* Header con icono de éxito */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white">
                {cutInfo.isFullyCompleted ? '✓ Orden Completada' : '✓ Corte Parcial Confirmado'}
              </h3>
              <div className="mt-3 text-base text-slate-300 leading-relaxed font-mono">
                {successLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botón */}
        <div className="p-6 bg-slate-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
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
