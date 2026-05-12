import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface StockActualizadoPayload {
  id_evento: string
  tipo_evento: 'stock_actualizado'
  version: number
  timestamp: string
  items: Array<{
    id_articulo: string
    nombre?: string
    cantidad: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()

    // Configuración de seguridad
    const webhookSecret = process.env.EVO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('❌ EVO_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Verificar autenticación
    const verifyWebhook = createWebhookVerifier({
      secret: webhookSecret,
      enableHmac: false,
      enableBearerToken: true
    })

    const verification = await verifyWebhook(headersList, body)

    if (!verification.valid) {
      console.error('❌ Webhook authentication failed:', verification.error)
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: verification.error
        },
        { status: 401 }
      )
    }

    console.log('✅ Webhook authentication successful')

    // Parsear el payload
    const payload: StockActualizadoPayload = JSON.parse(body)
    const supabase = createAdminClient()

    // Validar estructura básica
    if (!payload.id_evento || !payload.version || !payload.items) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Verificar idempotencia
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .maybeSingle()

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

    // Registrar evento inmediatamente (con success=null hasta procesar)
    await supabase
      .from('evo_events')
      .insert({
        id_evento: payload.id_evento,
        tipo_evento: payload.tipo_evento,
        version: payload.version,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: null,
        errors: null
      })

    console.log(`📥 Event ${payload.id_evento} registered. Items: ${payload.items.length}`)

    // Usar after() para procesar DESPUÉS de enviar la respuesta
    // Esto evita timeout de EVO y permite que el procesamiento continúe
    after(async () => {
      try {
        await processStockUpdate(payload)
      } catch (error) {
        console.error('Error in after() processing:', error)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Stock update accepted for processing',
      id_evento: payload.id_evento,
      version: payload.version,
      items_count: payload.items.length
    })

  } catch (error) {
    console.error('Stock webhook error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Procesa la actualización de stock en bulk para máxima eficiencia.
 * En lugar de N queries por item, hace ~4 queries totales.
 */
async function processStockUpdate(payload: StockActualizadoPayload) {
  console.log(`🔄 Starting BULK processing for ${payload.items.length} items...`)
  const startTime = Date.now()
  const supabase = createAdminClient()
  const errors: string[] = []

  try {
    // 1. Verificar versión
    const { data: lastSync } = await supabase
      .from('stock_sync_log')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentVersion = lastSync?.version || 0
    console.log(`📊 Current version: ${currentVersion}, Received: ${payload.version}`)

    if (payload.version <= currentVersion) {
      console.log(`⏭️ Skipping older version`)
      return
    }

    // 2. Obtener todos los productos existentes EN UNA SOLA QUERY
    const allEvoIds = payload.items.map(i => i.id_articulo)
    console.log(`🔍 Fetching existing products...`)

    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, code, name, evo_product_id')
      .in('evo_product_id', allEvoIds)

    if (fetchError) {
      throw new Error(`Error fetching products: ${fetchError.message}`)
    }

    const existingByEvoId = new Map(
      (existingProducts || []).map(p => [p.evo_product_id, p])
    )
    console.log(`   Found ${existingByEvoId.size} existing products`)

    // 3. Separar items en: crear nuevos vs actualizar existentes
    const toCreate: Array<{
      code: string
      evo_product_id: string
      name: string
      category: string
      unit: string
      is_active: boolean
    }> = []
    const toUpdateName: Array<{ id: string; name: string }> = []
    const productsByEvoId = new Map<string, { id: string; code: string; name: string }>()

    for (const item of payload.items) {
      const existing = existingByEvoId.get(item.id_articulo)

      if (existing) {
        productsByEvoId.set(item.id_articulo, existing)

        // Actualizar nombre si es diferente
        if (item.nombre && item.nombre !== existing.name) {
          toUpdateName.push({ id: existing.id, name: item.nombre })
        }
      } else {
        toCreate.push({
          code: item.id_articulo,
          evo_product_id: item.id_articulo,
          name: item.nombre || `Producto ${item.id_articulo}`,
          category: 'chapa',
          unit: 'kg',
          is_active: true
        })
      }
    }

    console.log(`   To create: ${toCreate.length}, To update name: ${toUpdateName.length}`)

    // 4. Crear productos nuevos EN BATCHES de 100
    if (toCreate.length > 0) {
      console.log(`➕ Creating ${toCreate.length} new products...`)
      const BATCH_SIZE = 100
      for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
        const batch = toCreate.slice(i, i + BATCH_SIZE)
        const { data: created, error: createError } = await supabase
          .from('products')
          .insert(batch)
          .select('id, code, name, evo_product_id')

        if (createError) {
          console.error(`   ❌ Error creating batch:`, createError)
          errors.push(`Error creating products batch: ${createError.message}`)
        } else if (created) {
          for (const p of created) {
            productsByEvoId.set(p.evo_product_id!, p)
          }
          console.log(`   ✅ Created batch ${Math.floor(i / BATCH_SIZE) + 1}: ${created.length} products`)
        }
      }
    }

    // 5. Actualizar nombres en batch (uno por uno pero rápido)
    if (toUpdateName.length > 0) {
      console.log(`📝 Updating ${toUpdateName.length} product names...`)
      // Actualizar en paralelo en chunks
      const CHUNK_SIZE = 50
      for (let i = 0; i < toUpdateName.length; i += CHUNK_SIZE) {
        const chunk = toUpdateName.slice(i, i + CHUNK_SIZE)
        await Promise.all(
          chunk.map(u =>
            supabase
              .from('products')
              .update({ name: u.name })
              .eq('id', u.id)
          )
        )
      }
      console.log(`   ✅ Names updated`)
    }

    // 6. Preparar upsert masivo de inventory
    const inventoryUpdates = payload.items
      .map(item => {
        const product = productsByEvoId.get(item.id_articulo)
        if (!product) {
          errors.push(`Product not found for ${item.id_articulo}`)
          return null
        }
        return {
          product_id: product.id,
          stock_total: item.cantidad,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)

    console.log(`💾 Upserting inventory for ${inventoryUpdates.length} products...`)

    // 7. Upsert masivo en batches
    if (inventoryUpdates.length > 0) {
      const BATCH_SIZE = 200
      for (let i = 0; i < inventoryUpdates.length; i += BATCH_SIZE) {
        const batch = inventoryUpdates.slice(i, i + BATCH_SIZE)
        const { error: upsertError } = await supabase
          .from('inventory')
          .upsert(batch, { onConflict: 'product_id' })

        if (upsertError) {
          console.error(`   ❌ Error upserting batch:`, upsertError)
          errors.push(`Error upserting inventory batch: ${upsertError.message}`)
        } else {
          console.log(`   ✅ Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} items`)
        }
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`\n✅ Processing complete in ${elapsed}ms`)
    console.log(`   Created: ${toCreate.length} products`)
    console.log(`   Updated names: ${toUpdateName.length} products`)
    console.log(`   Updated inventory: ${inventoryUpdates.length} items`)
    console.log(`   Errors: ${errors.length}`)

    // 8. Actualizar evento con resultado
    await supabase
      .from('evo_events')
      .update({
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : null,
        processed_at: new Date().toISOString()
      })
      .eq('id_evento', payload.id_evento)

    // 9. Registrar en stock_sync_log
    await supabase
      .from('stock_sync_log')
      .insert({
        version: payload.version,
        timestamp: payload.timestamp,
        items_count: payload.items.length,
        updated_count: inventoryUpdates.length,
        errors_count: errors.length,
        errors: errors.length > 0 ? errors : null
      })

  } catch (error) {
    console.error('❌ Error in bulk processing:', error)

    // Actualizar evento con error
    try {
      await supabase
        .from('evo_events')
        .update({
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          processed_at: new Date().toISOString()
        })
        .eq('id_evento', payload.id_evento)
    } catch (updateError) {
      console.error('Failed to update event with error:', updateError)
    }
  }
}
