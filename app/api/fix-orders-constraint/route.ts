import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
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

    console.log('🔧 Actualizando constraint de orders...')

    // Eliminar constraint viejo
    console.log('1️⃣ Eliminando constraint viejo...')
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;"
    })

    if (dropError) {
      console.error('❌ Error eliminando constraint:', dropError)
      return NextResponse.json({ 
        success: false, 
        error: dropError.message 
      }, { status: 500 })
    }

    console.log('✅ Constraint eliminado')

    // Crear nuevo constraint con todos los valores
    console.log('2️⃣ Creando nuevo constraint...')
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'ingresado',
  'generado', 
  'pendiente_aprobacion',
  'lanzado',
  'nuevo',
  'aprobado',
  'aprobado_en_pausa',
  'en_corte',
  'preparado_pendiente_retiro',
  'finalizado',
  'parcialmente_entregado',
  'entregado',
  'despachado',
  'bloqueado',
  'cancelado'
));`
    })

    if (addError) {
      console.error('❌ Error creando constraint:', addError)
      return NextResponse.json({ 
        success: false, 
        error: addError.message 
      }, { status: 500 })
    }

    console.log('✅ Constraint actualizado correctamente')

    return NextResponse.json({ 
      success: true,
      message: 'Constraint de orders actualizado con parcialmente_entregado'
    })
  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
