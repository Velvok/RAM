/**
 * Snapshot System - Save and restore database state
 */

import { createAdminClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

export interface Snapshot {
  id: string
  timestamp: string
  description: string
  tables: Record<string, any[]>
}

const TABLES_TO_SNAPSHOT = [
  'orders',
  'order_lines',
  'cut_orders',
  'preparation_items',
  'inventory',
  'delivery_history',
  'order_activity_log',
  'stock_reservations'
]

const SNAPSHOTS_DIR = path.join(__dirname, '..', 'snapshots')

export async function createSnapshot(description: string = 'Pre-simulation'): Promise<Snapshot> {
  const supabase = createAdminClient()
  const timestamp = new Date().toISOString()
  const snapshotId = `snapshot-${timestamp.replace(/[:.]/g, '-')}`
  
  console.log('📸 Creating snapshot...')
  
  const snapshot: Snapshot = {
    id: snapshotId,
    timestamp,
    description,
    tables: {}
  }
  
  for (const table of TABLES_TO_SNAPSHOT) {
    console.log(`  📋 Snapshooting ${table}...`)
    const { data, error } = await supabase.from(table).select('*')
    
    if (error) {
      console.error(`  ❌ Error snapshooting ${table}:`, error.message)
      snapshot.tables[table] = []
    } else {
      snapshot.tables[table] = data || []
      console.log(`  ✅ ${table}: ${data?.length || 0} records`)
    }
  }
  
  // Save to file
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
  }
  
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`)
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
  
  console.log(`📸 Snapshot saved: ${snapshotPath}`)
  console.log(`   Total tables: ${Object.keys(snapshot.tables).length}`)
  console.log(`   Total records: ${Object.values(snapshot.tables).reduce((sum, records) => sum + records.length, 0)}`)
  
  return snapshot
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const supabase = createAdminClient()
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`)
  
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${snapshotPath}`)
  }
  
  console.log(`🔄 Restoring snapshot: ${snapshotId}...`)
  
  const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))
  
  // Delete in reverse order to respect foreign keys (children first)
  const deleteOrder = [
    'stock_reservations',
    'delivery_history',
    'order_activity_log',
    'preparation_items',
    'cut_orders',
    'order_lines',
    'inventory',
    'orders'
  ]
  
  for (const table of deleteOrder) {
    console.log(`  🚮  Clearing ${table}...`)
    
    // Delete current data
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (deleteError) {
      console.error(`  ⚠️  Warning deleting ${table}:`, deleteError.message)
    }
  }
  
  // Insert in correct order (parents first)
  const insertOrder = [
    'orders',
    'order_lines',
    'inventory',
    'cut_orders',
    'preparation_items',
    'delivery_history',
    'order_activity_log',
    'stock_reservations'
  ]
  
  for (const table of insertOrder) {
    const records = snapshot.tables[table] || []
    console.log(`  🔄 Restoring ${table}...`)
    
    // Insert snapshot data if there are records
    if (records.length > 0) {
      // Insert in batches to avoid payload size limits
      const BATCH_SIZE = 100
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        
        // For inventory table, exclude generated columns
        let dataToInsert = batch
        if (table === 'inventory') {
          dataToInsert = batch.map(record => {
            const { stock_disponible, ...rest } = record
            return rest
          })
        }
        
        const { error: insertError } = await supabase.from(table).insert(dataToInsert)
        
        if (insertError) {
          console.error(`  ❌ Error inserting into ${table}:`, insertError.message)
          throw new Error(`Failed to restore ${table}: ${insertError.message}`)
        }
      }
    }
    
    console.log(`  ✅ ${table}: ${records.length} records restored`)
  }
  
  console.log(`🔄 Snapshot restored successfully`)
}

export async function listSnapshots(): Promise<string[]> {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    return []
  }
  
  return fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
}

export function deleteSnapshot(snapshotId: string): void {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`)
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath)
    console.log(`🗑️  Deleted snapshot: ${snapshotId}`)
  }
}
