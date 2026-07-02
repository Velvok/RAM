'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { generateRemnantStock, reserveStock } from './stock-management'
import { extractSizeFromCode, extractFamilyCode } from '@/lib/product-utils'
import { finishCutOrder } from './cut-orders'
import { updateOrderStatus } from './orders'
import { notifyCorteRealizado, notifyChapaPreparada, type CorteMovimiento } from '@/lib/ram-outbound'
import { revalidatePath } from 'next/cache'

export async function processCutOrder(params: {
  cutOrderId: string
  selectedMaterialId: string
  materialLength: number
  quantityToCut: number
  operatorId: string
}) {
  const { cutOrderId, selectedMaterialId, materialLength, quantityToCut, operatorId } = params
  
  const supabase = createAdminClient()
  
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
                     extractSizeFromCode(cutOrder.product?.code || '') ||
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
  console.log(`📊 isFullyCompleted: ${isFullyCompleted}, nuevo estado: ${isFullyCompleted ? 'completada' : 'pendiente'}`)

  // Actualizar cut_order directamente aquí en lugar de usar finishCutOrder
  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({
      status: isFullyCompleted ? 'completada' : 'pendiente',
      quantity_cut: newQuantityCut,
      finished_at: isFullyCompleted ? new Date().toISOString() : null,
      assigned_inventory_id: actualInventoryId,
    })
    .eq('id', cutOrderId)

  if (updateError) {
    console.error('❌ Error actualizando cut_order:', updateError)
    throw updateError
  }

  console.log(`✅ Cut_order actualizada: status=${isFullyCompleted ? 'completada' : 'pendiente'}, quantity_cut=${newQuantityCut}`)
  
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

    // ============================================
    // 📤 NOTIFICAR A EVO: chapa_preparada (PREP)
    // Cuando es match exacto, enviamos evento PREP
    // ============================================
    try {
      const evoOrderId = cutOrder.order?.evo_order_id
      const refEvo = cutOrder.ref_evo || cutOrder.order?.ref_evo

      if (!evoOrderId) {
        console.log(`⏭️ Pedido sin evo_order_id, no se notifica a EVO`)
      } else if (!refEvo) {
        console.log(`⏭️ Pedido sin ref_evo, no se notifica a EVO`)
      } else if (!cutOrder.product?.evo_product_id) {
        console.log(`⏭️ Producto sin evo_product_id, no se notifica a EVO`)
      } else {
        const nroItem = cutOrder.evo_item_number ? parseInt(cutOrder.evo_item_number, 10) : 
                       refEvo.nro_item || refEvo.item_number || 1

        const movimientos: CorteMovimiento[] = [{
          tipo: 'PREP',
          nro_item: nroItem,
          id_articulo: cutOrder.product.evo_product_id,
          cantidad: quantityToCut,
        }]

        // Obtener código del operario
        const { data: opData } = await supabase
          .from('plant_operators')
          .select('name, code')
          .eq('id', operatorId)
          .single()

        const operario = (opData as any)?.code || opData?.name || operatorId

        console.log(`📤 Notificando a EVO chapa_preparada (PREP):`, {
          id_pedido: evoOrderId,
          ref_evo: refEvo,
          operario,
          movimientos,
        })

        await notifyChapaPreparada({
          cutOrderId,
          orderId: cutOrder.order_id,
          idPedido: evoOrderId,
          refEvo,
          operario,
          movimientos,
        })

        console.log(`✅ Evento chapa_preparada (PREP) encolado para EVO`)
      }
    } catch (notifyError) {
      // No bloqueamos el corte si falla la notificación; se reintenta por cron
      console.error(`⚠️ Error notificando a EVO (no bloqueante):`, notifyError)
    }

  } else {
    // ========== CORTE REAL ==========
    console.log(`\n✂️ ENTRANDO AL FLUJO DE CORTE REAL`)

    const { data: usedProduct } = await supabase
      .from('products')
      .select('code, evo_product_id')
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
    console.log(`   ⏭️ NO modificamos stock local - EVO será la única fuente de verdad`)

    for (let i = 0; i < sheetsUsed; i++) {
      try {
        console.log(`\n${'─'.repeat(50)}`)
        console.log(`📦 PROCESANDO CHAPA ${i + 1}/${sheetsUsed}`)
        console.log(`${'─'.repeat(50)}`)

        // Reservar stock de la chapa usada
        console.log(`   📦 Reservando stock de chapa ${usedProduct.code} (${materialLength}m)`)
        const { error: reserveError } = await supabase.rpc('reserve_stock', {
          p_inventory_id: actualInventoryId,
          p_quantity: 1
        })

        if (reserveError) {
          console.error(`   ❌ Error reservando stock: ${reserveError.message}`)
        } else {
          console.log(`   ✅ Stock reservado correctamente`)
        }

      } catch (error) {
        console.error(`\n❌ ERROR en chapa ${i + 1}/${sheetsUsed}:`, error)
        throw error
      }
    }

    console.log(`\n✅ Proceso completado: ${sheetsUsed} chapas cortadas`)
    console.log(`   📉 Chapas originales: -${sheetsUsed} × ${materialLength}m (EVO actualizará)`)
    console.log(`   📈 Piezas cortadas: +${sheetsUsed} × ${productSize}m (EVO actualizará)`)
    if (remnantPerSheet > 0) {
      console.log(`   📈 Remanentes: +${sheetsUsed} × ${remnantPerSheet}m (EVO actualizará)`)
    }

    // ============================================
    // 📤 NOTIFICAR A EVO: corte_realizado
    // Solo cuando hay remanente (corte real)
    // ============================================
    if (remnantPerSheet > 0) {
      try {
        const evoOrderId = cutOrder.order?.evo_order_id
        const refEvo = cutOrder.ref_evo || cutOrder.order?.ref_evo

        if (!evoOrderId) {
          console.log(`⏭️ Pedido sin evo_order_id, no se notifica a EVO`)
        } else if (!refEvo) {
          console.log(`⏭️ Pedido sin ref_evo, no se notifica a EVO`)
        } else if (!usedProduct.evo_product_id) {
          console.log(`⏭️ Material usado sin evo_product_id, no se notifica a EVO`)
        } else if (!cutOrder.product?.evo_product_id) {
          console.log(`⏭️ Producto cortado sin evo_product_id, no se notifica a EVO`)
        } else {
          const movimientos: CorteMovimiento[] = []

          const nroItem = cutOrder.evo_item_number ? parseInt(cutOrder.evo_item_number, 10) : 0

          // BAJA del material consumido (nro_item: 0, no es la línea del cliente)
          movimientos.push({
            tipo: 'BAJA',
            nro_item: 0,
            id_articulo: usedProduct.evo_product_id,
            cantidad: sheetsUsed,
          })

          // ALTA del producto cortado (pieza solicitada → lleva nro_item de la línea)
          movimientos.push({
            tipo: 'ALTA',
            nro_item: nroItem,
            id_articulo: cutOrder.product.evo_product_id,
            cantidad: sheetsUsed,
          })

          // ALTA del remanente (nro_item: 0, no corresponde a ninguna línea del pedido)
          let remnantCode = ''
          const dachMatch = usedProduct.code.match(/^([A-Z0-9.,]+)X\d+[.,]\d+M$/i)
          if (dachMatch) {
            const baseCode = dachMatch[1]
            const sizeStr = remnantPerSheet.toFixed(1)
            const sizeFormatted = sizeStr.replace('.', ',')
            remnantCode = `${baseCode}X${sizeFormatted}M`
          } else {
            const baseCode = extractFamilyCode(usedProduct.code)
            if (baseCode) {
              remnantCode = `${baseCode}.${remnantPerSheet.toFixed(1).replace('.', ',')}`
            }
          }

          if (remnantCode) {
            const { data: remnantProduct } = await supabase
              .from('products')
              .select('evo_product_id')
              .eq('code', remnantCode)
              .single()

            if (remnantProduct?.evo_product_id) {
              movimientos.push({
                tipo: 'ALTA',
                nro_item: 0,
                id_articulo: remnantProduct.evo_product_id,
                cantidad: sheetsUsed,
              })
            } else {
              console.warn(`⚠️ Producto del remanente (${remnantCode}) sin evo_product_id, no se incluye en notificación`)
            }
          }

          // Obtener código del operario
          const { data: opData } = await supabase
            .from('plant_operators')
            .select('name, code')
            .eq('id', operatorId)
            .single()

          const operario = (opData as any)?.code || opData?.name || operatorId

          console.log(`📤 Notificando a EVO corte_realizado:`, {
            id_pedido: evoOrderId,
            ref_evo: refEvo,
            operario,
            movimientos,
          })

          await notifyCorteRealizado({
            cutOrderId,
            orderId: cutOrder.order_id,
            idPedido: evoOrderId,
            refEvo,
            operario,
            movimientos,
          })

          console.log(`✅ Evento corte_realizado encolado para EVO`)
        }
      } catch (notifyError) {
        // No bloqueamos el corte si falla la notificación; se reintenta por cron
        console.error(`⚠️ Error notificando a EVO (no bloqueante):`, notifyError)
      }
    } else {
      console.log(`⏭️ Sin remanente (match exacto), no se notifica a EVO`)
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

  // Revalidar rutas para actualizar la UI
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin/pedidos/[id]', 'page')
  revalidatePath('/planta/pedidos/[id]', 'page')

  return {
    success: true,
    isFullyCompleted,
    newQuantityCut,
    totalRequested: cutOrder.quantity_requested
  }
}
