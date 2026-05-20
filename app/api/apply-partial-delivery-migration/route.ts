import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Usar cliente con service_role key para ejecutar DDL
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🔧 Aplicando migración de retiradas parciales...')

    const results = []

    // 1. Agregar estado 'parcialmente_entregado' al enum
    console.log('1️⃣ Agregando estado parcialmente_entregado...')
    const { error: enumError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'parcialmente_entregado';"
    })
    if (enumError) {
      console.log('⚠️ Error agregando enum (puede que ya exista):', enumError.message)
    } else {
      console.log('✅ Estado agregado')
    }
    results.push({ step: 'enum', error: enumError?.message })

    // 2. Agregar columna delivery_type
    console.log('2️⃣ Agregando columna delivery_type...')
    const { error: typeError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE delivery_history ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'complete' CHECK (delivery_type IN ('complete', 'partial'));"
    })
    if (typeError) {
      console.log('⚠️ Error agregando delivery_type:', typeError.message)
    } else {
      console.log('✅ Columna delivery_type agregada')
    }
    results.push({ step: 'delivery_type', error: typeError?.message })

    // 3. Agregar columna items_delivered
    console.log('3️⃣ Agregando columna items_delivered...')
    const { error: itemsError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE delivery_history ADD COLUMN IF NOT EXISTS items_delivered JSONB;"
    })
    if (itemsError) {
      console.log('⚠️ Error agregando items_delivered:', itemsError.message)
    } else {
      console.log('✅ Columna items_delivered agregada')
    }
    results.push({ step: 'items_delivered', error: itemsError?.message })

    // 4. Modificar constraint de tiempo
    console.log('4️⃣ Modificando constraint de tiempo...')
    const { error: dropConstraintError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE delivery_history DROP CONSTRAINT IF EXISTS check_delivery_time;"
    })
    if (dropConstraintError) {
      console.log('⚠️ Error eliminando constraint:', dropConstraintError.message)
    }
    
    const { error: addConstraintError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE delivery_history ADD CONSTRAINT check_delivery_time CHECK (delivered_at >= NOW() - INTERVAL '24 hours' OR delivery_type = 'partial' OR is_active = false);"
    })
    if (addConstraintError) {
      console.log('⚠️ Error agregando constraint:', addConstraintError.message)
    } else {
      console.log('✅ Constraint modificado')
    }
    results.push({ step: 'constraint', error: addConstraintError?.message })

    console.log('✅ Migración completada')

    return NextResponse.json({ 
      success: true,
      message: 'Migración de retiradas parciales aplicada',
      results
    })
  } catch (error: any) {
    console.error('❌ Error aplicando migración:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
