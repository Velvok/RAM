import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  try {
    // Verificar si la tabla ya existe
    const { error: checkError } = await supabase
      .from('delivery_history')
      .select('id')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'La tabla delivery_history ya existe',
        already_exists: true
      })
    }

    return NextResponse.json({
      success: false,
      message: 'Debes aplicar las migraciones manualmente en Supabase Dashboard',
      instructions: {
        step1: 'Ve a Supabase Dashboard → SQL Editor',
        step2: 'Ejecuta el contenido de supabase/migrations/00036_create_delivery_history_table.sql',
        step3: 'Ejecuta el contenido de supabase/migrations/00037_create_restore_stock_function.sql',
        migration_files: [
          '/supabase/migrations/00036_create_delivery_history_table.sql',
          '/supabase/migrations/00037_create_restore_stock_function.sql'
        ]
      }
    })

  } catch (error: any) {
    console.error('Error verificando migraciones:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
