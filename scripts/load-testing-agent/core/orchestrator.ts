/**
 * Orchestrator - Coordinates the simulation execution
 */

import { createAdminClient } from '@/lib/supabase/server'
import { createSnapshot, restoreSnapshot } from './snapshot'
import { TransactionLogger } from './transaction-logger'
import { LiveDashboard } from './live-dashboard'

export interface SimulationConfig {
  totalOrders: number
  concurrentOrders: number
  slowThreshold: number // ms
  skipRollback: boolean
  verbose: boolean
}

export interface SimulationContext {
  simulationId: string
  config: SimulationConfig
  logger: TransactionLogger
  dashboard: LiveDashboard
  supabase: ReturnType<typeof createAdminClient>
  state: {
    orders: string[] // IDs of created orders
    currentOrderIndex: number
  }
}

export const DEFAULT_CONFIG: SimulationConfig = {
  totalOrders: 20,
  concurrentOrders: 5,
  slowThreshold: 5000,
  skipRollback: false,
  verbose: true
}

export async function runSimulation(
  config: Partial<SimulationConfig> = {}
): Promise<void> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const simulationId = `sim-${new Date().toISOString().replace(/[:.]/g, '-')}`
  
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║       🚀 RAM Load Testing Agent - Starting...              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`📋 Configuration:`)
  console.log(`   • Total orders: ${fullConfig.totalOrders}`)
  console.log(`   • Concurrent: ${fullConfig.concurrentOrders}`)
  console.log(`   • Slow threshold: ${fullConfig.slowThreshold}ms`)
  console.log(`   • Skip rollback: ${fullConfig.skipRollback}`)
  console.log('')
  
  // 0. Ensure test data exists
  console.log('0️⃣  Setting up test data...')
  const { ensureTestData } = await import('./setup')
  await ensureTestData()
  
  // 1. Create snapshot
  console.log('1️⃣  Creating initial snapshot...')
  const snapshot = await createSnapshot('Pre-simulation baseline')
  
  // 2. Initialize logger and dashboard
  const estimatedTransactions = fullConfig.totalOrders * 15 // ~15 ops per order
  const logger = new TransactionLogger(simulationId, estimatedTransactions)
  const dashboard = new LiveDashboard(simulationId)
  const supabase = createAdminClient()
  
  const context: SimulationContext = {
    simulationId,
    config: fullConfig,
    logger,
    dashboard,
    supabase,
    state: {
      orders: [],
      currentOrderIndex: 0
    }
  }
  
  // 3. Run simulation
  console.log('2️⃣  Running simulation...')
  const startTime = Date.now()
  let duration = '0.0'
  
  try {
    // Import scenarios dynamically
    const { runConcurrentOrders } = await import('../scenarios/concurrent-orders')
    const { runComplexCuts } = await import('../scenarios/complex-cuts')
    const { runEdgeCases } = await import('../scenarios/edge-cases')
    
    // Run scenarios
    await runConcurrentOrders(context)
    await runComplexCuts(context)
    await runEdgeCases(context)
    
    duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('')
    console.log(`✅ Simulation completed in ${duration}s`)
    console.log(`   Total transactions: ${logger.getTransactionCount()}`)
    
  } catch (error) {
    console.error('')
    console.error('❌ Simulation failed:', error)
    throw error
  } finally {
    dashboard.stop()
    logger.complete()
  }
  
  // 4. Validate results
  console.log('')
  console.log('3️⃣  Validating results...')
  const { validatePostSimulation } = await import('../validators/post-validation')
  const validation = await validatePostSimulation(context)
  
  if (validation.success) {
    console.log('   ✅ All validations passed')
  } else {
    console.log('   ⚠️  Validation issues found:')
    validation.issues.forEach((issue: string) => console.log(`      - ${issue}`))
  }
  
  // 5. Restore snapshot (unless skipped)
  if (!fullConfig.skipRollback) {
    console.log('')
    console.log('4️⃣  Restoring initial state...')
    await restoreSnapshot(snapshot.id)
    console.log('   ✅ State restored')
  } else {
    console.log('')
    console.log('4️⃣  ⏭️  Skipping rollback (skipRollback=true)')
  }
  
  // 6. Generate reports
  console.log('')
  console.log('5️⃣  Generating reports...')
  const { generateSummaryReport } = await import('../reports/summary-report')
  generateSummaryReport(simulationId)
  
  // 7. Print summary
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║              📊 Simulation Summary                           ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║  Duration:        ${duration.padStart(10)}s                              ║`)
  console.log(`║  Transactions:   ${String(logger.getTransactionCount()).padStart(10)}                                ║`)
  console.log(`║  Orders created:  ${String(context.state.orders.length).padStart(10)}                                ║`)
  console.log(`║  Validations:    ${validation.success ? '✅ PASSED' : '⚠️  ISSUES'}                           ║`)
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('📁 Output files:')
  console.log('   • output/live-progress.md')
  console.log('   • output/transaction-log.json')
  console.log('   • output/summary-report.md')
  console.log('')
}
