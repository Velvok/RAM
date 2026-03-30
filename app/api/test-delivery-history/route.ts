import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  try {
    console.log('🔍 Verificando delivery_history...')
    
    // 1. Verificar si la tabla existe y tiene registros
    const { data: records, error: selectError } = await supabase
      .from('delivery_history')
      .select('*')
      .limit(5)
      .order('delivered_at', { ascending: false })

    if (selectError) {
      console.error('❌ Error consultando delivery_history:', selectError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error consultando delivery_history',
        details: selectError.message 
      }, { status: 500 })
    }

    // 2. Verificar estructura de la tabla
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'delivery_history')
      .eq('table_schema', 'public')

    // 3. Verificar políticas RLS
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('policyname, permissive, roles, cmd, qual, with_check')
      .eq('tablename', 'delivery_history')
      .eq('schemaname', 'public')

    // 4. Intentar insertar un registro de prueba
    const testRecord = {
      order_id: '00000000-0000-0000-0000-000000000000',
      delivered_by: null,
      previous_status: 'finalizado',
      stock_consumed: [{ test: true }]
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('delivery_history')
      .insert(testRecord)
      .select()
      .single()

    return NextResponse.json({
      success: true,
      message: 'delivery_history verificado correctamente',
      verification: {
        table_exists: true,
        record_count: records?.length || 0,
        recent_records: records || [],
        table_structure: columns || [],
        policies: policies || [],
        test_insert: {
          success: !insertError,
          error: insertError?.message || null,
          result: insertResult || null
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error general:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
