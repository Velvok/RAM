import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  // Test 1: Verificar si el estado aprobado_en_pausa existe
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .eq('status', 'aprobado_en_pausa')
      .limit(1)
    
    if (error) {
      results.tests.push({
        name: 'Estado aprobado_en_pausa',
        status: 'error',
        message: error.message,
        hint: error.message.includes('invalid input value') 
          ? 'La migración 00032 NO se ha aplicado. Ejecuta el SQL manualmente en Supabase Dashboard.'
          : 'Otro error'
      })
    } else {
      results.tests.push({
        name: 'Estado aprobado_en_pausa',
        status: 'success',
        message: 'El estado existe y se puede consultar'
      })
    }
  } catch (e: any) {
    results.tests.push({
      name: 'Estado aprobado_en_pausa',
      status: 'error',
      message: e.message
    })
  }

  // Test 2: Verificar RLS en annual_history
  try {
    const { data, error } = await supabase
      .from('annual_history')
      .select('id')
      .limit(1)
    
    if (error) {
      results.tests.push({
        name: 'RLS annual_history',
        status: 'error',
        message: error.message,
        hint: error.code === '42501' 
          ? 'La migración 00033 NO se ha aplicado. RLS aún está habilitado.'
          : 'Otro error'
      })
    } else {
      results.tests.push({
        name: 'RLS annual_history',
        status: 'success',
        message: 'RLS deshabilitado correctamente'
      })
    }
  } catch (e: any) {
    results.tests.push({
      name: 'RLS annual_history',
      status: 'error',
      message: e.message
    })
  }

  // Test 3: Verificar función consume_reserved_stock
  try {
    const { data, error } = await supabase
      .rpc('consume_reserved_stock', { p_inventory_id: '00000000-0000-0000-0000-000000000000' })
    
    // Esperamos error porque el ID no existe, pero la función debe existir
    if (error && !error.message.includes('violates foreign key')) {
      results.tests.push({
        name: 'Función consume_reserved_stock',
        status: error.message.includes('function') ? 'error' : 'success',
        message: error.message
      })
    } else {
      results.tests.push({
        name: 'Función consume_reserved_stock',
        status: 'success',
        message: 'La función existe'
      })
    }
  } catch (e: any) {
    results.tests.push({
      name: 'Función consume_reserved_stock',
      status: 'error',
      message: e.message
    })
  }

  return NextResponse.json(results, { status: 200 })
}
