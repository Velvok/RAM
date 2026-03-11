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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pedidos.map((pedido) => {
              const cutOrdersCount = pedido.cut_orders?.length || 0
              
              return (
                <div
                  key={pedido.id}
                  onClick={() => router.push(`/planta/pedidos/${pedido.id}`)}
                  className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 hover:border-blue-500 cursor-pointer transition-all p-6"
                >
                  {/* Header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white">
                      {pedido.order_number}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {new Date(pedido.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-slate-400 text-sm">Órdenes de Corte:</span>
                      <span className="text-white font-bold text-lg">{cutOrdersCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-slate-400 text-sm">Unidades:</span>
                      <span className="text-white font-bold">{cutOrdersCount}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
