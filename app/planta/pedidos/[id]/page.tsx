'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useError } from '@/components/error-modal'
import { useSuccess } from '@/components/success-modal'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Package, Clock } from 'lucide-react'

// Tipo para sugerencias (mock)
interface MaterialSuggestion {
  type: 'remnant' | 'virgin'
  id: string
  name: string
  length: number
  waste: number
  location: string
  priority: number
}

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string
  const { showError, ErrorDialog } = useError()
  const { showSuccess, SuccessDialog } = useSuccess()

  const [operator, setOperator] = useState<any>(null)
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCutId, setExpandedCutId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, any>>({})
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, MaterialSuggestion>>({})
  const [remnantInputs, setRemnantInputs] = useState<Record<string, string>>({})
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({}) // Nueva: cantidad a cortar
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [currentTime, setCurrentTime] = useState('')
  const [showManualSelector, setShowManualSelector] = useState<Record<string, boolean>>({})
  const [showOtherOptions, setShowOtherOptions] = useState<Record<string, boolean>>({})
  const [showRemnantAdjust, setShowRemnantAdjust] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedido()
  }, [router, pedidoId])

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

  async function loadPedido() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          cut_orders:cut_orders!cut_orders_order_id_fkey(
            *,
            product:products!cut_orders_product_id_fkey(*),
            assigned_operator:users!cut_orders_assigned_to_fkey(*),
            reassigned_from_order:orders!cut_orders_reassigned_from_order_id_fkey(order_number)
          )
        `)
        .eq('id', pedidoId)
        .single()

      if (error) throw error
      setPedido(data)
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleCutOrder(cutOrderId: string, productId: string, lengthNeeded: number) {
    if (expandedCutId === cutOrderId) {
      setExpandedCutId(null)
      return
    }

    setExpandedCutId(cutOrderId)
    
    // Establecer cantidad máxima por defecto
    const cutOrder = pedido?.cut_orders?.find((co: any) => co.id === cutOrderId)
    if (cutOrder) {
      const maxQuantity = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
      setQuantityInputs(prev => ({ ...prev, [cutOrderId]: maxQuantity.toString() }))
    }

    // Cargar sugerencias reales de stock
    if (!suggestions[cutOrderId]) {
      try {
        const supabase = createClient()
        
        // Obtener la orden de corte
        const { data: cutOrder } = await supabase
          .from('cut_orders')
          .select(`
            *,
            product:products!cut_orders_product_id_fkey(*),
            assigned_product:products!cut_orders_material_base_id_fkey(*)
          `)
          .eq('id', cutOrderId)
          .single()

        let bestSuggestion: MaterialSuggestion | null = null
        let alternatives: MaterialSuggestion[] = []

        // Si hay stock asignado, usarlo como sugerencia principal
        if (cutOrder?.material_base_id && cutOrder?.material_base_quantity) {
          // Buscar el inventory item del producto asignado
          const { data: assignedInventory } = await supabase
            .from('inventory')
            .select('*, product:products(*)')
            .eq('product_id', cutOrder.material_base_id)
            .gt('stock_disponible', 0)
            .single()

          bestSuggestion = {
            type: 'virgin' as const,
            id: assignedInventory?.id || cutOrder.material_base_id,
            name: `${cutOrder.assigned_product?.code || 'Stock'} (${cutOrder.material_base_quantity}m)`,
            length: cutOrder.material_base_quantity,
            waste: Math.max(0, cutOrder.material_base_quantity - lengthNeeded),
            location: '✓ Asignado automáticamente',
            priority: 1,
          }
        }

        // Buscar alternativas disponibles del mismo tipo de producto (código base)
        // Primero obtener el código base del producto solicitado
        const baseCode = cutOrder?.product?.code?.match(/^([A-Z0-9]+)\./i)?.[1]
        
        if (baseCode) {
          // Buscar todos los productos con el mismo código base
          const { data: relatedProducts } = await supabase
            .from('products')
            .select('id, code, name')
            .ilike('code', `${baseCode}.%`)

          if (relatedProducts && relatedProducts.length > 0) {
            const productIds = relatedProducts.map(p => p.id)
            
            // Buscar stock disponible de estos productos
            const { data: availableStock } = await supabase
              .from('inventory')
              .select('*, product:products(*)')
              .in('product_id', productIds)
              .gt('stock_disponible', 0)
              .limit(10)

            if (availableStock) {
              // Extraer tamaño del código para cada pieza
              alternatives = availableStock
                .map(item => {
                  const sizeMatch = item.product?.code?.match(/\.(\d+),(\d+)$/)
                  const size = sizeMatch ? parseFloat(`${sizeMatch[1]}.${sizeMatch[2]}`) : item.stock_total
                  return {
                    type: 'virgin' as const,
                    id: item.id,
                    name: `${item.product?.code} (${size}m)`,
                    length: size,
                    waste: Math.max(0, size - lengthNeeded),
                    location: `${item.stock_disponible} disponibles`,
                    priority: 2,
                  }
                })
                .filter(item => item.length >= lengthNeeded) // Solo mostrar piezas suficientemente grandes
                .sort((a, b) => a.waste - b.waste) // Ordenar por menor desperdicio
            }
          }
        }

        // Combinar sugerencia principal y alternativas para el dropdown
        // Evitar duplicados: si bestSuggestion ya está en alternatives, no agregarlo de nuevo
        const allOptions = bestSuggestion 
          ? [bestSuggestion, ...alternatives.filter(alt => alt.id !== bestSuggestion.id)]
          : alternatives

        const suggestion = {
          best: bestSuggestion || {
            type: 'virgin' as const,
            id: 'no-stock',
            name: 'Sin stock asignado',
            length: 0,
            waste: 0,
            location: 'No disponible',
            priority: 99,
          },
          alternatives,
          all: allOptions
        }
        setSuggestions(prev => ({ ...prev, [cutOrderId]: suggestion }))
        setSelectedMaterials(prev => ({ ...prev, [cutOrderId]: suggestion.best }))
      } catch (error) {
        console.error('Error loading stock suggestions:', error)
      }
    }
  }

  async function handleConfirmCut(cutOrder: any) {
    const cutId = cutOrder.id
    const selectedMaterial = selectedMaterials[cutId]

    if (!selectedMaterial) {
      showError('Por favor selecciona un material', 'Material no seleccionado')
      return
    }

    // Verificar si hay stock físico disponible
    const supabase = createClient()
    const { data: stockCheck } = await supabase
      .from('inventory')
      .select('stock_disponible, stock_total')
      .eq('id', selectedMaterial.id)
      .single()

    if (stockCheck && stockCheck.stock_disponible < 0) {
      showError(
        `No hay stock físico disponible para esta chapa.\n\nStock disponible: ${stockCheck.stock_disponible} unidades\n\nContacta con el administrador para resolver el problema de stock.`,
        '⚠️ Stock no disponible'
      )
      return
    }
    
    // Calcular recorte automáticamente
    const materialLength = selectedMaterial.length // Tamaño del material usado (ej: 3m)
    const quantityNeeded = cutOrder.quantity_requested // Cantidad solicitada (ej: 0.5m)
    const calculatedRemnant = Math.max(0, materialLength - quantityNeeded)
    
    // Permitir override manual si el operario ingresó un valor
    const remnantLength = remnantInputs[cutId] 
      ? parseFloat(remnantInputs[cutId]) 
      : calculatedRemnant
    
    console.log(`📏 Cálculo de recorte:`)
    console.log(`   Material usado: ${materialLength}m`)
    console.log(`   Cantidad cortada: ${quantityNeeded}m`)
    console.log(`   Recorte calculado: ${calculatedRemnant}m`)
    console.log(`   Recorte final: ${remnantLength}m`)

    setProcessing(prev => ({ ...prev, [cutId]: true }))
    
    try {
      const supabase = createClient()
      
      // Importar funciones necesarias
      const { finishCutOrder } = await import('@/app/actions/cut-orders')
      
      // Obtener el product_id del inventory seleccionado
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('product_id')
        .eq('id', selectedMaterial.id)
        .single()
      
      if (!inventoryItem) {
        throw new Error('No se encontró el producto en el inventario')
      }
      
      // Verificar si el material seleccionado es diferente al asignado originalmente
      const originalAssignedId = cutOrder.material_base_id
      const selectedProductId = inventoryItem.product_id
      
      // 1a. Si se seleccionó un material diferente, liberar la reserva original
      if (originalAssignedId && originalAssignedId !== selectedProductId) {
        console.log(`⚠️ Material cambiado: ${originalAssignedId} → ${selectedProductId}`)
        
        // Liberar reserva del material asignado originalmente
        const { data: originalInventory } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', originalAssignedId)
          .gt('stock_reservado', 0)
          .single()
        
        if (originalInventory) {
          const { unreserveStock } = await import('@/app/actions/stock-management')
          await unreserveStock(originalInventory.id, 1)
          console.log(`✅ Reserva liberada del material original`)
        }
        
        // Reservar el nuevo material seleccionado
        const { reserveStock } = await import('@/app/actions/stock-management')
        await reserveStock(selectedMaterial.id)
        console.log(`✅ Nuevo material reservado`)
      }
      
      // 1b. Si se cambió el material, actualizar la asignación en cut_orders
      if (originalAssignedId && originalAssignedId !== selectedProductId) {
        const { assignStockToCutOrder } = await import('@/app/actions/stock-management')
        await assignStockToCutOrder(
          cutId,
          selectedMaterial.id,
          selectedProductId,
          selectedMaterial.length
        )
        console.log(`✅ Stock asignado actualizado en la orden de corte`)
      }
      
      // NOTA: El stock permanece RESERVADO hasta que se entregue el pedido
      // NO se mueve a "en_proceso" ni se consume al cortar
      
      // 2. Obtener cantidad a cortar (puede ser parcial)
      const quantityToCut = parseInt(quantityInputs[cutId] || '0')
      const newQuantityCut = (cutOrder.quantity_cut || 0) + quantityToCut
      const isFullyCompleted = newQuantityCut >= cutOrder.quantity_requested
      
      // Actualizar quantity_cut en la orden
      await supabase
        .from('cut_orders')
        .update({
          quantity_cut: newQuantityCut,
          status: isFullyCompleted ? 'completada' : 'pendiente',
          finished_at: isFullyCompleted ? new Date().toISOString() : null
        })
        .eq('id', cutId)
      
      console.log(`✅ Cortadas ${quantityToCut} unidades (${newQuantityCut}/${cutOrder.quantity_requested})`)
      
      // 2b. Actualizar estado del pedido (puede pasar a 'en_corte' si hay cortes parciales)
      const { updateOrderStatus } = await import('@/app/actions/orders')
      await updateOrderStatus(cutOrder.order_id)
      
      // 3. Si hay recorte, validar que existe el producto ANTES de consumir stock
      if (remnantLength > 0) {
        const { generateRemnantStock } = await import('@/app/actions/stock-management')
        
        // Obtener el código del producto usado
        const { data: usedProduct } = await supabase
          .from('products')
          .select('code')
          .eq('id', inventoryItem.product_id)
          .single()
        
        if (usedProduct) {
          // IMPORTANTE: Esto lanzará error si no existe el producto
          // y bloqueará el corte ANTES de consumir stock
          await generateRemnantStock(usedProduct.code, remnantLength)
          console.log(`✅ Recorte de ${remnantLength}m generado en stock`)
        }
      }
      
      // 4. El stock permanece reservado hasta que se marque el pedido como entregado
      // NO se consume aquí, solo se mantiene la reserva
      console.log(`📌 Stock permanece reservado hasta la entrega del pedido`)
      
      // 5. Registrar actividad en el historial del pedido
      await supabase.from('order_activity_log').insert({
        order_id: cutOrder.order_id,
        cut_order_id: cutId,
        activity_type: 'cut_completed',
        description: `${operator?.name || 'Operario'} cortó ${quantityToCut} unidad${quantityToCut !== 1 ? 'es' : ''} de ${cutOrder.product?.name || 'producto'} (${newQuantityCut}/${cutOrder.quantity_requested})`,
        metadata: {
          action: `Corte ${isFullyCompleted ? 'completado' : 'parcial'}`,
          operator_name: operator?.name,
          quantity_cut: quantityToCut,
          total_cut: newQuantityCut,
          total_requested: cutOrder.quantity_requested,
          material_used: selectedMaterial.name,
          remnant_generated: remnantLength,
          is_completed: isFullyCompleted
        }
      })
      console.log(`📝 Actividad registrada en el historial`)
      
      // Mostrar confirmación con modal personalizado
      const successLines = [
        `✂️ Cortadas: ${quantityToCut} unidades`,
        `📊 Progreso: ${newQuantityCut}/${cutOrder.quantity_requested}`,
        ``,
        `📦 Material usado:`,
        `   ${selectedMaterial.name}`,
        ``,
        `📏 Recorte generado:`,
        `   ${remnantLength.toFixed(1)}m`,
      ]
      
      if (remnantLength > 0) {
        successLines.push(``)
        successLines.push(`✅ Stock de recorte actualizado`)
      }
      
      if (!isFullyCompleted) {
        successLines.push(``)
        successLines.push(`⚠️ Pendientes: ${cutOrder.quantity_requested - newQuantityCut} unidades`)
      }
      
      showSuccess(
        successLines.join('\n'), 
        isFullyCompleted ? '✓ Orden Completada' : '✓ Corte Parcial Confirmado'
      )
      
      // Recargar pedido y limpiar inputs
      await loadPedido()
      setExpandedCutId(null)
      setQuantityInputs(prev => ({ ...prev, [cutId]: '' }))
      
    } catch (error: any) {
      console.error('Error finishing cut:', error)
      
      // Extraer mensaje de error más amigable
      let errorMessage = 'Error desconocido'
      let errorTitle = 'Error al finalizar corte'
      
      if (error.message) {
        errorMessage = error.message
        
        // Detectar tipo de error para personalizar título
        if (error.message.includes('No existe el producto')) {
          errorTitle = 'Producto de recorte no encontrado'
        } else if (error.message.includes('foreign key')) {
          errorTitle = 'Error de base de datos'
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error.code) {
        errorMessage = `Error de base de datos: ${error.code}`
        errorTitle = 'Error de base de datos'
      }
      
      // Mostrar modal de error personalizado
      showError(errorMessage, errorTitle)
    } finally {
      setProcessing(prev => ({ ...prev, [cutId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Pedido no encontrado</h2>
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
          >
            Volver a pedidos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header Sticky */}
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Volver</span>
          </button>
          
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-white">{pedido.order_number}</h1>
            
            {/* Reloj */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-base font-mono font-semibold text-white">
                {currentTime}
              </span>
            </div>
          </div>
          
          {operator && (
            <p className="text-slate-400">Operario: <span className="text-white font-semibold">{operator.full_name}</span></p>
          )}
        </div>
      </div>

      {/* Lista de Órdenes de Corte */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {pedido.cut_orders && pedido.cut_orders.length > 0 ? (
          pedido.cut_orders.map((cutOrder: any) => {
            const isExpanded = expandedCutId === cutOrder.id
            const isPending = cutOrder.status === 'pendiente'
            const isCompleted = cutOrder.status === 'completada'
            const isPendingConfirmation = cutOrder.status === 'pendiente_confirmacion'
            const cutSuggestions = suggestions[cutOrder.id]
            const selectedMaterial = selectedMaterials[cutOrder.id]
            const isProcessing = processing[cutOrder.id]

            return (
              <div
                key={cutOrder.id}
                className={`rounded-lg border-2 transition-all ${
                  isCompleted
                    ? 'bg-slate-800/50 border-green-500'
                    : isPendingConfirmation
                    ? 'bg-orange-900/30 border-orange-500'
                    : isExpanded
                    ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/70 border-slate-600'
                }`}
              >
                {/* Header de la tarjeta */}
                <button
                  onClick={() => isPending && toggleCutOrder(cutOrder.id, cutOrder.product_id, cutOrder.quantity_requested)}
                  disabled={isCompleted}
                  className={`w-full p-6 ${
                    isPending ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'
                  } transition-colors`}
                >
                  <div className="space-y-4">
                    {/* Fila 1: Título y Estado */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <h3 className="text-3xl font-bold text-white leading-tight">
                          {cutOrder.product?.name || 'Producto'}
                        </h3>
                        {isPending && (
                          isExpanded ? <ChevronUp className="w-6 h-6 text-blue-400 flex-shrink-0" /> : <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      
                      {/* Badge de Estado */}
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-bold flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-500/20 text-green-400'
                          : isPendingConfirmation
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            Completada
                          </>
                        ) : isPendingConfirmation ? (
                          <>
                            <AlertTriangle className="w-5 h-5" />
                            Confirmar Recogida
                          </>
                        ) : (
                          '🟡 Pendiente'
                        )}
                      </span>
                    </div>
                    
                    {/* Fila 2: Código de corte */}
                    <p className="text-base text-slate-400 font-medium text-left">{cutOrder.cut_number}</p>
                    
                    {/* Fila 3: Barra de Progreso */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Progreso</span>
                        <span className="text-white font-bold text-lg">
                          {cutOrder.quantity_cut || 0}/{cutOrder.quantity_requested}
                        </span>
                      </div>
                      
                      {/* Barra de progreso visual */}
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            (cutOrder.quantity_cut || 0) >= cutOrder.quantity_requested
                              ? 'bg-green-500'
                              : (cutOrder.quantity_cut || 0) > 0
                              ? 'bg-yellow-500'
                              : 'bg-slate-600'
                          }`}
                          style={{ 
                            width: `${Math.min(((cutOrder.quantity_cut || 0) / cutOrder.quantity_requested) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && isPending && (
                  <div className="px-6 pb-6 space-y-6 border-t border-slate-700 pt-6">
                    {/* BLOQUE A: Sugerencia del Sistema (Happy Path) */}
                    {cutSuggestions?.best && (
                      <div className={`rounded-2xl p-6 shadow-lg transition-all ${
                        selectedMaterial?.id === cutSuggestions.best.id
                          ? 'bg-green-600/20 border-2 border-green-500 shadow-green-500/30'
                          : 'bg-slate-800/50 border-2 border-blue-500 shadow-blue-500/20'
                      }`}>
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <h4 className="text-xl font-bold text-white uppercase">Sugerencia del Sistema</h4>
                        </div>
                        
                        <div className="bg-slate-900/70 rounded-xl p-5 space-y-3 mb-6">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-white">{cutSuggestions.best.name}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-base">
                            <div>
                              <span className="text-slate-400">Longitud:</span>
                              <span className="font-bold ml-2 text-white text-xl">{cutSuggestions.best.length}m</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Desperdicio:</span>
                              <span className={`font-bold ml-2 text-xl ${
                                cutSuggestions.best.waste > 0 ? 'text-orange-400' : 'text-green-400'
                              }`}>
                                {cutSuggestions.best.waste.toFixed(2)}m
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: cutSuggestions.best }))
                            setShowOtherOptions(prev => ({ ...prev, [cutOrder.id]: false }))
                          }}
                          className={`w-full h-20 rounded-2xl text-xl font-bold uppercase transition-all transform active:scale-95 mt-2 ${
                            selectedMaterial?.id === cutSuggestions.best.id
                              ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/40 border-2 border-green-500/50'
                          }`}
                        >
                          {selectedMaterial?.id === cutSuggestions.best.id ? 'Material Seleccionado' : 'Utilizar Sugerencia'}
                        </button>
                      </div>
                    )}

                    {/* BLOQUE B: Alternativas y Selector Manual (Recuadro Colapsable) */}
                    {((cutSuggestions?.alternatives && cutSuggestions.alternatives.length > 0) || (cutSuggestions?.all && cutSuggestions.all.length > 0)) && (
                      <div className="bg-slate-800/50 border-2 border-slate-600 rounded-2xl shadow-lg overflow-hidden">
                        {/* Título Clickeable */}
                        <button
                          onClick={() => setShowOtherOptions(prev => ({ ...prev, [cutOrder.id]: !prev[cutOrder.id] }))}
                          className="w-full p-6 hover:bg-slate-800/70 transition-all flex items-center justify-center gap-3"
                        >
                          <h5 className="text-xl font-bold text-white uppercase">Otras Opciones</h5>
                          <span className="text-xl text-white">{showOtherOptions[cutOrder.id] ? '▼' : '▶'}</span>
                        </button>
                        
                        {/* Contenido Expandible */}
                        {showOtherOptions[cutOrder.id] && (
                          <div className="px-6 pb-6 space-y-6 animate-in slide-in-from-top duration-300">
                            {/* Grid de 3 alternativas */}
                            {cutSuggestions?.alternatives && cutSuggestions.alternatives.length > 0 && (
                              <div className="grid grid-cols-3 gap-4">
                                {cutSuggestions.alternatives.slice(0, 3).map((alt: MaterialSuggestion) => (
                                  <button
                                    key={alt.id}
                                    onClick={() => setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: alt }))}
                                    className={`p-6 rounded-xl border-2 transition-all transform active:scale-95 ${
                                      selectedMaterial?.id === alt.id
                                        ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/30'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="text-center space-y-2">
                                      <div className="text-2xl font-bold text-white">{alt.length}m</div>
                                      <div className="text-sm text-slate-400">Desp: {alt.waste.toFixed(2)}m</div>
                                      <div className="text-xs text-slate-500 truncate">{alt.name}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Selector Manual Colapsable */}
                            {cutSuggestions?.all && cutSuggestions.all.length > 0 && (
                              <div className="border-t border-slate-700 pt-4">
                                <button
                                  onClick={() => {
                                    setShowManualSelector(prev => ({ ...prev, [cutOrder.id]: !prev[cutOrder.id] }))
                                  }}
                                  className="w-full h-16 bg-slate-700 border-2 border-slate-600 rounded-xl text-lg font-bold text-white hover:bg-slate-600 transition-all flex items-center justify-center gap-3"
                                >
                                  <span>Seleccionar Otro Material</span>
                                  <span className="text-xl">{showManualSelector[cutOrder.id] ? '▼' : '▶'}</span>
                                </button>
                                
                                {showManualSelector[cutOrder.id] && (
                                  <div className="mt-4 space-y-3 animate-in slide-in-from-top duration-300">
                                    <select 
                                      id={`manual-select-${cutOrder.id}`}
                                      className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl text-white text-base"
                                      value={selectedMaterial?.id || ''}
                                      onChange={(e) => {
                                        const selected = cutSuggestions?.all.find((s: MaterialSuggestion) => s.id === e.target.value)
                                        if (selected) {
                                          setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: selected }))
                                        }
                                      }}
                                    >
                                      <option value="">Seleccionar material...</option>
                                      {cutSuggestions?.all.map((s: MaterialSuggestion) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name} - {s.length}m (desp: {s.waste.toFixed(2)}m)
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* BLOQUE C: Cantidad a Cortar (Stepper Industrial) */}
                    <div>
                      <label className="block text-lg font-bold text-white mb-3 uppercase">
                        Cantidad a Cortar:
                      </label>
                      <div className="mb-4 text-base text-slate-300 bg-slate-800/50 p-3 rounded-lg">
                        Pendientes: <span className="font-bold text-white text-xl">{cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)}</span> unidades
                      </div>
                      
                      {/* Stepper Industrial */}
                      <div className="flex items-center">
                        {/* Botón Menos */}
                        <button
                          onClick={() => {
                            const current = parseInt(quantityInputs[cutOrder.id] || '0')
                            if (current > 1) {
                              setQuantityInputs(prev => ({ ...prev, [cutOrder.id]: (current - 1).toString() }))
                            }
                          }}
                          className="h-16 w-20 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-4xl font-bold rounded-l-xl border-2 border-slate-700 transition-all transform active:scale-95"
                        >
                          −
                        </button>
                        
                        {/* Display Central */}
                        <div className="flex-1 h-16 bg-slate-900 border-y-2 border-slate-700 flex items-center justify-center">
                          <span className="text-5xl font-bold text-white">
                            {quantityInputs[cutOrder.id] || 0}
                          </span>
                        </div>
                        
                        {/* Botón Más */}
                        <button
                          onClick={() => {
                            const current = parseInt(quantityInputs[cutOrder.id] || '0')
                            const max = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
                            if (current < max) {
                              setQuantityInputs(prev => ({ ...prev, [cutOrder.id]: (current + 1).toString() }))
                            }
                          }}
                          className="h-16 w-20 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-4xl font-bold rounded-r-xl border-2 border-blue-500 transition-all transform active:scale-95 shadow-lg shadow-blue-500/30"
                        >
                          +
                        </button>
                      </div>
                      
                      <p className="text-sm text-slate-400 mt-3 text-center">
                        Usa los botones + y − para ajustar la cantidad
                      </p>
                    </div>

                    {/* BLOQUE D: Recorte Generado (Recuadro Colapsable) */}
                    {selectedMaterial && (
                      <div className="bg-slate-800/50 border-2 border-slate-600 rounded-2xl shadow-lg overflow-hidden">
                        {/* Título Clickeable con Cálculo Automático */}
                        <button
                          onClick={() => setShowRemnantAdjust(prev => ({ ...prev, [cutOrder.id]: !prev[cutOrder.id] }))}
                          className="w-full p-6 hover:bg-slate-800/70 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-xl font-bold text-white uppercase">Recorte Generado</h5>
                            <div className="flex items-center gap-3">
                              <span className="text-3xl font-bold text-white">
                                {remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1)}m
                              </span>
                              <span className="text-xl text-white">{showRemnantAdjust[cutOrder.id] ? '▼' : '▶'}</span>
                            </div>
                          </div>
                        </button>
                        
                        {/* Contenido Expandible - Ajuste Manual */}
                        {showRemnantAdjust[cutOrder.id] && (
                          <div className="px-6 pb-6 space-y-4 animate-in slide-in-from-top duration-300">
                            <div className="border-t border-slate-700 pt-4">
                              <label className="text-sm text-slate-400 mb-3 block">Ajuste manual (opcional):</label>
                              
                              {/* Stepper para Recorte */}
                              <div className="flex items-center">
                                {/* Botón Menos */}
                                <button
                                  onClick={() => {
                                    const current = parseFloat(remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1))
                                    const newValue = Math.max(0, current - 0.5)
                                    setRemnantInputs(prev => ({ ...prev, [cutOrder.id]: newValue.toFixed(1) }))
                                  }}
                                  className="h-14 w-16 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white text-3xl font-bold rounded-l-xl border-2 border-slate-700 transition-all transform active:scale-95"
                                >
                                  −
                                </button>
                                
                                {/* Display Central */}
                                <div className="flex-1 h-14 bg-slate-950 border-y-2 border-slate-700 flex items-center justify-center">
                                  <span className="text-4xl font-bold text-white">
                                    {remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1)}m
                                  </span>
                                </div>
                                
                                {/* Botón Más */}
                                <button
                                  onClick={() => {
                                    const current = parseFloat(remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1))
                                    const newValue = current + 0.5
                                    setRemnantInputs(prev => ({ ...prev, [cutOrder.id]: newValue.toFixed(1) }))
                                  }}
                                  className="h-14 w-16 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-3xl font-bold rounded-r-xl border-2 border-slate-600 transition-all transform active:scale-95"
                                >
                                  +
                                </button>
                              </div>
                              
                              <p className="text-xs text-slate-400 mt-3 text-center">
                                Ajusta en incrementos de 0.5m
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botón Confirmar - GIGANTE */}
                    <button
                      onClick={() => handleConfirmCut(cutOrder)}
                      disabled={!selectedMaterial || isProcessing || !quantityInputs[cutOrder.id] || parseInt(quantityInputs[cutOrder.id]) <= 0}
                      className="w-full h-20 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-2xl uppercase transition-all transform active:scale-95 shadow-lg shadow-green-500/30 disabled:shadow-none"
                    >
                      {isProcessing ? 'Procesando...' : `Confirmar Corte (${quantityInputs[cutOrder.id] || 0} unidades)`}
                    </button>
                  </div>
                )}

                {/* Contenido para pendiente de confirmación */}
                {isPendingConfirmation && (
                  <div className="px-4 pb-4 space-y-4 border-t border-orange-700 pt-4">
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-6 h-6 text-orange-400" />
                        <h4 className="font-bold text-white">RECOGER PIEZA REASIGNADA</h4>
                      </div>
                      
                      <div className="bg-slate-900/50 rounded-lg p-4 space-y-3 mb-4">
                        <p className="text-white">
                          Esta pieza ha sido reasignada desde otro pedido. Debes recogerla de:
                        </p>
                        <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3">
                          <p className="text-sm text-slate-400">Pedido Origen:</p>
                          <p className="text-lg font-bold text-orange-400">
                            {cutOrder.reassigned_from_order?.order_number || 'Cargando...'}
                          </p>
                        </div>
                        <div className="text-sm text-slate-300">
                          <p>📦 Material: <strong>{cutOrder.product?.code}</strong></p>
                          <p>📏 Cantidad: <strong>{cutOrder.quantity_requested}m</strong></p>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const { confirmReassignmentPickup } = await import('@/app/actions/confirm-reassignment')
                            await confirmReassignmentPickup(cutOrder.id)
                            showSuccess('✅ Recogida confirmada correctamente')
                            // Recargar pedido completo
                            await loadPedido()
                          } catch (error: any) {
                            showError(error.message || 'Error al confirmar recogida')
                          }
                        }}
                        className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-lg transition-colors"
                      >
                        ✓ Confirmar que Recogí la Pieza
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-12 border border-slate-700 text-center">
            <p className="text-slate-400 text-lg">
              No hay órdenes de corte para este pedido
            </p>
          </div>
        )}
      </div>
      
      {/* Modales */}
      <ErrorDialog />
      <SuccessDialog />
    </div>
  )
}
