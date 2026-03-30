import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  try {
    console.log('🔧 Aplicando migraciones directamente...')

    // 1. Crear tabla delivery_history
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS delivery_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id),
          delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          delivered_by UUID REFERENCES auth.users(id),
          previous_status VARCHAR(50) NOT NULL,
          stock_consumed JSONB NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delivery_history_order_id ON delivery_history(order_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_history_delivered_at ON delivery_history(delivered_at);
        CREATE INDEX IF NOT EXISTS idx_delivery_history_is_active ON delivery_history(is_active);
      `
    })

    if (tableError) {
      console.error('❌ Error creando tabla:', tableError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error creando delivery_history',
        details: tableError.message 
      }, { status: 500 })
    }

    // 2. Crear función restore_reserved_stock
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION restore_reserved_stock(p_inventory_id UUID)
        RETURNS VOID AS $$
        BEGIN
          UPDATE inventory
          SET
            stock_total = stock_total + 1,
            stock_reservado = stock_reservado + 1
          WHERE id = p_inventory_id;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (funcError) {
      console.error('❌ Error creando función:', funcError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error creando restore_reserved_stock',
        details: funcError.message 
      }, { status: 500 })
    }

    // 3. Crear políticas RLS para delivery_history
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE delivery_history ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Admin full access to delivery_history" ON delivery_history;
        
        CREATE POLICY "Admin full access to delivery_history" ON delivery_history
          FOR ALL
          USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
          WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
      `
    })

    if (policyError) {
      console.error('❌ Error creando políticas:', policyError)
      return NextResponse.json({ 
        success: false, 
        error: 'Error creando políticas RLS para delivery_history',
        details: policyError.message 
      }, { status: 500 })
    }

    // 4. Verificar que todo funciona
    const { error: testError } = await supabase
      .from('delivery_history')
      .select('id')
      .limit(1)

    return NextResponse.json({
      success: true,
      message: 'Migraciones aplicadas correctamente',
      verification: {
        table_exists: !testError,
        test_error: testError?.message || null
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
