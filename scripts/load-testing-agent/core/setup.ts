/**
 * Setup - Ensure test data exists before running simulation
 */

import { createAdminClient } from '@/lib/supabase/server'

export async function ensureTestData(): Promise<void> {
  const supabase = createAdminClient()
  
  console.log('🔧 Checking test data...')
  
  // Check if inventory exists
  const { count: inventoryCount, error: countError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('Error checking inventory:', countError)
    return
  }
  
  if (inventoryCount && inventoryCount > 0) {
    console.log(`   ✅ Inventory exists: ${inventoryCount} records`)
    return
  }
  
  console.log('   ⚠️  No inventory found. Creating test inventory...')
  
  // Get products
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, code, name')
    .limit(100)
  
  if (productError || !products || products.length === 0) {
    console.error('No products found to create inventory')
    return
  }
  
  // Create inventory entries with random stock
  const inventoryEntries = products.map(product => ({
    product_id: product.id,
    stock_total: 60,
    stock_generado: 0,
    stock_reservado: 0,
    stock_en_proceso: 0
  }))
  
  const { error: insertError } = await supabase
    .from('inventory')
    .insert(inventoryEntries)
  
  if (insertError) {
    console.error('Error creating inventory:', insertError)
  } else {
    console.log(`   ✅ Created ${inventoryEntries.length} inventory entries`)
  }
}
