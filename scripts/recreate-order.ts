import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar variables de entorno
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL!,
  envVars.SUPABASE_SERVICE_ROLE_KEY!,
)

async function recreateOrder() {
  console.log('🔄 Recreando pedidos...')

  // Buscar productos por nombre
  const productsToFind = [
    'CH.SINUSOIDAL GRIS P. X 8,0 M',
    'POLI.SINUSOIDAL CRISTAL X 10,0m',
    'CH.TRAPEZOIDAL CINC.25 X 0,5 M',
    'ALVEOLAR CRISTAL 6 MM 2100*5800'
  ]

  const products: any[] = []
  
  for (const productName of productsToFind) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${productName}%`)
      .limit(1)

    if (error) {
      console.error(`❌ Error buscando ${productName}:`, error)
    } else if (data && data.length > 0) {
      console.log(`✅ Encontrado: ${data[0].name}`)
      products.push(data[0])
    } else {
      console.log(`⚠️ No encontrado: ${productName}`)
    }
  }

  // Buscar cualquier producto para el quinto item
  const { data: randomProduct } = await supabase
    .from('products')
    .select('*')
    .limit(1)

  if (randomProduct && randomProduct.length > 0) {
    console.log(`✅ Producto adicional: ${randomProduct[0].name}`)
    products.push(randomProduct[0])
  }

  if (products.length < 5) {
    console.error('❌ No se encontraron suficientes productos')
    return
  }

  // Obtener cliente
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .limit(1)

  if (!clients || clients.length === 0) {
    console.error('❌ No se encontraron clientes')
    return
  }

  // Crear 2 pedidos
  const orderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']
  const quantities = [10, 8, 9, 3, 5]

  for (const orderNumber of orderNumbers) {
    console.log(`📦 Creando pedido ${orderNumber}...`)

    // Eliminar pedido existente si existe
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .single()

    if (existingOrder) {
      console.log('🗑️ Eliminando pedido existente...')
      await supabase.from('orders').delete().eq('id', existingOrder.id)
    }

    // Crear pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: clients[0].id,
        status: 'nuevo',
        total_amount: 0,
        notes: 'Pedido de prueba para retiradas parciales'
      })
      .select()
      .single()

    if (orderError) {
      console.error(`❌ Error creando pedido ${orderNumber}:`, orderError)
      continue
    }

    console.log(`✅ Pedido creado: ${order.id}`)

    // Crear líneas
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const quantity = quantities[i]
      
      const { error: lineError } = await supabase
        .from('order_lines')
        .insert({
          order_id: order.id,
          product_id: product.id,
          quantity: quantity,
          units: quantity
        })

      if (lineError) {
        console.error(`❌ Error creando línea ${i}:`, lineError)
      } else {
        console.log(`✅ Línea ${i + 1}: ${product.name} x ${quantity}`)
      }
    }

    console.log(`✅ Pedido ${orderNumber} completado`)
  }

  console.log('🎉 Pedidos recreados exitosamente!')
}

recreateOrder().catch(console.error)
