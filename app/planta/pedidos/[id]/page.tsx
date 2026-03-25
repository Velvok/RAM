'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useError } from '@/components/error-modal'
import { useSuccess } from '@/components/success-modal'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Package } from 'lucide-react'

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

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedido()
  }, [router, pedidoId])

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
          
          <h1 className="text-2xl font-bold text-white mb-1">{pedido.order_number}</h1>
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
                  className={`w-full p-4 flex items-center justify-between ${
                    isPending ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'
                  } transition-colors`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {cutOrder.product?.name || 'Producto'}
                      </h3>
                      {isPending && (
                        isExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm text-slate-400">{cutOrder.cut_number}</p>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        (cutOrder.quantity_cut || 0) >= cutOrder.quantity_requested
                          ? 'bg-green-500/20 text-green-400'
                          : (cutOrder.quantity_cut || 0) > 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {cutOrder.quantity_cut || 0}/{cutOrder.quantity_requested} cortadas
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                      isCompleted
                        ? 'bg-green-500/20 text-green-400'
                        : isPendingConfirmation
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Completada
                        </>
                      ) : isPendingConfirmation ? (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          Confirmar Recogida
                        </>
                      ) : (
                        '🟡 Pendiente'
                      )}
                    </span>
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && isPending && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-700 pt-4">
                    {/* Sugerencia del Sistema */}
                    {cutSuggestions?.best && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">💡</span>
                          <h4 className="font-bold text-white">SUGERENCIA DEL SISTEMA</h4>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{cutSuggestions.best.type === 'remnant' ? '🔵' : '🟢'}</span>
                            <span className="font-semibold text-white">{cutSuggestions.best.name}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-400">Longitud:</span>
                              <span className="font-semibold ml-2 text-white">{cutSuggestions.best.length}m</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Desperdicio:</span>
                              <span className="font-semibold ml-2 text-orange-400">
                                {cutSuggestions.best.waste.toFixed(2)}m
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400">Ubicación:</span>
                              <span className="font-semibold ml-2 text-white">{cutSuggestions.best.location}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: cutSuggestions.best }))}
                          className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                            selectedMaterial?.id === cutSuggestions.best.id
                              ? 'bg-green-600 text-white'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          }`}
                        >
                          {selectedMaterial?.id === cutSuggestions.best.id ? '✓ Material Seleccionado' : '✓ Usar Este Material'}
                        </button>
                      </div>
                    )}

                    {/* Alternativas */}
                    {cutSuggestions?.alternatives && cutSuggestions.alternatives.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-white mb-2">Alternativas:</h5>
                        <ul className="space-y-1 text-sm">
                          {cutSuggestions.alternatives.map((alt: MaterialSuggestion) => (
                            <li key={alt.id} className="flex items-center gap-2 text-slate-300">
                              <span>{alt.type === 'remnant' ? '🔵' : '🟢'}</span>
                              <span>{alt.name}: {alt.length}m</span>
                              <span className="text-slate-500">(desperdicio: {alt.waste.toFixed(2)}m)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Selección Manual */}
                    <div className="border-t border-slate-700 pt-4">
                      <label className="block font-semibold text-white mb-2">
                        ✋ O selecciona manualmente:
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
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
                            {s.name} - {s.length}m (desperdicio: {s.waste.toFixed(2)}m)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cantidad a Cortar */}
                    <div>
                      <label className="block font-semibold text-white mb-2">
                        Cantidad a cortar:
                      </label>
                      <div className="mb-2 text-sm text-slate-300">
                        Pendientes: {cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)} unidades
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)}
                        placeholder={`Máximo ${cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)}`}
                        value={quantityInputs[cutOrder.id] || ''}
                        onChange={(e) => setQuantityInputs(prev => ({ ...prev, [cutOrder.id]: e.target.value }))}
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Puedes cortar parcialmente (ej: 8 de 10)
                      </p>
                    </div>

                    {/* Recorte Generado */}
                    <div>
                      <label className="block font-semibold text-white mb-2">
                        Recorte generado:
                      </label>
                      {selectedMaterial && (
                        <div className="mb-2 text-sm text-slate-300">
                          Calculado: {Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1)}m
                        </div>
                      )}
                      <input
                        type="number"
                        step="0.1"
                        placeholder={selectedMaterial ? `${Math.max(0, selectedMaterial.length - cutOrder.quantity_requested).toFixed(1)} m (auto)` : "0.0 m"}
                        value={remnantInputs[cutOrder.id] || ''}
                        onChange={(e) => setRemnantInputs(prev => ({ ...prev, [cutOrder.id]: e.target.value }))}
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Deja vacío para usar el cálculo automático
                      </p>
                    </div>

                    {/* Botón Confirmar */}
                    <button
                      onClick={() => handleConfirmCut(cutOrder)}
                      disabled={!selectedMaterial || isProcessing || !quantityInputs[cutOrder.id] || parseInt(quantityInputs[cutOrder.id]) <= 0}
                      className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-colors"
                    >
                      {isProcessing ? 'Procesando...' : `✓ Confirmar Corte (${quantityInputs[cutOrder.id] || 0} unidades)`}
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
