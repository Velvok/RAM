import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  try {
    console.log('🧪 Probando inserción manual en delivery_history...')

    // 1. Obtener un pedido entregado para probar
    const { data: deliveredOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('status', 'entregado')
      .limit(1)

    if (orderError) {
      console.error('❌ Error obteniendo pedido entregado:', orderError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo pedido entregado',
        details: orderError.message 
      }, { status: 500 })
    }

    if (!deliveredOrder || deliveredOrder.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No hay pedidos entregados para probar' 
      }, { status: 400 })
    }

    const order = deliveredOrder[0]
    console.log('✅ Pedido entregado encontrado:', order.id, order.order_number)

    // 2. Intentar insertar en delivery_history
    const testData = {
      order_id: order.id,
      delivered_by: null, // Sin usuario específico para prueba
      previous_status: 'finalizado',
      stock_consumed: [
        {
          cut_order_id: 'test-cut-order',
          inventory_id: 'test-inventory',
          quantity: 1
        }
      ]
    }

    console.log('📝 Intentando insertar:', testData)

    const { data: insertData, error: insertError } = await supabase
      .from('delivery_history')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('❌ Error insertando en delivery_history:', insertError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error insertando en delivery_history',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      }, { status: 500 })
    }

    console.log('✅ Inserción exitosa:', insertData)

    // 3. Verificar que se guardó
    const { data: verifyData, error: verifyError } = await supabase
      .from('delivery_history')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (verifyError) {
      console.error('❌ Error verificando inserción:', verifyError)
    } else {
      console.log('✅ Verificación exitosa:', verifyData)
    }

    return NextResponse.json({
      success: true,
      message: 'Inserción en delivery_history probada exitosamente',
      order_used: order,
      test_data: testData,
      insert_result: insertData,
      verify_result: verifyData
    })

  } catch (error: any) {
    console.error('❌ Error general:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
