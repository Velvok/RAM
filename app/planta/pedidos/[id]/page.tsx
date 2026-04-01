'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useError } from '@/components/error-modal'
import { useCutSuccess } from '@/components/cut-success-modal'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Package, Clock, Truck } from 'lucide-react'

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
  const { showCutSuccess, hideCutSuccess, CutSuccessDialog } = useCutSuccess()

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
  const [markingAsDelivered, setMarkingAsDelivered] = useState(false)
  const [undoingDelivery, setUndoingDelivery] = useState(false)

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
          client:clients!orders_client_id_fkey(*),
          cut_orders:cut_orders!cut_orders_order_id_fkey(
            *,
            product:products!cut_orders_product_id_fkey(*),
            material_product:products!cut_orders_material_base_id_fkey(*),
            assigned_operator:users!cut_orders_assigned_to_fkey(*),
            reassigned_from_order:orders!cut_orders_reassigned_from_order_id_fkey(order_number),
            sub_orders:cut_orders!parent_cut_order_id(
              *,
              product:products!cut_orders_product_id_fkey(*),
              material_product:products!cut_orders_material_base_id_fkey(*)
            )
          )
        `)
        .eq('id', pedidoId)
        .single()

      if (error) {
        console.error('Error en consulta de pedido:', error)
        throw error
      }
      
      console.log('📋 Datos del pedido cargados:', data)
      console.log('👤 Cliente del pedido:', data.client)
      setPedido(data)
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAsDelivered() {
    if (!pedido) return
    
    // Verificar que todas las órdenes estén completadas
    const allCompleted = pedido.cut_orders?.every((co: any) => 
      co.status === 'completada' && (co.quantity_cut || 0) >= co.quantity_requested
    )
    
    if (!allCompleted) {
      showError('No se puede marcar como entregado: hay órdenes pendientes de completar', 'Error')
      return
    }
    
    setMarkingAsDelivered(true)
    
    try {
      const { markOrderAsDelivered } = await import('@/app/actions/orders')
      await markOrderAsDelivered(pedido.id)
      
      // Recargar el pedido para ver el nuevo estado
      await loadPedido()
      
      // Mostrar mensaje de éxito
      alert('¡Pedido marcado como entregado correctamente!')
      
    } catch (error: any) {
      console.error('Error marcando como entregado:', error)
      showError(error?.message || 'No se pudo marcar el pedido como entregado', 'Error')
    } finally {
      setMarkingAsDelivered(false)
    }
  }

  async function handleUndoDelivery() {
    if (!pedido) return
    
    const confirmed = confirm(
      '¿Estás seguro de deshacer esta entrega?\n\n' +
      'Esta acción restaurará el stock consumido y revertirá el estado del pedido. Solo se puede hacer dentro de las primeras 24 horas.'
    )
    
    if (!confirmed) return
    
    setUndoingDelivery(true)
    
    try {
      const { undoOrderDelivery } = await import('@/app/actions/orders')
      await undoOrderDelivery(pedido.id)
      
      // Recargar el pedido para ver el nuevo estado
      await loadPedido()
      
      // Mostrar mensaje de éxito
      alert('¡Entrega deshecha correctamente! El stock ha sido restaurado.')
      
    } catch (error: any) {
      console.error('Error deshaciendo entrega:', error)
      showError(error?.message || 'No se pudo deshacer la entrega', 'Error')
    } finally {
      setUndoingDelivery(false)
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
    
    // Calcular si es un corte real o solo consumo de stock exacto
    const materialLength = selectedMaterial.length // Tamaño del material usado (ej: 6.5m)
    const quantityToCut = parseInt(quantityInputs[cutId] || '0') // Cantidad de unidades a cortar (ej: 3)
    const productSize = cutOrder.product?.length_meters || 
                       parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                       cutOrder.quantity_requested // Tamaño de cada pieza (ej: 4.5m)
    
    // Determinar si es un MATCH EXACTO o un CORTE REAL
    const isExactMatch = Math.abs(materialLength - productSize) < 0.01 // Tolerancia de 1cm
    const remnantPerSheet = Math.max(0, materialLength - productSize)
    const sheetsUsed = quantityToCut // 1 chapa por pieza
    
    if (!quantityToCut || quantityToCut <= 0) {
      showError('Por favor ingresa una cantidad válida', 'Cantidad inválida')
      return
    }

    if (!operator) {
      showError('No se ha identificado el operario', 'Operario no identificado')
      return
    }

    setProcessing(prev => ({ ...prev, [cutId]: true }))
    
    try {
      // ✅ Llamar a la Server Action - todos los logs saldrán en el terminal del servidor
      const { processCutOrder } = await import('@/app/actions/cut-operations')
      
      const result = await processCutOrder({
        cutOrderId: cutId,
        selectedMaterialId: selectedMaterial.id,
        materialLength: selectedMaterial.length,
        quantityToCut,
        operatorId: operator.id
      })
      
      // Recargar pedido
      await loadPedido()
      
      // Revalidar
      try {
        await fetch(`/api/revalidate?path=/planta/pedidos/${pedidoId}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/admin/pedidos/${pedido.id}`, { method: 'POST' })
      } catch (e) {
        console.log('Revalidación manual fallida')
      }
      
      // Limpiar inputs
      setExpandedCutId(null)
      setQuantityInputs(prev => ({ ...prev, [cutId]: '' }))
      setSelectedMaterials(prev => {
        const newState = { ...prev }
        delete newState[cutId]
        return newState
      })
      
      // Mostrar confirmación
      showCutSuccess({
        quantityCut: quantityToCut,
        totalCut: result.newQuantityCut,
        totalRequested: result.totalRequested,
        materialName: selectedMaterial.name,
        remnantLength: 0,
        isFullyCompleted: result.isFullyCompleted
      })
      
    } catch (error: any) {
      console.error('Error finishing cut:', error)
      showError(error.message || 'Error desconocido', 'Error al finalizar corte')
    } finally {
      setProcessing(prev => ({ ...prev, [cutId]: false }))
    }
    return // ⚠️ SALIR AQUÍ - El código viejo de abajo ya no se ejecuta
    
    try {
      const supabase = createClient()
      
      // ========== CÓDIGO VIEJO - YA NO SE EJECUTA ==========
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
      const selectedProductId = inventoryItem?.product_id
      
      // 1a. Si se seleccionó un material diferente, liberar la reserva original
      if (originalAssignedId && selectedProductId && originalAssignedId !== selectedProductId) {
        console.log(`⚠️ Material cambiado: ${originalAssignedId} → ${selectedProductId}`)
        
        // Liberar reserva del material asignado originalmente
        const { data: originalInventory } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', originalAssignedId)
          .gt('stock_reservado', 0)
          .single()
        
        if (originalInventory?.id) {
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
      if (originalAssignedId && selectedProductId && originalAssignedId !== selectedProductId) {
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
      
      // 3. PROCESO DE STOCK: Diferenciar entre match exacto y corte real
      const { generateRemnantStock, reserveStock } = await import('@/app/actions/stock-management')
      
      if (isExactMatch) {
        // ========== MATCH EXACTO: Solo consumir stock reservado ==========
        console.log(`🎯 Procesando match exacto: ${sheetsUsed} unidades de ${materialLength}m`)
        
        for (let i = 0; i < sheetsUsed; i++) {
          console.log(`\n📦 Consumiendo unidad ${i + 1}/${sheetsUsed}:`)
          
          // Usar la función SQL consume_reserved_stock que baja total Y reservado
          const { error: consumeError } = await supabase.rpc('consume_reserved_stock', {
            p_inventory_id: selectedMaterial.id
          })
          
          if (consumeError) {
            console.error('Error al consumir stock reservado:', consumeError)
            throw consumeError
          }
          
          console.log(`   ✅ Consumida: -1 unidad de ${materialLength}m (total y reservado)`)
        }
        
        console.log(`\n✅ Proceso completado: ${sheetsUsed} unidades consumidas`)
        console.log(`   📉 Stock: -${sheetsUsed} × ${materialLength}m`)
        
      } else {
        // ========== CORTE REAL: Consumir, generar pieza cortada y remanente ==========
        // Obtener códigos de productos
        const { data: usedProduct } = await supabase
          .from('products')
          .select('code')
          .eq('id', inventoryItem?.product_id)
          .single()
        
        if (!usedProduct?.code) {
          throw new Error('No se encontró el producto usado')
        }
        
        console.log(`✂️ Procesando corte real de ${sheetsUsed} chapas...`)
        console.log(`   Chapa original: ${usedProduct.code} (${materialLength}m)`)
        console.log(`   Pieza a obtener: ${productSize}m`)
        console.log(`   Remanente: ${remnantPerSheet}m`)
        
        // Por cada chapa usada:
        for (let i = 0; i < sheetsUsed; i++) {
          console.log(`\n📦 Procesando chapa ${i + 1}/${sheetsUsed}:`)
          
          // 3.1. Consumir chapa original (baja total y reservado)
          const { error: consumeError } = await supabase.rpc('consume_reserved_stock', {
            p_inventory_id: selectedMaterial.id
          })
          
          if (consumeError) {
            console.error('Error al consumir stock reservado:', consumeError)
            throw consumeError
          }
          
          console.log(`   ✅ Consumida: -1 chapa de ${materialLength}m (total y reservado)`)
          
          // 3.2. Generar pieza cortada (sube total y generado)
          await generateRemnantStock(usedProduct.code, productSize)
          console.log(`   ✅ Generada: +1 pieza de ${productSize}m`)
          
          // 3.3. Reservar la pieza cortada (sube reservado)
          const { data: cutPieceInventory } = await supabase
            .from('inventory')
            .select('id')
            .eq('product_id', cutOrder.product_id)
            .single()
          
          if (cutPieceInventory?.id) {
            await reserveStock(cutPieceInventory.id)
            console.log(`   ✅ Reservada: +1 pieza de ${productSize}m`)
          }
          
          // 3.4. Generar remanente (si existe) y dejarlo disponible
          if (remnantPerSheet > 0) {
            await generateRemnantStock(usedProduct.code, remnantPerSheet)
            console.log(`   ✅ Remanente: +1 pieza de ${remnantPerSheet}m (disponible)`)
          }
        }
        
        console.log(`\n✅ Proceso completado: ${sheetsUsed} chapas cortadas`)
        console.log(`   📉 Chapas originales: -${sheetsUsed} × ${materialLength}m`)
        console.log(`   📈 Piezas cortadas: +${sheetsUsed} × ${productSize}m (generadas y reservadas)`)
        if (remnantPerSheet > 0) {
          console.log(`   📈 Remanentes: +${sheetsUsed} × ${remnantPerSheet}m (disponibles)`)
        }
      }
      
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
          remnant_per_sheet: remnantPerSheet,
          sheets_used: sheetsUsed,
          total_remnants: sheetsUsed,
          is_completed: isFullyCompleted
        }
      })
      console.log(`📝 Actividad registrada en el historial`)
      
      // Mostrar confirmación con modal personalizado
      const successLines = [
        `✂️ Cortadas: ${quantityToCut} unidades`,
        `📊 Progreso: ${newQuantityCut}/${cutOrder.quantity_requested}`,
        ``,
        `📦 Material: ${selectedMaterial.name}`,
        ``,
      ]
      
      if (remnantPerSheet > 0) {
        successLines.push(`📏 Recortes generados:`)
        successLines.push(`   ${sheetsUsed} × ${remnantPerSheet.toFixed(1)}m = ${(sheetsUsed * remnantPerSheet).toFixed(1)}m total`)
        successLines.push(``)
        successLines.push(`✅ Stock de recortes actualizado`)
      }
      
      if (!isFullyCompleted) {
        successLines.push(``)
        successLines.push(`⚠️ Pendientes: ${cutOrder.quantity_requested - newQuantityCut} unidades`)
      }
      
      // Recargar el pedido completo desde la BD para actualizar el estado
      await loadPedido()
      
      // Forzar revalidación del lado del servidor
      try {
        await fetch(`/api/revalidate?path=/planta/pedidos/${pedidoId}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/admin/pedidos/${pedido.id}`, { method: 'POST' })
      } catch (e) {
        console.log('Revalidación manual fallida, pero el pedido se recargó')
      }
      
      // Limpiar inputs
      setExpandedCutId(null)
      setQuantityInputs(prev => ({ ...prev, [cutId]: '' }))
      setSelectedMaterials(prev => {
        const newState = { ...prev }
        delete newState[cutId]
        return newState
      })
      
      // Mostrar confirmación con la nueva modal (sin bucle)
      showCutSuccess({
        quantityCut: quantityToCut,
        totalCut: newQuantityCut,
        totalRequested: cutOrder.quantity_requested,
        materialName: selectedMaterial.name,
        remnantLength: remnantPerSheet * sheetsUsed,
        isFullyCompleted: isFullyCompleted
      })
      
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
            <div>
              <h1 className="text-2xl font-bold text-white">{pedido.order_number}</h1>
              {pedido.client ? (
                <p className="text-slate-400 text-sm mt-1">
                  Cliente: <span className="text-white font-semibold">{pedido.client.business_name || 'Sin nombre'}</span>
                </p>
              ) : (
                <p className="text-slate-400 text-sm mt-1">
                  Cliente: <span className="text-white font-semibold">No disponible</span>
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Botón Marcar como Entregado */}
              {pedido.status === 'finalizado' && (
                <button
                  onClick={handleMarkAsDelivered}
                  disabled={markingAsDelivered}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg border border-blue-500 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Truck className="w-4 h-4" />
                  {markingAsDelivered ? 'Entregando...' : 'Entregado'}
                </button>
              )}
              
              {/* Botón Deshacer Entrega */}
              {pedido.status === 'entregado' && (
                <button
                  onClick={handleUndoDelivery}
                  disabled={undoingDelivery}
                  className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg border border-orange-500 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {undoingDelivery ? 'Deshaciendo...' : 'Deshacer'}
                </button>
              )}
              
              {/* Reloj */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-base font-mono font-semibold text-white">
                  {currentTime}
                </span>
              </div>
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
          // Filtrar solo órdenes principales (sin parent_cut_order_id)
          pedido.cut_orders.filter((co: any) => !co.parent_cut_order_id).map((cutOrder: any) => {
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
                  onClick={() => isPending && toggleCutOrder(cutOrder.id, cutOrder.product_id, cutOrder.product?.length_meters || 0)}
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
                    
                    {/* Material asignado (visible siempre) */}
                    {cutOrder.material_product && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-lg">📦</span>
                        <span className="text-slate-400">Material:</span>
                        <span className="text-white font-bold">{cutOrder.material_product.name}</span>
                      </div>
                    )}
                    
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
                                {(() => {
                                  const quantityToCut = parseInt(quantityInputs[cutOrder.id] || '0')
                                  const productSize = cutOrder.product?.length_meters || parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') || cutOrder.quantity_requested
                                  const totalNeeded = productSize * quantityToCut
                                  return (remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - totalNeeded).toFixed(1))
                                })()}m
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
                                    const quantityToCut = parseInt(quantityInputs[cutOrder.id] || '0')
                                    const productSize = cutOrder.product?.length_meters || parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') || cutOrder.quantity_requested
                                    const totalNeeded = productSize * quantityToCut
                                    const current = parseFloat(remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - totalNeeded).toFixed(1))
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
                                    {(() => {
                                      const quantityToCut = parseInt(quantityInputs[cutOrder.id] || '0')
                                      const productSize = cutOrder.product?.length_meters || parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') || cutOrder.quantity_requested
                                      const totalNeeded = productSize * quantityToCut
                                      return (remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - totalNeeded).toFixed(1))
                                    })()}m
                                  </span>
                                </div>
                                
                                {/* Botón Más */}
                                <button
                                  onClick={() => {
                                    const quantityToCut = parseInt(quantityInputs[cutOrder.id] || '0')
                                    const productSize = cutOrder.product?.length_meters || parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') || cutOrder.quantity_requested
                                    const totalNeeded = productSize * quantityToCut
                                    const current = parseFloat(remnantInputs[cutOrder.id] || Math.max(0, selectedMaterial.length - totalNeeded).toFixed(1))
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

                    {/* Botón de confirmación de cambio de material (si se seleccionó un material diferente) */}
                    {(() => {
                      // Verificar si el material seleccionado es diferente al asignado
                      // Necesitamos comparar por nombre o código ya que selectedMaterial.id es inventory_id
                      const isMaterialDifferent = selectedMaterial && 
                        cutOrder.material_product && 
                        !selectedMaterial.name.includes(cutOrder.material_product.code) &&
                        selectedMaterial.name !== cutOrder.material_product.name
                      
                      return isMaterialDifferent && (
                        <div className="bg-orange-500/10 border-2 border-orange-500 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <AlertTriangle className="w-6 h-6 text-orange-400" />
                          <h4 className="text-lg font-bold text-orange-400 uppercase">Cambio de Material Detectado</h4>
                        </div>
                        <p className="text-white mb-4">
                          Has seleccionado un material diferente al asignado originalmente. ¿Deseas confirmar este cambio?
                        </p>
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <span className="text-slate-400">Material original:</span>
                            <p className="font-bold text-white">{cutOrder.material_product?.name}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <span className="text-slate-400">Nuevo material:</span>
                            <p className="font-bold text-orange-400">{selectedMaterial.name}</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const supabase = createClient()
                              const { assignStockToCutOrder } = await import('@/app/actions/stock-management')
                              
                              // Obtener el product_id del nuevo material
                              const { data: newInventory } = await supabase
                                .from('inventory')
                                .select('product_id')
                                .eq('id', selectedMaterial.id)
                                .single()
                              
                              if (newInventory) {
                                // Asignar el nuevo material
                                await assignStockToCutOrder(
                                  cutOrder.id,
                                  selectedMaterial.id,
                                  newInventory.product_id,
                                  selectedMaterial.length
                                )
                                
                                // Recargar el pedido
                                await loadPedido()
                                
                                alert('✅ Material cambiado correctamente')
                              }
                            } catch (error: any) {
                              console.error('Error al cambiar material:', error)
                              alert('❌ Error al cambiar material: ' + error.message)
                            }
                          }}
                          className="w-full h-16 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xl uppercase transition-all transform active:scale-95"
                        >
                          Confirmar Cambio de Material
                        </button>
                      </div>
                      )
                    })()}

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
                            // Para confirmación de reasignación, mostramos un mensaje simple
                            alert('✅ Recogida confirmada correctamente')
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

                {/* Subórdenes (si existen) - Mostradas al final del contenido expandido */}
                {cutOrder.sub_orders && cutOrder.sub_orders.length > 0 && (
                  <div className="border-t-4 border-slate-600 bg-slate-900/50 mt-4">
                    <div className="px-6 py-3 bg-slate-800/50">
                      <h4 className="text-sm font-bold text-slate-400 uppercase">↳ Subórdenes de corte ({cutOrder.sub_orders.length})</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      {cutOrder.sub_orders.map((subOrder: any) => {
                        const isSubExpanded = expandedCutId === subOrder.id
                        const isSubPending = subOrder.status === 'pendiente'
                        const isSubCompleted = subOrder.status === 'completada'
                        const isSubProcessing = processing[subOrder.id]

                        // Calcular remanente si tiene material asignado
                        // Remanente = Material asignado - Tamaño de la pieza a cortar
                        const subMaterialLength = subOrder.material_product?.length_meters || 0
                        const subProductSize = subOrder.product?.length_meters || 0
                        const subRemnant = subMaterialLength > 0 && subProductSize > 0 
                          ? (subMaterialLength - subProductSize).toFixed(1)
                          : null

                        return (
                          <div
                            key={subOrder.id}
                            className={`rounded-lg border-2 transition-all ${
                              isSubCompleted
                                ? 'bg-slate-800/30 border-green-500/50'
                                : isSubExpanded
                                ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/20'
                                : 'bg-slate-800/50 border-slate-600'
                            }`}
                          >
                            {/* Header de la suborden */}
                            <button
                              onClick={() => isSubPending && toggleCutOrder(subOrder.id, subOrder.product_id, subOrder.product?.length_meters || 0)}
                              disabled={isSubCompleted}
                              className={`w-full p-4 ${
                                isSubPending ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'
                              } transition-colors`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs text-slate-500">{subOrder.cut_number}</span>
                                    {isSubPending && (
                                      isSubExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    isSubCompleted ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'
                                  }`}>
                                    {isSubCompleted ? '✅ Completada' : '🟡 Pendiente'}
                                  </span>
                                </div>

                                {subOrder.material_product && (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">📦 Material:</span>
                                      <span className="text-sm text-blue-400 font-semibold">
                                        {subOrder.material_product.name}
                                      </span>
                                    </div>
                                    {subRemnant && parseFloat(subRemnant) > 0 && (
                                      <span className="text-xs text-orange-400 font-semibold">
                                        📏 Remanente: {subRemnant}m
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Progreso</span>
                                    <span className="text-white font-bold">
                                      {subOrder.quantity_cut || 0}/{subOrder.quantity_requested}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        (subOrder.quantity_cut || 0) >= subOrder.quantity_requested
                                          ? 'bg-green-500'
                                          : (subOrder.quantity_cut || 0) > 0
                                          ? 'bg-yellow-500'
                                          : 'bg-slate-600'
                                      }`}
                                      style={{ 
                                        width: `${Math.min(((subOrder.quantity_cut || 0) / subOrder.quantity_requested) * 100, 100)}%` 
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* Contenido expandido de la suborden */}
                            {isSubExpanded && isSubPending && (
                              <div className="px-4 pb-4 space-y-4 border-t border-slate-700 pt-4">
                                {/* Información del material y remanente */}
                                {subOrder.material_product && (
                                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-slate-400">Material asignado:</span>
                                        <p className="font-bold text-white text-base">{subOrder.material_product.name}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Longitud:</span>
                                        <p className="font-bold text-white text-base">{subMaterialLength}m</p>
                                      </div>
                                      {subRemnant && parseFloat(subRemnant) > 0 && (
                                        <>
                                          <div>
                                            <span className="text-slate-400">Remanente generado:</span>
                                            <p className="font-bold text-orange-400 text-base">{subRemnant}m</p>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">Desperdicio:</span>
                                            <p className={`font-bold text-base ${
                                              parseFloat(subRemnant) > 1 ? 'text-orange-400' : 'text-green-400'
                                            }`}>
                                              {parseFloat(subRemnant) > 1 ? 'Alto' : 'Bajo'}
                                            </p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-base font-bold text-white mb-2 uppercase">
                                    Cantidad a Cortar:
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={subOrder.quantity_requested - (subOrder.quantity_cut || 0)}
                                    value={quantityInputs[subOrder.id] || ''}
                                    onChange={(e) => setQuantityInputs(prev => ({ ...prev, [subOrder.id]: e.target.value }))}
                                    className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl text-white text-2xl font-bold text-center"
                                    placeholder="0"
                                  />
                                </div>

                                <button
                                  onClick={() => handleConfirmCut(subOrder)}
                                  disabled={!quantityInputs[subOrder.id] || parseInt(quantityInputs[subOrder.id]) < 1 || isSubProcessing}
                                  className="w-full h-20 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold text-2xl rounded-2xl transition-all transform active:scale-95 shadow-lg uppercase"
                                >
                                  {isSubProcessing ? 'Procesando...' : '✂️ Confirmar Corte'}
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
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
      <CutSuccessDialog />
    </div>
  )
}
