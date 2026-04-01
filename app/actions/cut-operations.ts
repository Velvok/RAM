'use server'

import { createClient } from '@/lib/supabase/server'
import { generateRemnantStock, reserveStock } from './stock-management'
import { finishCutOrder } from './cut-orders'
import { updateOrderStatus } from './orders'

export async function processCutOrder(params: {
  cutOrderId: string
  selectedMaterialId: string
  materialLength: number
  quantityToCut: number
  operatorId: string
}) {
  const { cutOrderId, selectedMaterialId, materialLength, quantityToCut, operatorId } = params
  
  const supabase = await createClient()
  
  console.log(`\n🔍 Buscando orden de corte con ID: ${cutOrderId}`)
  
  // Obtener información de la orden de corte
  const { data: cutOrder, error: cutOrderError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      product:products!cut_orders_product_id_fkey(*),
      material_base:products!cut_orders_material_base_id_fkey(*),
      order:orders!cut_orders_order_id_fkey(*)
    `)
    .eq('id', cutOrderId)
    .single()
  
  if (cutOrderError) {
    console.error('❌ Error al buscar orden de corte:', cutOrderError)
    throw new Error(`Error al buscar orden de corte: ${cutOrderError.message}`)
  }
  
  if (!cutOrder) {
    console.error('❌ Orden de corte no encontrada para ID:', cutOrderId)
    throw new Error('Orden de corte no encontrada')
  }
  
  console.log(`✅ Orden de corte encontrada:`, {
    id: cutOrder.id,
    product_id: cutOrder.product_id,
    quantity_requested: cutOrder.quantity_requested
  })
  
  const productSize = cutOrder.product?.length_meters || 
                     parseFloat(cutOrder.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                     cutOrder.quantity_requested
  
  // Determinar si es MATCH EXACTO o CORTE REAL
  const isExactMatch = Math.abs(materialLength - productSize) < 0.01
  const remnantPerSheet = Math.max(0, materialLength - productSize)
  const sheetsUsed = quantityToCut
  
  const logSeparator = '='.repeat(60)
  console.log(`\n${logSeparator}`)
  console.log(`📏 ANÁLISIS DE OPERACIÓN DE CORTE`)
  console.log(logSeparator)
  console.log(`   Material asignado: ${materialLength}m`)
  console.log(`   Tamaño requerido: ${productSize}m`)
  console.log(`   Diferencia: ${Math.abs(materialLength - productSize)}m`)
  console.log(`   Cantidad a cortar: ${quantityToCut} unidades`)
  console.log(`   Tipo: ${isExactMatch ? '🎯 MATCH EXACTO (sin corte)' : '✂️ CORTE REAL'}`)
  if (!isExactMatch) {
    console.log(`   Remanente por chapa: ${remnantPerSheet}m`)
    console.log(`   Total remanentes: ${sheetsUsed} × ${remnantPerSheet}m`)
  }
  console.log(`${logSeparator}\n`)
  
  // Obtener el inventario seleccionado
  // selectedMaterialId puede ser inventory_id o product_id, intentar ambos
  console.log(`🔍 Buscando inventario con ID: ${selectedMaterialId}`)
  
  let inventoryItem = null
  let inventoryError = null
  
  // Primero intentar como inventory_id
  const { data: byInventoryId, error: err1 } = await supabase
    .from('inventory')
    .select('id, product_id')
    .eq('id', selectedMaterialId)
    .single()
  
  if (byInventoryId) {
    inventoryItem = byInventoryId
  } else {
    // Si no se encuentra, intentar como product_id
    const { data: byProductId, error: err2 } = await supabase
      .from('inventory')
      .select('id, product_id')
      .eq('product_id', selectedMaterialId)
      .single()
    
    if (byProductId) {
      inventoryItem = byProductId
      console.log(`✅ Encontrado por product_id, inventory_id real: ${byProductId.id}`)
    } else {
      inventoryError = err2
    }
  }
  
  if (inventoryError) {
    console.error('❌ Error al buscar inventario:', inventoryError)
    throw new Error(`Error al buscar inventario: ${inventoryError.message}`)
  }
  
  if (!inventoryItem) {
    console.error('❌ No se encontró inventario para ID:', selectedMaterialId)
    throw new Error('No se encontró el producto en el inventario')
  }
  
  console.log(`📋 Material usado: inventory_id = ${inventoryItem.id}, product_id = ${inventoryItem.product_id}`)
  
  // Usar el inventory_id real para el resto del proceso
  const actualInventoryId = inventoryItem.id
  
  // Actualizar cantidad cortada
  const newQuantityCut = (cutOrder.quantity_cut || 0) + quantityToCut
  const isFullyCompleted = newQuantityCut >= cutOrder.quantity_requested
  
  console.log(`📊 Progreso de corte: ${cutOrder.quantity_cut || 0} + ${quantityToCut} = ${newQuantityCut}/${cutOrder.quantity_requested}`)
  
  // Actualizar cut_order directamente aquí en lugar de usar finishCutOrder
  await supabase
    .from('cut_orders')
    .update({
      status: isFullyCompleted ? 'completada' : 'en_proceso',
      quantity_cut: newQuantityCut,
      finished_at: isFullyCompleted ? new Date().toISOString() : null,
    })
    .eq('id', cutOrderId)
  
  // Registrar cut_line
  await supabase
    .from('cut_lines')
    .insert({
      cut_order_id: cutOrderId,
      material_used_id: inventoryItem.product_id,
      quantity_used: sheetsUsed,
      quantity_produced: quantityToCut,
      remnant_generated: remnantPerSheet * sheetsUsed,
      is_scrap: false,
    })
  
  // Actualizar estado del pedido
  await updateOrderStatus(cutOrder.order_id)
  
  // PROCESO DE STOCK
  console.log(`\n🔍 VERIFICACIÓN DE RESERVAS ANTES DEL PROCESO DE STOCK`)
  const { data: stockBeforeProcess } = await supabase
    .from('inventory')
    .select('product_id, stock_total, stock_reservado, stock_disponible')
    .eq('product_id', cutOrder.product_id)
    .single()
  
  console.log(`   Producto ${cutOrder.product_id}:`, {
    total: stockBeforeProcess?.stock_total || 0,
    reservado: stockBeforeProcess?.stock_reservado || 0,
    disponible: stockBeforeProcess?.stock_disponible || 0
  })
  
  if (isExactMatch) {
    // ========== MATCH EXACTO ==========
    // En match exacto, las piezas ya existen y están reservadas.
    // NO consumimos stock porque las piezas siguen comprometidas con el pedido hasta la entrega.
    // El stock_reservado se consumirá cuando se entregue el pedido completo.
    console.log(`\n🎯 Match exacto: ${sheetsUsed} unidades de ${materialLength}m`)
    console.log(`   ✅ Las piezas ya están reservadas, no se modifica el stock`)
    console.log(`   📝 El stock_reservado se consumirá al entregar el pedido`)
    
  } else {
    // ========== CORTE REAL ==========
    console.log(`\n✂️ ENTRANDO AL FLUJO DE CORTE REAL`)
    
    const { data: usedProduct } = await supabase
      .from('products')
      .select('code')
      .eq('id', inventoryItem.product_id)
      .single()
    
    if (!usedProduct) {
      console.error(`❌ ERROR: No se encontró usedProduct para inventoryItem.product_id: ${inventoryItem.product_id}`)
      throw new Error('No se encontró el producto usado')
    }
    
    console.log(`✅ usedProduct encontrado:`, usedProduct)
    console.log(`✂️ Procesando corte real de ${sheetsUsed} chapas...`)
    console.log(`   Chapa original: ${usedProduct.code} (${materialLength}m)`)
    console.log(`   Pieza a obtener: ${productSize}m`)
    console.log(`   Remanente: ${remnantPerSheet}m`)
    console.log(`   cutOrder.product_id: ${cutOrder.product_id}`)
    
    for (let i = 0; i < sheetsUsed; i++) {
      try {
        console.log(`\n${'─'.repeat(50)}`)
        console.log(`📦 PROCESANDO CHAPA ${i + 1}/${sheetsUsed}`)
        console.log(`${'─'.repeat(50)}`)
        
        // 1. Consumir chapa original
        const { data: beforeConsume } = await supabase
          .from('inventory')
          .select('stock_total, stock_reservado, stock_disponible')
          .eq('id', actualInventoryId)
          .single()
        
        console.log(`   📊 Chapa ${materialLength}m antes:`, {
          total: beforeConsume?.stock_total,
          reservado: beforeConsume?.stock_reservado,
          disponible: beforeConsume?.stock_disponible
        })
        
        const { error: consumeError } = await supabase.rpc('consume_reserved_stock', {
          p_inventory_id: actualInventoryId
        })
        
        if (consumeError) {
          console.error('   ❌ Error al consumir stock reservado:', consumeError)
          throw consumeError
        }
        
        const { data: afterConsume } = await supabase
          .from('inventory')
          .select('stock_total, stock_reservado, stock_disponible')
          .eq('id', actualInventoryId)
          .single()
        
        console.log(`   ✅ Consumida: -1 chapa de ${materialLength}m`)
        console.log(`   📊 Chapa ${materialLength}m después:`, {
          total: afterConsume?.stock_total,
          reservado: afterConsume?.stock_reservado,
          disponible: afterConsume?.stock_disponible
        })
        
        // 2. Generar pieza cortada
        console.log(`   🔍 Generando pieza cortada de ${productSize}m (ya reservada)...`)
        
        const { data: beforeGenerate } = await supabase
          .from('inventory')
          .select('id, product_id, stock_total, stock_reservado, stock_generado, stock_disponible')
          .eq('product_id', cutOrder.product_id)
          .single()
        
        console.log(`   📊 Stock ANTES de generar:`, {
          total: beforeGenerate?.stock_total || 0,
          reservado: beforeGenerate?.stock_reservado || 0,
          generado: beforeGenerate?.stock_generado || 0,
          disponible: beforeGenerate?.stock_disponible || 0
        })
        
        await generateRemnantStock(usedProduct.code, productSize)
        
        const { data: cutPieceInventory, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, product_id, stock_total, stock_reservado, stock_generado, stock_disponible')
          .eq('product_id', cutOrder.product_id)
          .single()
        
        if (inventoryError || !cutPieceInventory) {
          console.error(`   ❌ Error al buscar inventario:`, inventoryError)
          throw new Error(`No se encontró el inventario para el producto ${cutOrder.product_id}`)
        }
        
        console.log(`   📊 Stock DESPUÉS de generar:`, {
          total: cutPieceInventory.stock_total,
          reservado: cutPieceInventory.stock_reservado,
          generado: cutPieceInventory.stock_generado,
          disponible: cutPieceInventory.stock_disponible
        })
        console.log(`   ✅ Cambios: total +${cutPieceInventory.stock_total - (beforeGenerate?.stock_total || 0)}, generado +${cutPieceInventory.stock_generado - (beforeGenerate?.stock_generado || 0)}`)
        
        // 3. Reservar la pieza generada
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            stock_reservado: cutPieceInventory.stock_reservado + 1
          })
          .eq('id', cutPieceInventory.id)
        
        if (updateError) {
          console.error(`   ❌ Error al reservar pieza generada:`, updateError)
          throw updateError
        }
        
        const { data: afterReserve } = await supabase
          .from('inventory')
          .select('stock_total, stock_reservado, stock_generado, stock_disponible')
          .eq('id', cutPieceInventory.id)
          .single()
        
        console.log(`   ✅ Pieza generada y reservada: +1 de ${productSize}m`)
        console.log(`   📊 Stock final:`, {
          total: afterReserve?.stock_total,
          reservado: afterReserve?.stock_reservado,
          generado: afterReserve?.stock_generado,
          disponible: afterReserve?.stock_disponible
        })
        
        // 4. Generar remanente (si existe)
        if (remnantPerSheet > 0) {
          await generateRemnantStock(usedProduct.code, remnantPerSheet)
          console.log(`   ✅ Remanente: +1 pieza de ${remnantPerSheet}m (disponible)`)
        }
        
      } catch (error) {
        console.error(`\n❌ ERROR en chapa ${i + 1}/${sheetsUsed}:`, error)
        throw error
      }
    }
    
    console.log(`\n✅ Proceso completado: ${sheetsUsed} chapas cortadas`)
    console.log(`   📉 Chapas originales: -${sheetsUsed} × ${materialLength}m`)
    console.log(`   📈 Piezas cortadas: +${sheetsUsed} × ${productSize}m (generadas y reservadas)`)
    if (remnantPerSheet > 0) {
      console.log(`   📈 Remanentes: +${sheetsUsed} × ${remnantPerSheet}m (disponibles)`)
    }
  }
  
  // Registrar actividad en el historial
  const { data: operator } = await supabase
    .from('plant_operators')
    .select('name')
    .eq('id', operatorId)
    .single()
  
  console.log(`📝 Registrando actividad en historial:`, {
    order_id: cutOrder.order_id,
    cut_order_id: cutOrderId,
    parent_cut_order_id: cutOrder.parent_cut_order_id,
    is_suborder: !!cutOrder.parent_cut_order_id
  })
  
  await supabase.from('order_activity_log').insert({
    order_id: cutOrder.order_id,
    cut_order_id: cutOrderId,
    activity_type: 'cut_completed',
    description: `${operator?.name || 'Operario'} cortó ${quantityToCut} unidad${quantityToCut !== 1 ? 'es' : ''} de ${cutOrder.product?.name || 'producto'} (${newQuantityCut}/${cutOrder.quantity_requested})`,
    metadata: {
      action: `Corte ${isFullyCompleted ? 'completado' : 'parcial'}`,
      operator_name: operator?.name,
      quantity_cut: quantityToCut,
      total_cut: newQuantityCut,
      total_requested: cutOrder.quantity_requested,
      material_length: materialLength,
      remnant_per_sheet: remnantPerSheet,
      sheets_used: sheetsUsed,
      is_completed: isFullyCompleted
    }
  })
  
  console.log(`📝 Actividad registrada en el historial`)
  
  return {
    success: true,
    isFullyCompleted,
    newQuantityCut,
    totalRequested: cutOrder.quantity_requested
  }
}
