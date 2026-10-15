'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Package, Clock, Truck, MessageSquare, RefreshCw } from 'lucide-react'
import { extractSizeFromName, extractSizeFromCode } from '@/lib/product-utils'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { QuantityStepper } from '@/components/planta/quantity-stepper'
import { Badge } from '@/components/ui/badge'
import { getCutOrderStatusConfig } from '@/lib/cut-order-status'

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
  const [showChangeStockModal, setShowChangeStockModal] = useState<Record<string, boolean>>({})
  const [availableStock, setAvailableStock] = useState<Record<string, any[]>>({})
  const [selectedStock, setSelectedStock] = useState<Record<string, any>>({})
  const [quantityToChange, setQuantityToChange] = useState<Record<string, number>>({})
  const [loadingStock, setLoadingStock] = useState<Record<string, boolean>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({}) 
  const [notes, setNotes] = useState<any[]>([])
  const [showNotes, setShowNotes] = useState(false)
  const [markingRead, setMarkingRead] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedido()
    loadNotes(pedidoId)
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
      const { getOrderById } = await import('@/app/actions/client-queries')
      const data = await getOrderById(params.id as string)
      setPedido(data)
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh para detectar cambios desde admin
  useAutoRefresh(pedidoId, async () => {
    const { getOrderById } = await import('@/app/actions/client-queries')
    return await getOrderById(pedidoId)
  }, {
    enabled: true,
    interval: 10, // Verificar cada 10 segundos
  })

  async function loadNotes(orderId: string) {
    try {
      const { getOrderNotes } = await import('@/app/actions/order-notes')
      const data = await getOrderNotes(orderId)
      setNotes(data)
    } catch (e) {
      console.error('Error loading notes:', e)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`order_notes_planta_${pedidoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_notes', filter: `order_id=eq.${pedidoId}` },
        () => loadNotes(pedidoId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pedidoId])

  async function handleMarkNoteRead(noteId: string) {
    if (!operator) return
    setMarkingRead(prev => ({ ...prev, [noteId]: true }))
    try {
      const { markNoteAsRead } = await import('@/app/actions/order-notes')
      await markNoteAsRead(noteId, operator.full_name)
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, read_at: new Date().toISOString(), read_by_operator_name: operator.full_name } : n
      ))
    } catch (e) {
      console.error('Error marking note as read:', e)
    } finally {
      setMarkingRead(prev => ({ ...prev, [noteId]: false }))
    }
  }

  async function loadAvailableStockForCutOrder(cutOrderId: string, cutOrder: any) {
    try {
      setLoadingStock(prev => ({ ...prev, [cutOrderId]: true }))

      const { getAvailableStock } = await import('@/app/actions/get-available-stock')
      const productCode = cutOrder.product?.code || ''

      const filtered = await getAvailableStock(productCode)

      // Ordenar: primero el stock actualmente asignado, luego por tamaño
      const sorted = filtered.sort((a, b) => {
        const aIsCurrent = a.product_id === cutOrder.material_base_id
        const bIsCurrent = b.product_id === cutOrder.material_base_id

        if (aIsCurrent && !bIsCurrent) return -1
        if (!aIsCurrent && bIsCurrent) return 1

        const aSize = extractSizeFromCode(a.product?.code || '')
        const bSize = extractSizeFromCode(b.product?.code || '')
        return aSize - bSize
      })

      setAvailableStock(prev => ({ ...prev, [cutOrderId]: sorted }))

      // Pre-seleccionar el stock actual
      const currentStock = sorted.find(s => s.product_id === cutOrder.material_base_id)
      setSelectedStock(prev => ({ ...prev, [cutOrderId]: currentStock || sorted[0] || null }))

      // Establecer cantidad por defecto (todas las unidades solicitadas)
      setQuantityToChange(prev => ({ ...prev, [cutOrderId]: cutOrder.quantity_requested }))
    } catch (error) {
      console.error('Error loading stock:', error)
      toast.error('Error al cargar stock disponible')
    } finally {
      setLoadingStock(prev => ({ ...prev, [cutOrderId]: false }))
    }
  }

  async function handleStockChange(cutOrderId: string, cutOrder: any) {
    const stock = selectedStock[cutOrderId]
    const quantity = quantityToChange[cutOrderId] || cutOrder.quantity_requested

    if (!stock) {
      toast.error('Por favor selecciona un material')
      return
    }

    if (quantity < 1 || quantity > cutOrder.quantity_requested) {
      toast.error(`La cantidad debe estar entre 1 y ${cutOrder.quantity_requested}`)
      return
    }

    try {
      setProcessing(prev => ({ ...prev, [cutOrderId]: true }))

      const { reassignStock } = await import('@/app/actions/reassign-stock')
      const product = Array.isArray(stock.product) ? stock.product[0] : stock.product

      const result = await reassignStock(
        cutOrder.id,
        stock.id,
        product.id,
        extractSizeFromCode(product.code || ''),
        quantity
      )

      if (result.success) {
        toast.success(result.message)
        setShowChangeStockModal(prev => ({ ...prev, [cutOrderId]: false }))

        // Si es reasignación parcial (crea nueva orden), recargar toda la página
        if (quantity < cutOrder.quantity_requested) {
          // Recargar página completa para mostrar la nueva cut_order
          window.location.reload()
        } else {
          // Si es reasignación completa, actualizar localmente
          setPedido((prev: any) => {
            const updatedCutOrders = prev.cut_orders.map((co: any) =>
              co.id === cutOrderId
                ? {
                    ...co,
                    material_base_id: product.id,
                    material_base_quantity: extractSizeFromCode(product.code || ''),
                    material_quantity: quantity
                  }
                : co
            )
            return { ...prev, cut_orders: updatedCutOrders }
          })

          // Recargar sugerencias para reflejar el cambio
          const lengthNeeded = extractSizeFromCode(cutOrder.product?.code || '')
          await toggleCutOrder(cutOrderId, cutOrder.product_id, lengthNeeded)

          // Revalidar para sincronizar con admin
          try {
            await fetch(`/api/revalidate?path=/planta/pedidos/${pedidoId}`, { method: 'POST' })
            await fetch(`/api/revalidate?path=/admin/pedidos/${pedido.id}`, { method: 'POST' })
          } catch (e) {
            console.error('Revalidación fallida')
          }
        }
      } else {
        toast.error('Error al cambiar stock')
      }
    } catch (error: any) {
      console.error('Error changing stock:', error)
      toast.error(error?.message || 'Error al cambiar stock')
    } finally {
      setProcessing(prev => ({ ...prev, [cutOrderId]: false }))
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
      setLoadingSuggestions(prev => ({ ...prev, [cutOrderId]: true }))
      try {
        const { getCutOrderWithAssignment } = await import('@/app/actions/get-cut-order-with-assignment')
        const supabase = createClient()

        // Obtener la orden de corte con el stock asignado
        const cutOrder = await getCutOrderWithAssignment(cutOrderId)

        let bestSuggestion: MaterialSuggestion | null = null
        let alternatives: MaterialSuggestion[] = []

        // Si hay stock asignado, usarlo como sugerencia principal
        if (cutOrder?.material_base_id && cutOrder?.material_base_quantity && cutOrder?.assigned_inventory) {
          const assignedInventory = cutOrder.assigned_inventory
          const waste = Math.max(0, cutOrder.material_base_quantity - lengthNeeded)

          bestSuggestion = {
            type: 'virgin' as const,
            id: assignedInventory.id,
            name: `${cutOrder.assigned_product?.code || assignedInventory.product?.code} (${cutOrder.material_base_quantity}m)`,
            length: cutOrder.material_base_quantity,
            waste: waste,
            location: 'Asignado automáticamente',
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
          best: bestSuggestion,
          alternatives,
          all: allOptions
        }
        setSuggestions(prev => ({ ...prev, [cutOrderId]: suggestion }))
        
        // Solo establecer material seleccionado si hay una sugerencia válida
        if (suggestion.best) {
          setSelectedMaterials(prev => ({ ...prev, [cutOrderId]: suggestion.best! }))
        }
      } catch (error) {
        console.error('Error loading stock suggestions:', error)
      } finally {
        setLoadingSuggestions(prev => ({ ...prev, [cutOrderId]: false }))
      }
    }
  }

  async function handleConfirmCut(cutOrder: any) {
    const cutId = cutOrder.id
    const selectedMaterial = selectedMaterials[cutId]

    if (!selectedMaterial) {
      toast.error('Por favor selecciona un material')
      return
    }

    // Verificar si hay stock físico disponible
    const supabase = createClient()
    const { data: stockCheck } = await supabase
      .from('inventory')
      .select('stock_disponible, stock_total')
      .eq('id', selectedMaterial.id)
      .maybeSingle()

    if (stockCheck && stockCheck.stock_disponible < 0) {
      toast.error(
        `No hay stock físico disponible para esta chapa (disponible: ${stockCheck.stock_disponible} unidades). Contacta con el administrador.`,
        { description: 'Stock no disponible' }
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
      toast.error('Por favor ingresa una cantidad válida')
      return
    }

    if (!operator) {
      toast.error('No se ha identificado el operario')
      return
    }

    setProcessing(prev => ({ ...prev, [cutId]: true }))
    
    try {
      const { processCutOrder } = await import('@/app/actions/cut-operations')

      await processCutOrder({
        cutOrderId: cutId,
        selectedMaterialId: selectedMaterial.id,
        materialLength: selectedMaterial.length,
        quantityToCut,
        operatorId: operator.id
      })

      await loadPedido()

      try {
        await fetch(`/api/revalidate?path=/planta/pedidos/${pedidoId}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/admin/pedidos/${pedido.id}`, { method: 'POST' })
      } catch (e) {
        console.error('Revalidación manual fallida')
      }

      setExpandedCutId(null)
      setQuantityInputs(prev => ({ ...prev, [cutId]: '' }))
      setSelectedMaterials(prev => {
        const newState = { ...prev }
        delete newState[cutId]
        return newState
      })

      toast.success(`Corte completado: ${quantityToCut} unidades de ${selectedMaterial.name}`)

    } catch (error: any) {
      console.error('Error finishing cut:', error)
      toast.error(error.message || 'Error desconocido al finalizar corte')
    } finally {
      setProcessing(prev => ({ ...prev, [cutId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground text-xl">Cargando...</div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Pedido no encontrado</h2>
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-foreground rounded-lg font-semibold"
          >
            Volver a pedidos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Sticky */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="flex items-center gap-2 text-foreground/90 hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Volver</span>
          </button>
          
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{pedido.order_number}</h1>
              {pedido.client ? (
                <p className="text-muted-foreground text-sm mt-1">
                  Cliente: <span className="text-foreground font-semibold">{pedido.client.business_name || 'Sin nombre'}</span>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm mt-1">
                  Cliente: <span className="text-foreground font-semibold">No disponible</span>
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notas del Admin */}
              {notes.length > 0 && (
                <button
                  onClick={() => setShowNotes(v => !v)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  {notes.filter(n => !n.read_at).length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-foreground text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {notes.filter(n => !n.read_at).length}
                    </span>
                  )}
                </button>
              )}
              {/* Reloj */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 rounded-lg border border-border">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-base font-mono font-semibold text-foreground">
                  {currentTime}
                </span>
              </div>
            </div>
          </div>
          
          {operator && (
            <p className="text-muted-foreground">Operario: <span className="text-foreground font-semibold">{operator.full_name}</span></p>
          )}

          {/* Panel de notas expandible */}
          {showNotes && notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={`rounded-lg p-3 flex items-start gap-3 ${
                    note.read_at ? 'bg-muted/50 border border-border' : 'bg-amber-500/10 border border-amber-500/40'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${note.read_at ? 'text-muted-foreground' : 'text-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{note.created_by_name}</p>
                  </div>
                  {!note.read_at && (
                    <button
                      onClick={() => handleMarkNoteRead(note.id)}
                      disabled={markingRead[note.id]}
                      className="flex-shrink-0 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-foreground px-3 py-2 rounded-lg font-medium transition-colors"
                    >
                      {markingRead[note.id] ? '...' : 'Leída'}
                    </button>
                  )}
                  {note.read_at && (
                    <CheckCircle2 className="flex-shrink-0 w-4 h-4 text-green-400" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de Órdenes de Corte */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {pedido.cut_orders && pedido.cut_orders.filter((co: any) => co.material_base_id || co.assigned_inventory_id).length > 0 ? (
          // Mostrar solo órdenes de corte con stock asignado
          pedido.cut_orders
            .filter((co: any) => co.material_base_id || co.assigned_inventory_id)
            .sort((a: any, b: any) => {
              // Primero las pendientes (no completadas), luego las completadas
              const aIsCompleted = a.status === 'completada'
              const bIsCompleted = b.status === 'completada'
              
              if (aIsCompleted && !bIsCompleted) return 1
              if (!aIsCompleted && bIsCompleted) return -1
              
              // Dentro del mismo grupo, mantener orden original por ID
              return 0
            })
            .map((cutOrder: any) => {
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
                    ? 'bg-card/50 border-green-500'
                    : isPendingConfirmation
                    ? 'bg-orange-900/30 border-orange-500'
                    : isExpanded
                    ? 'bg-card border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-card/70 border-border'
                }`}
              >
                {/* Header de la tarjeta */}
                <button
                  onClick={() => isPending && toggleCutOrder(cutOrder.id, cutOrder.product_id, extractSizeFromName(cutOrder.product?.name || '') || extractSizeFromCode(cutOrder.product?.code || '') || 0)}
                  disabled={isCompleted}
                  className={`w-full p-6 ${
                    isPending ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
                  } transition-colors`}
                >
                  <div className="space-y-4">
                    {/* Fila 1: Título y Estado */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <h3 className="text-3xl font-bold text-foreground leading-tight">
                          {cutOrder.product?.name || 'Producto'}
                        </h3>
                        {isPending && (
                          isExpanded ? <ChevronUp className="w-6 h-6 text-blue-400 flex-shrink-0" /> : <ChevronDown className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      
                      {/* Badge de Estado */}
                      {(() => {
                        const statusConfig = getCutOrderStatusConfig(cutOrder.status)
                        const StatusIcon = statusConfig.icon
                        return (
                          <Badge variant={statusConfig.badgeVariant} className="flex-shrink-0 rounded-full px-4 py-2 text-base">
                            <StatusIcon className="w-5 h-5" />
                            {statusConfig.label}
                          </Badge>
                        )
                      })()}
                    </div>

                    {/* Fila 2: Código de corte */}
                    <p className="text-base text-muted-foreground font-medium text-left">{cutOrder.cut_number}</p>

                    {/* Material asignado (visible siempre) */}
                    {cutOrder.material_product && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Material:</span>
                        <span className="text-foreground font-bold">{cutOrder.material_product.name}</span>
                      </div>
                    )}
                    
                    {/* Fila 3: Barra de Progreso */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Progreso</span>
                        <span className="text-foreground font-bold text-lg">
                          {(cutOrder.quantity_cut || 0) - (cutOrder.quantity_delivered || 0)}/{cutOrder.quantity_requested - (cutOrder.quantity_delivered || 0)}
                        </span>
                      </div>

                      {/* Barra de progreso visual */}
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (cutOrder.quantity_cut || 0) - (cutOrder.quantity_delivered || 0) >= cutOrder.quantity_requested - (cutOrder.quantity_delivered || 0)
                              ? 'bg-green-500'
                              : (cutOrder.quantity_cut || 0) - (cutOrder.quantity_delivered || 0) > 0
                              ? 'bg-yellow-500'
                              : 'bg-secondary'
                          }`}
                          style={{
                            width: `${Math.min((((cutOrder.quantity_cut || 0) - (cutOrder.quantity_delivered || 0)) / (cutOrder.quantity_requested - (cutOrder.quantity_delivered || 0))) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && isPending && (
                  <div className="px-6 pb-6 space-y-6 border-t border-border pt-6">
                    {/* Estado de carga de sugerencias */}
                    {loadingSuggestions[cutOrder.id] ? (
                      <div className="bg-card/50 border-2 border-border rounded-2xl p-6">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-foreground text-lg">Cargando stock disponible...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Mensaje cuando no hay stock asignado */}
                        {!cutSuggestions?.best && (!cutSuggestions?.alternatives || cutSuggestions.alternatives.length === 0) && (
                          <div className="bg-red-900/30 border-2 border-red-500 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle className="w-6 h-6 text-red-400" />
                              <h4 className="text-lg font-bold text-red-400 uppercase">Sin Stock Disponible</h4>
                            </div>
                            <p className="text-foreground">
                              No hay stock asignado ni disponible para este producto. Por favor, contacta con el administrador.
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* BLOQUE A: Stock Asignado (Happy Path) */}
                    {cutSuggestions?.best && (
                      <div className={`rounded-2xl p-6 shadow-lg transition-all ${
                        selectedMaterial?.id === cutSuggestions.best.id
                          ? 'bg-green-600/20 border-2 border-green-500 shadow-green-500/30'
                          : 'bg-card/50 border-2 border-blue-500 shadow-blue-500/20'
                      }`}>
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <h4 className="text-xl font-bold text-foreground uppercase">Stock Asignado</h4>
                        </div>
                        
                        <div className="bg-background/70 rounded-xl p-5 space-y-3 mb-6">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-foreground">{cutSuggestions.best.name}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-base">
                            <div>
                              <span className="text-muted-foreground">Longitud:</span>
                              <span className="font-bold ml-2 text-foreground text-xl">{cutSuggestions.best.length}m</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Chapa Restante:</span>
                              <span className={`font-bold ml-2 text-xl ${
                                cutSuggestions.best.waste > 0 ? 'text-orange-400' : 'text-green-400'
                              }`}>
                                {cutSuggestions.best.waste.toFixed(2)}m
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* BLOQUE B: Alternativas y Selector Manual (Botón directo a cambiar stock) */}
                    {((cutSuggestions?.alternatives && cutSuggestions.alternatives.length > 0) || (cutSuggestions?.all && cutSuggestions.all.length > 0)) && (
                      <button
                        onClick={async () => {
                          // Cargar stock antes de abrir el modal
                          await loadAvailableStockForCutOrder(cutOrder.id, cutOrder)
                          setShowChangeStockModal(prev => ({ ...prev, [cutOrder.id]: true }))
                        }}
                        className="w-full h-14 bg-card/50 hover:bg-card/70 border-2 border-border rounded-2xl text-lg font-bold text-foreground transition-all flex items-center justify-center gap-3"
                      >
                        <h5 className="text-xl font-bold text-foreground uppercase">Asignar otro tamaño de corte</h5>
                        <RefreshCw className="w-5 h-5 text-foreground" />
                      </button>
                    )}

                    {/* BLOQUE C: Cantidad a Cortar (Stepper Industrial) */}
                    <div>
                      <label className="block text-lg font-bold text-foreground mb-3 uppercase">
                        {(() => {
                          const materialSize = selectedMaterial?.length || 0
                          const productSize = cutOrder.product?.length_meters || 
                                           parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                                           0
                          const isCut = materialSize > productSize
                          return isCut ? 'Cantidad a Cortar:' : 'Cantidad a Recoger:'
                        })()}
                      </label>
                      <div className="mb-4 text-base text-foreground/90 bg-card/50 p-3 rounded-lg">
                        Pendientes: <span className="font-bold text-foreground text-xl">{cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)}</span> unidades
                      </div>
                      
                      <QuantityStepper
                        value={parseInt(quantityInputs[cutOrder.id] || '0')}
                        onChange={(v) => setQuantityInputs(prev => ({ ...prev, [cutOrder.id]: v.toString() }))}
                        max={cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)}
                      />
                      
                      <p className="text-sm text-muted-foreground mt-3 text-center">
                        Usa los botones + y − para ajustar la cantidad
                      </p>
                    </div>


                    {/* Botón Confirmar - GIGANTE */}
                    <button
                      onClick={() => handleConfirmCut(cutOrder)}
                      disabled={!selectedMaterial || isProcessing || !quantityInputs[cutOrder.id] || parseInt(quantityInputs[cutOrder.id]) <= 0}
                      className="w-full h-20 bg-green-600 hover:bg-green-500 disabled:bg-secondary disabled:cursor-not-allowed text-foreground rounded-2xl font-bold text-2xl uppercase transition-all transform active:scale-95 shadow-lg shadow-green-500/30 disabled:shadow-none"
                    >
                      {isProcessing ? 'Procesando...' : (() => {
                        const materialSize = selectedMaterial?.length || 0
                        const productSize = cutOrder.product?.length_meters || 
                                         parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                                         0
                        const isCut = materialSize > productSize
                        const actionText = isCut ? 'Confirmar Corte' : 'Confirmar Recogida'
                        return `${actionText} (${quantityInputs[cutOrder.id] || 0} unidades)`
                      })()}
                    </button>
                  </div>
                )}

                {/* Contenido para pendiente de confirmación */}
                {isPendingConfirmation && (
                  <div className="px-4 pb-4 space-y-4 border-t border-orange-700 pt-4">
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-6 h-6 text-orange-400" />
                        <h4 className="font-bold text-foreground">RECOGER PIEZA REASIGNADA</h4>
                      </div>
                      
                      <div className="bg-background/50 rounded-lg p-4 space-y-3 mb-4">
                        <p className="text-foreground">
                          Esta pieza ha sido reasignada desde otro pedido. Debes recogerla de:
                        </p>
                        <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Pedido Origen:</p>
                          <p className="text-lg font-bold text-orange-400">
                            {cutOrder.reassigned_from_order?.order_number || 'Cargando...'}
                          </p>
                        </div>
                        <div className="text-sm text-foreground/90">
                          <p>Material: <strong>{cutOrder.product?.code}</strong></p>
                          <p>Cantidad: <strong>{cutOrder.quantity_requested}m</strong></p>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const { confirmReassignmentPickup } = await import('@/app/actions/confirm-reassignment')
                            await confirmReassignmentPickup(cutOrder.id)
                            toast.success('Recogida confirmada correctamente')
                            await loadPedido()
                          } catch (error: any) {
                            toast.error(error.message || 'Error al confirmar recogida')
                          }
                        }}
                        className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-500 text-foreground rounded-lg font-bold text-lg transition-colors"
                      >
                        Confirmar que Recogí la Pieza
                      </button>
                    </div>
                  </div>
                )}

                {/* Subórdenes (si existen) - Mostradas al final del contenido expandido */}
                {cutOrder.sub_orders && cutOrder.sub_orders.length > 0 && (
                  <div className="border-t-4 border-border bg-background/50 mt-4">
                    <div className="px-6 py-3 bg-card/50">
                      <h4 className="text-sm font-bold text-muted-foreground uppercase">↳ Subórdenes de corte ({cutOrder.sub_orders.length})</h4>
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
                                ? 'bg-card/30 border-green-500/50'
                                : isSubExpanded
                                ? 'bg-card border-blue-500 shadow-lg shadow-blue-500/20'
                                : 'bg-card/50 border-border'
                            }`}
                          >
                            {/* Header de la suborden */}
                            <button
                              onClick={() => isSubPending && toggleCutOrder(subOrder.id, subOrder.product_id, extractSizeFromName(subOrder.product?.name || '') || extractSizeFromCode(subOrder.product?.code || '') || 0)}
                              disabled={isSubCompleted}
                              className={`w-full p-4 ${
                                isSubPending ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
                              } transition-colors`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs text-muted-foreground">{subOrder.cut_number}</span>
                                    {isSubPending && (
                                      isSubExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <Badge variant={isSubCompleted ? 'success' : 'warning'} className="rounded-full px-3 py-1">
                                    {isSubCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                    {isSubCompleted ? 'Completada' : 'Pendiente'}
                                  </Badge>
                                </div>

                                {subOrder.material_product && (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Material:</span>
                                      <span className="text-sm text-blue-400 font-semibold">
                                        {subOrder.material_product.name}
                                      </span>
                                    </div>
                                    {subRemnant && parseFloat(subRemnant) > 0 && (
                                      <span className="text-xs text-orange-400 font-semibold">
                                        Remanente: {subRemnant}m
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progreso</span>
                                    <span className="text-foreground font-bold">
                                      {(subOrder.quantity_cut || 0) - (subOrder.quantity_delivered || 0)}/{subOrder.quantity_requested - (subOrder.quantity_delivered || 0)}
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        (subOrder.quantity_cut || 0) - (subOrder.quantity_delivered || 0) >= subOrder.quantity_requested - (subOrder.quantity_delivered || 0)
                                          ? 'bg-green-500'
                                          : (subOrder.quantity_cut || 0) - (subOrder.quantity_delivered || 0) > 0
                                          ? 'bg-yellow-500'
                                          : 'bg-secondary'
                                      }`}
                                      style={{
                                        width: `${Math.min((((subOrder.quantity_cut || 0) - (subOrder.quantity_delivered || 0)) / (subOrder.quantity_requested - (subOrder.quantity_delivered || 0))) * 100, 100)}%`
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* Contenido expandido de la suborden */}
                            {isSubExpanded && isSubPending && (
                              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                                {/* Información del material y remanente */}
                                {subOrder.material_product && (
                                  <div className="bg-background/50 rounded-xl p-4 border border-border">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Material asignado:</span>
                                        <p className="font-bold text-foreground text-base">{subOrder.material_product.name}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Longitud:</span>
                                        <p className="font-bold text-foreground text-base">{subMaterialLength}m</p>
                                      </div>
                                      {subRemnant && parseFloat(subRemnant) > 0 && (
                                        <>
                                          <div>
                                            <span className="text-muted-foreground">Remanente generado:</span>
                                            <p className="font-bold text-orange-400 text-base">{subRemnant}m</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Chapa Restante:</span>
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
                                  <label className="block text-base font-bold text-foreground mb-2 uppercase">
                                    {(() => {
                                      const materialSize = selectedMaterial?.length || 0
                                      const productSize = cutOrder.product?.length_meters || 
                                                       parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                                                       0
                                      const isCut = materialSize > productSize
                                      return isCut ? 'Cantidad a Cortar:' : 'Cantidad a Recoger:'
                                    })()}
                                  </label>
                                  <QuantityStepper
                                    value={parseInt(quantityInputs[subOrder.id] || '0')}
                                    onChange={(v) => setQuantityInputs(prev => ({ ...prev, [subOrder.id]: v.toString() }))}
                                    max={subOrder.quantity_requested - (subOrder.quantity_cut || 0)}
                                  />
                                </div>

                                <button
                                  onClick={() => handleConfirmCut(subOrder)}
                                  disabled={!quantityInputs[subOrder.id] || parseInt(quantityInputs[subOrder.id]) < 1 || isSubProcessing}
                                  className="w-full h-20 bg-green-600 hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed text-foreground font-bold text-2xl rounded-2xl transition-all transform active:scale-95 shadow-lg uppercase"
                                >
                                  {isSubProcessing ? 'Procesando...' : 'Confirmar Corte'}
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
          <div className="bg-card/50 rounded-lg p-12 border border-border text-center">
            <p className="text-muted-foreground text-lg">
              No hay órdenes de corte para este pedido
            </p>
          </div>
        )}

        {/* Sección de Artículos a Preparar */}
        {pedido.preparation_items && pedido.preparation_items.filter((item: any) => item.assigned_inventory_id).length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-6 h-6" />
              Artículos a Preparar
            </h2>
            
            {pedido.preparation_items
              .filter((item: any) => item.assigned_inventory_id)
              .map((item: any) => {
              const isCompleted = item.status === 'completada'
              const progress = (item.quantity_prepared / item.quantity_requested) * 100
              const remaining = item.quantity_requested - item.quantity_prepared

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border-2 p-6 ${
                    isCompleted
                      ? 'bg-card/50 border-green-500'
                      : 'bg-card/70 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Package className={`w-6 h-6 ${isCompleted ? 'text-green-500' : 'text-blue-500'}`} />
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.product.code}</p>
                      </div>
                    </div>
                    {isCompleted && (
                      <CheckCircle2 className="w-7 h-7 text-green-500" />
                    )}
                  </div>

                  {/* Progreso */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-foreground/90 font-medium">Progreso</span>
                      <span className="text-muted-foreground">
                        {item.quantity_prepared} / {item.quantity_requested} unidades
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isCompleted ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stock disponible */}
                  {item.assigned_inventory && (
                    <div className="text-sm text-muted-foreground mb-4">
                      Stock disponible: {item.assigned_inventory.stock_disponible} unidades
                    </div>
                  )}

                  {/* Selector de cantidad y botón */}
                  {!isCompleted && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground/90">
                        Cantidad a preparar ({remaining} restantes):
                      </label>
                      <QuantityStepper
                        size="sm"
                        value={parseInt(quantityInputs[item.id] || '1')}
                        onChange={(v) => setQuantityInputs(prev => ({ ...prev, [item.id]: v.toString() }))}
                        max={remaining}
                      />

                      <button
                        onClick={async () => {
                          const quantity = parseInt(quantityInputs[item.id] || '1')

                          if (quantity <= 0 || quantity > remaining) {
                            toast.error('Cantidad inválida')
                            return
                          }

                          try {
                            const { prepareItem } = await import('@/app/actions/preparation')
                            await prepareItem(item.id, quantity, operator?.id)
                            await loadPedido()
                          } catch (error: any) {
                            toast.error(error.message || 'Error al preparar artículo')
                          }
                        }}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-foreground rounded-lg font-semibold text-lg transition-colors"
                      >
                        Marcar como Preparado
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="flex items-center justify-center gap-2 py-3 text-green-500 font-semibold text-lg">
                      <CheckCircle2 className="w-5 h-5" />
                      Artículo completamente preparado
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Cambio de Stock */}
      {pedido?.cut_orders?.map((cutOrder: any) => (
        showChangeStockModal[cutOrder.id] && (
          <div key={cutOrder.id} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-border">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <h3 className="text-2xl font-bold text-foreground mb-2">Cambiar Stock Asignado</h3>
                <p className="text-muted-foreground">
                  Orden: <strong>{cutOrder.cut_number}</strong> - {cutOrder.product?.name}
                </p>
              </div>

              {/* Contenido */}
              <div className="p-6 overflow-y-auto flex-1">
                {loadingStock[cutOrder.id] ? (
                  <div className="text-center py-12">
                    <div className="text-foreground text-lg">Cargando stock disponible...</div>
                  </div>
                ) : (
                  <>
                    {/* Selector de cantidad */}
                    <div className="mb-6">
                      <label className="block text-foreground font-semibold mb-2">
                        Cantidad de chapas a cambiar:
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const currentValue = quantityToChange[cutOrder.id] || cutOrder.quantity_requested
                            const newValue = Math.max(1, currentValue - 1)
                            setQuantityToChange(prev => ({ ...prev, [cutOrder.id]: newValue }))
                          }}
                          disabled={(quantityToChange[cutOrder.id] || cutOrder.quantity_requested) <= 1}
                          className="w-14 h-14 bg-muted hover:bg-secondary disabled:bg-card disabled:cursor-not-allowed text-foreground rounded-xl text-2xl font-bold transition-colors border-2 border-border"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={cutOrder.quantity_requested}
                          value={quantityToChange[cutOrder.id] || cutOrder.quantity_requested}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1
                            setQuantityToChange(prev => ({ ...prev, [cutOrder.id]: Math.min(Math.max(1, value), cutOrder.quantity_requested) }))
                          }}
                          className="flex-1 p-4 bg-card border-2 border-border rounded-xl text-foreground text-lg text-center focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const currentValue = quantityToChange[cutOrder.id] || cutOrder.quantity_requested
                            const newValue = Math.min(cutOrder.quantity_requested, currentValue + 1)
                            setQuantityToChange(prev => ({ ...prev, [cutOrder.id]: newValue }))
                          }}
                          disabled={(quantityToChange[cutOrder.id] || cutOrder.quantity_requested) >= cutOrder.quantity_requested}
                          className="w-14 h-14 bg-muted hover:bg-secondary disabled:bg-card disabled:cursor-not-allowed text-foreground rounded-xl text-2xl font-bold transition-colors border-2 border-border"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">
                        Máximo: {cutOrder.quantity_requested} chapas
                      </p>
                    </div>

                    <div className="mb-4">
                      <p className="text-muted-foreground text-sm mb-2">
                        Stock disponible para <strong>{cutOrder.product?.code}</strong>:
                      </p>
                    </div>

                    {availableStock[cutOrder.id]?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {availableStock[cutOrder.id].map((stock: any) => {
                          const product = Array.isArray(stock.product) ? stock.product[0] : stock.product
                          const size = extractSizeFromCode(product?.code || '')
                          const isSelected = selectedStock[cutOrder.id]?.id === stock.id
                          const isCurrent = stock.product_id === cutOrder.material_base_id

                          return (
                            <button
                              key={stock.id}
                              onClick={() => setSelectedStock(prev => ({ ...prev, [cutOrder.id]: stock }))}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'bg-card border-amber-500 shadow-lg'
                                  : isCurrent
                                  ? 'bg-card border-blue-500'
                                  : 'bg-card border-border hover:bg-muted'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-xl font-bold text-foreground mb-1">
                                  {product?.code}
                                </div>
                                <div className="text-muted-foreground text-sm">
                                  {size}m
                                </div>
                                <div className="text-muted-foreground text-xs mt-1">
                                  Disponible: {stock.stock_disponible}
                                </div>
                                {isCurrent && (
                                  <div className="flex items-center gap-1 text-blue-400 text-xs mt-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Actual
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay stock disponible para este producto
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => setShowChangeStockModal(prev => ({ ...prev, [cutOrder.id]: false }))}
                  className="flex-1 px-6 py-3 bg-muted hover:bg-secondary text-foreground rounded-xl font-semibold text-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleStockChange(cutOrder.id, cutOrder)}
                  disabled={!selectedStock[cutOrder.id] || processing[cutOrder.id]}
                  className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-muted disabled:cursor-not-allowed text-foreground rounded-xl font-semibold text-lg transition-colors"
                >
                  {processing[cutOrder.id] ? 'Procesando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
