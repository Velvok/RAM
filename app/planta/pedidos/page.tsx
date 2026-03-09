'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCutOrders } from '@/app/actions/cut-orders'

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadOrders()
  }, [router])

  async function loadOrders() {
    try {
      // Mostrar TODAS las órdenes lanzadas
      const data = await getCutOrders('lanzada')
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('operator')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Órdenes de Corte</h1>
            <p className="text-slate-300 mt-1">
              Operario: {operator?.full_name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-12 border border-slate-700 text-center">
            <svg className="mx-auto h-16 w-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">
              No hay órdenes disponibles
            </h3>
            <p className="text-slate-400">
              No hay órdenes de corte disponibles en este momento
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orders.map((order: any) => (
              <div
                key={order.id}
                onClick={() => router.push(`/planta/ordenes/${order.id}`)}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700 hover:border-blue-500 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {order.cut_number}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Pedido: {order.order?.order_number}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold">
                    {order.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Producto:</span>
                    <span className="text-white font-semibold">
                      {order.product?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cantidad:</span>
                    <span className="text-white font-semibold">
                      {order.quantity_requested} kg
                    </span>
                  </div>
                  {order.assigned_operator && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Asignado a:</span>
                      <span className="text-yellow-400 font-semibold">
                        {order.assigned_operator.full_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700">
                  <button className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    order.assigned_operator 
                      ? 'bg-yellow-600 hover:bg-yellow-500' 
                      : 'bg-blue-600 hover:bg-blue-500'
                  } text-white`}>
                    {order.assigned_operator ? 'Ver Orden Asignada →' : 'Iniciar Corte →'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
