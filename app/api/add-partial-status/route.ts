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

    console.log('🔧 Verificando y agregando estado parcialmente_entregado...')

    // Verificar si el valor ya existe
    const { data: existingValues, error: checkError } = await supabase
      .rpc('exec_sql', {
        sql: "SELECT unnest(enum_range(NULL::order_status))::text as value;"
      })

    if (checkError) {
      console.error('Error verificando enum:', checkError)
    } else {
      console.log('Valores actuales del enum:', existingValues)
      
      const hasPartialStatus = existingValues?.some((row: any) => 
        row.value === 'parcialmente_entregado'
      )
      
      if (hasPartialStatus) {
        console.log('✅ El estado parcialmente_entregado ya existe')
        return NextResponse.json({ 
          success: true,
          message: 'El estado parcialmente_entregado ya existe',
          alreadyExists: true
        })
      }
    }

    // Agregar el nuevo valor
    console.log('➕ Agregando nuevo valor al enum...')
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TYPE order_status ADD VALUE 'parcialmente_entregado';"
    })

    if (addError) {
      console.error('❌ Error agregando valor:', addError)
      return NextResponse.json({ 
        success: false, 
        error: addError.message 
      }, { status: 500 })
    }

    console.log('✅ Estado parcialmente_entregado agregado correctamente')

    return NextResponse.json({ 
      success: true,
      message: 'Estado parcialmente_entregado agregado correctamente'
    })
  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
