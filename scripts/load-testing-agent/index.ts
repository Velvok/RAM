#!/usr/bin/env node

/**
 * RAM Load Testing Agent
 * 
 * Usage:
 *   npx tsx scripts/load-testing-agent/index.ts --orders=20 --live
 *   npx tsx scripts/load-testing-agent/index.ts --skip-rollback
 * 
 * Options:
 *   --orders=N        Number of orders to create (default: 20)
 *   --concurrent=N    Concurrent operations (default: 5)
 *   --slow-threshold  Slow transaction threshold in ms (default: 5000)
 *   --skip-rollback   Don't restore snapshot after simulation
 *   --verbose         Detailed console output
 *   --help            Show this help
 */

import { runSimulation, DEFAULT_CONFIG } from './core/orchestrator'

// Check environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables')
  console.error('   Make sure .env.local is loaded with:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Parse command line arguments
const args = process.argv.slice(2)
const cliConfig: any = {}

for (const arg of args) {
  if (arg === '--help' || arg === '-h') {
    console.log(`
RAM Load Testing Agent

Usage:
  npx tsx scripts/load-testing-agent/index.ts [options]

Options:
  --orders=N         Number of orders to create (default: 20)
  --concurrent=N     Concurrent operations (default: 5)
  --slow-threshold   Slow transaction threshold in ms (default: 5000)
  --skip-rollback    Don't restore snapshot after simulation
  --verbose          Detailed console output
  --help             Show this help

Examples:
  # Run with defaults (20 orders, live dashboard)
  npx tsx scripts/load-testing-agent/index.ts

  # Run with 50 orders
  npx tsx scripts/load-testing-agent/index.ts --orders=50

  # Run and keep data (no rollback)
  npx tsx scripts/load-testing-agent/index.ts --skip-rollback
`)
    process.exit(0)
  }
  
  if (arg.startsWith('--orders=')) {
    cliConfig.totalOrders = parseInt(arg.split('=')[1])
  } else if (arg.startsWith('--concurrent=')) {
    cliConfig.concurrentOrders = parseInt(arg.split('=')[1])
  } else if (arg.startsWith('--slow-threshold=')) {
    cliConfig.slowThreshold = parseInt(arg.split('=')[1])
  } else if (arg === '--skip-rollback') {
    cliConfig.skipRollback = true
  } else if (arg === '--verbose') {
    cliConfig.verbose = true
  }
}

// Validate config
if (cliConfig.totalOrders && (cliConfig.totalOrders < 1 || cliConfig.totalOrders > 100)) {
  console.error('Error: --orders must be between 1 and 100')
  process.exit(1)
}

console.log('🚀 Starting RAM Load Testing Agent...')
console.log('')

// Run simulation
runSimulation(cliConfig)
  .then(() => {
    console.log('')
    console.log('✨ All done! Check output/ directory for detailed reports.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('💥 Simulation failed:', error)
    process.exit(1)
  })
