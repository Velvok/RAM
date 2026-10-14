'use client'

import { useState } from 'react'
import { CheckCircle2, Scissors, Gauge, Package, Ruler, AlertTriangle } from 'lucide-react'

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

  const pendingUnits = cutInfo.totalRequested - cutInfo.totalCut

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
                {cutInfo.isFullyCompleted ? 'Orden Completada' : 'Corte Parcial Confirmado'}
              </h3>
            </div>
          </div>
        </div>

        {/* Detalle del corte */}
        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="flex items-center gap-2.5 text-foreground">
            <Scissors size={16} className="shrink-0 text-muted-foreground" />
            <span>Cortadas: <strong className="font-mono tabular-nums">{cutInfo.quantityCut}</strong> unidades</span>
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Gauge size={16} className="shrink-0 text-muted-foreground" />
            <span>Progreso: <strong className="font-mono tabular-nums">{cutInfo.totalCut}/{cutInfo.totalRequested}</strong></span>
          </div>
          <div className="flex items-start gap-2.5 text-foreground">
            <Package size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>Material usado: <strong>{cutInfo.materialName}</strong></span>
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Ruler size={16} className="shrink-0 text-muted-foreground" />
            <span>Recorte generado: <strong className="font-mono tabular-nums">{cutInfo.remnantLength.toFixed(1)}m</strong></span>
          </div>
          {cutInfo.remnantLength > 0 && (
            <div className="flex items-center gap-2.5 text-success">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Stock de recorte actualizado</span>
            </div>
          )}
          {!cutInfo.isFullyCompleted && (
            <div className="flex items-center gap-2.5 text-warning">
              <AlertTriangle size={16} className="shrink-0" />
              <span>Pendientes: <strong className="font-mono tabular-nums">{pendingUnits}</strong> unidades</span>
            </div>
          )}
        </div>

        {/* Footer con botón */}
        <div className="px-6 py-4 flex items-center justify-end border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-success hover:bg-success/90 text-success-foreground rounded-lg font-medium text-sm transition-colors"
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
