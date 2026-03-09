'use client'

import { useState, useEffect } from 'react'
import { getCutOrderById } from '@/app/actions/cut-orders'
import { useRouter } from 'next/navigation'

export default function CutOrderActions({ cutOrder: initialCutOrder }: { cutOrder: any }) {
  const [cutOrder, setCutOrder] = useState(initialCutOrder)
  const router = useRouter()

  useEffect(() => {
    setCutOrder(initialCutOrder)
  }, [initialCutOrder])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Información de la Orden
      </h3>

      <div className="space-y-4">
        {/* Estado Visual */}
        {cutOrder.status === 'lanzada' && (
          <div className="px-4 py-3 bg-yellow-100 text-yellow-800 rounded-lg">
            <div className="font-semibold text-center">🚀 Orden Lanzada</div>
            <div className="text-sm font-normal mt-2 text-center">
              Disponible para todos los operarios
            </div>
          </div>
        )}

        {cutOrder.status === 'en_proceso' && (
          <div className="px-4 py-3 bg-blue-100 text-blue-800 rounded-lg">
            <div className="font-semibold text-center">⚙️ En Proceso</div>
            {cutOrder.assigned_operator && (
              <div className="text-sm font-normal mt-2 text-center">
                Operario: <span className="font-semibold">{cutOrder.assigned_operator.full_name}</span>
              </div>
            )}
          </div>
        )}

        {cutOrder.status === 'completada' && (
          <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg">
            <div className="font-semibold text-center">✓ Completada</div>
            <div className="text-sm font-normal mt-1 text-center">
              Cortado: {cutOrder.quantity_cut} kg
            </div>
          </div>
        )}

        {cutOrder.status === 'cancelada' && (
          <div className="px-4 py-3 bg-red-100 text-red-800 rounded-lg">
            <div className="font-semibold text-center">✕ Cancelada</div>
          </div>
        )}
      </div>

      {/* Información Detallada */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Detalles de la Orden
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Estado:</span>
            <span className="text-slate-900 font-semibold capitalize">
              {cutOrder.status}
            </span>
          </div>
          
          {cutOrder.assigned_operator && (
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-slate-600">Operario Asignado:</span>
              <span className="text-blue-900 font-semibold">
                {cutOrder.assigned_operator.full_name}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Cantidad Solicitada:</span>
            <span className="text-slate-900 font-semibold">
              {cutOrder.quantity_requested} kg
            </span>
          </div>

          {cutOrder.quantity_cut && (
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Cantidad Cortada:</span>
              <span className="text-slate-900 font-semibold">
                {cutOrder.quantity_cut} kg
              </span>
            </div>
          )}

          {cutOrder.started_at && (
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Iniciado:</span>
              <span className="text-slate-900 font-semibold">
                {new Date(cutOrder.started_at).toLocaleString('es-ES')}
              </span>
            </div>
          )}

          {cutOrder.completed_at && (
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Completado:</span>
              <span className="text-slate-900 font-semibold">
                {new Date(cutOrder.completed_at).toLocaleString('es-ES')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> La asignación de operarios se realiza automáticamente cuando el operario 
          inicia el corte desde su tablet.
        </p>
      </div>
    </div>
  )
}
