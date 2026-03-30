import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  try {
    console.log('🔍 Verificando delivery_history...')
    
    // 1. Verificar si la tabla existe
    const { error: checkError } = await supabase
      .from('delivery_history')
      .select('id')
      .limit(1)

    if (checkError) {
      console.log('❌ Tabla delivery_history no existe:', checkError.message)
      
      // 2. Crear la tabla
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE delivery_history (
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

          CREATE INDEX idx_delivery_history_order_id ON delivery_history(order_id);
          CREATE INDEX idx_delivery_history_delivered_at ON delivery_history(delivered_at);
          CREATE INDEX idx_delivery_history_is_active ON delivery_history(is_active);
        `
      })

      if (createError) {
        console.error('❌ Error creando tabla:', createError)
        return NextResponse.json({ 
          success: false, 
          error: 'No se pudo crear la tabla delivery_history',
          details: createError.message 
        }, { status: 500 })
      }

      console.log('✅ Tabla delivery_history creada')
    } else {
      console.log('✅ Tabla delivery_history ya existe')
    }

    // 3. Verificar la función restore_reserved_stock
    try {
      const { error: funcError } = await supabase.rpc('restore_reserved_stock', {
        p_inventory_id: '00000000-0000-0000-0000-000000000000'
      })
      
      if (funcError) {
        console.log('❌ Función restore_reserved_stock no existe, creando...')
        
        const { error: createFuncError } = await supabase.rpc('exec_sql', {
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

        if (createFuncError) {
          console.error('❌ Error creando función:', createFuncError)
          return NextResponse.json({ 
            success: false, 
            error: 'No se pudo crear la función restore_reserved_stock',
            details: createFuncError.message 
          }, { status: 500 })
        }

        console.log('✅ Función restore_reserved_stock creada')
      } else {
        console.log('✅ Función restore_reserved_stock ya existe')
      }
    } catch (e) {
      console.log('❌ Función restore_reserved_stock no existe, creando...')
      
      const { error: createFuncError } = await supabase.rpc('exec_sql', {
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

      if (createFuncError) {
        console.error('❌ Error creando función:', createFuncError)
        return NextResponse.json({ 
          success: false, 
          error: 'No se pudo crear la función restore_reserved_stock',
          details: createFuncError.message 
        }, { status: 500 })
      }

      console.log('✅ Función restore_reserved_stock creada')
    }

    // 4. Verificar políticas RLS para delivery_history
    const { error: policyError } = await supabase
      .from('delivery_history')
      .select('id')
      .limit(1)

    if (policyError) {
      console.log('❌ Error de políticas RLS, creando políticas...')
      
      const { error: createPolicyError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE delivery_history ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Admin full access to delivery_history" ON delivery_history
            FOR ALL
            USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
            WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
        `
      })

      if (createPolicyError) {
        console.error('❌ Error creando políticas:', createPolicyError)
        return NextResponse.json({ 
          success: false, 
          error: 'No se pudieron crear las políticas RLS para delivery_history',
          details: createPolicyError.message 
        }, { status: 500 })
      }

      console.log('✅ Políticas RLS para delivery_history creadas')
    }

    return NextResponse.json({
      success: true,
      message: 'delivery_history y restore_reserved_stock verificados/creados correctamente'
    })

  } catch (error: any) {
    console.error('❌ Error general:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
