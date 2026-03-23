'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package } from 'lucide-react'

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedidos()
  }, [router])

  async function loadPedidos() {
    try {
      const supabase = createClient()
      
      console.log('🔍 Buscando pedidos en estados: aprobado, en_corte')
      
      // Obtener pedidos aprobados y en_corte con conteo de órdenes
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          cut_orders!cut_orders_order_id_fkey(id)
        `)
        .in('status', ['aprobado', 'en_corte'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error en consulta:', error)
        throw error
      }
      
      console.log('✅ Pedidos encontrados:', data?.length || 0, data)
      setPedidos(data || [])
    } catch (error) {
      console.error('❌ Error loading pedidos:', error)
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
            <h1 className="text-3xl font-bold text-white">Pedidos</h1>
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

        {pedidos.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-12 border border-slate-700 text-center">
            <Package className="mx-auto h-16 w-16 text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No hay pedidos disponibles
            </h3>
            <p className="text-slate-400">
              No hay pedidos aprobados en este momento
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Órdenes de Corte
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {pedidos.map((pedido) => {
                  const cutOrdersCount = pedido.cut_orders?.length || 0
                  
                  return (
                    <tr
                      key={pedido.id}
                      onClick={() => router.push(`/planta/pedidos/${pedido.id}`)}
                      className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-white">{pedido.order_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-300">
                          {new Date(pedido.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-white">{cutOrdersCount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pedido.status === 'aprobado' 
                            ? 'bg-yellow-900/50 text-yellow-300' 
                            : 'bg-blue-900/50 text-blue-300'
                        }`}>
                          {pedido.status === 'aprobado' ? 'Aprobado' : 'En Corte'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
