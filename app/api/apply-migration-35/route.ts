import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  
  try {
    // Aplicar la migración 00035
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Eliminar el constraint existente
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

        -- Crear el constraint actualizado con el nuevo estado
        ALTER TABLE orders ADD CONSTRAINT orders_status_check 
          CHECK (status IN ('nuevo', 'borrador', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'entregado', 'cancelado'));
      `
    })

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migración 00035 aplicada correctamente' 
    })
  } catch (e: any) {
    return NextResponse.json({ 
      success: false, 
      error: e.message 
    }, { status: 500 })
  }
}
