'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, LogOut, Search, X, Clock } from 'lucide-react'

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedidos()
  }, [router])

  // Actualizar hora cada segundo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const argentinaTime = now.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      setCurrentTime(argentinaTime)
    }
    
    updateTime() // Actualizar inmediatamente
    const interval = setInterval(updateTime, 1000) // Actualizar cada segundo
    
    return () => clearInterval(interval)
  }, [])

  async function loadPedidos() {
    try {
      const supabase = createClient()
      
      console.log('🔍 Buscando pedidos en estados: aprobado, en_corte, finalizado')
      
      // Obtener pedidos aprobados, en_corte y finalizados con conteo de órdenes
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          cut_orders!cut_orders_order_id_fkey(id)
        `)
        .in('status', ['aprobado', 'en_corte', 'finalizado'])
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

  // Filtrar pedidos por búsqueda y estado
  const filteredPedidos = useMemo(() => {
    let filtered = pedidos
    
    // Filtro por estado
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }
    
    // Filtro por búsqueda de texto
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.order_number?.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [pedidos, statusFilter, searchQuery])

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
          <div className="flex items-center gap-3">
            {/* Reloj */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-lg font-mono font-semibold text-white">
                {currentTime}
              </span>
            </div>
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title="Buscar Pedido"
            >
              <Search className="w-6 h-6" />
            </button>
            <button
              onClick={handleLogout}
              className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sección de Búsqueda Desplegable */}
        {showSearchModal && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white">Buscar Pedido</h3>
              <button
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchQuery('')
                  setStatusFilter('todos')
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Buscador por texto - Fila 1 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Número de Pedido
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: PED-TEST-1234..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filtros por estado - Fila 2 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Estado del Pedido
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setStatusFilter('todos')}
                    className={`px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      statusFilter === 'todos'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setStatusFilter('aprobado')}
                    className={`px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      statusFilter === 'aprobado'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Aprobado
                  </button>
                  <button
                    onClick={() => setStatusFilter('en_corte')}
                    className={`px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      statusFilter === 'en_corte'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    En Corte
                  </button>
                  <button
                    onClick={() => setStatusFilter('finalizado')}
                    className={`px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      statusFilter === 'finalizado'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Finalizado
                  </button>
                </div>
              </div>
            </div>

            {/* Contador y limpiar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''} encontrado{filteredPedidos.length !== 1 ? 's' : ''}
              </p>
              {(searchQuery || statusFilter !== 'todos') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('todos')
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

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
                {filteredPedidos.map((pedido) => {
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
                            : pedido.status === 'en_corte'
                            ? 'bg-blue-900/50 text-blue-300'
                            : 'bg-green-900/50 text-green-300'
                        }`}>
                          {pedido.status === 'aprobado' ? 'Aprobado' : pedido.status === 'en_corte' ? 'En Corte' : 'Finalizado'}
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
