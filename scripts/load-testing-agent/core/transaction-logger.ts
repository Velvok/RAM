/**
 * Transaction Logger - Detailed logging of every operation
 */

import fs from 'fs'
import path from 'path'

export interface TransactionLog {
  id: string
  timestamp: string
  operation: string
  actor: 'admin' | 'operator' | 'system'
  entityType: string
  entityId: string
  beforeState: any
  afterState: any
  payload: any
  result: 'success' | 'error'
  errorDetails?: string
  durationMs: number
  relatedEntities?: {
    inventories?: string[]
    cutOrders?: string[]
    preparationItems?: string[]
    orders?: string[]
  }
}

export interface LogMetadata {
  simulationId: string
  startTime: string
  endTime?: string
  status: 'running' | 'completed' | 'error'
  progress: {
    completed: number
    total: number
    percentage: number
  }
  summary?: {
    totalTransactions: number
    successful: number
    failed: number
    slowTransactions: number // >5s
    avgDuration: number
  }
}

const OUTPUT_DIR = path.join(__dirname, '..', 'output')

export class TransactionLogger {
  private simulationId: string
  private startTime: string
  private estimatedTotal: number
  private logFilePath: string
  private transactionCount: number = 0
  private slowThreshold: number = 5000 // 5 seconds

  constructor(simulationId: string, estimatedTotal: number = 100) {
    this.simulationId = simulationId
    this.startTime = new Date().toISOString()
    this.estimatedTotal = estimatedTotal
    this.logFilePath = path.join(OUTPUT_DIR, 'transaction-log.json')
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
    
    // Initialize log file
    this.initializeLogFile()
  }

  private initializeLogFile(): void {
    const initialData = {
      metadata: {
        simulationId: this.simulationId,
        startTime: this.startTime,
        status: 'running',
        progress: {
          completed: 0,
          total: this.estimatedTotal,
          percentage: 0
        }
      },
      transactions: []
    }
    
    fs.writeFileSync(this.logFilePath, JSON.stringify(initialData, null, 2))
  }

  logTransaction(transaction: Omit<TransactionLog, 'id' | 'timestamp'>): TransactionLog {
    const fullTransaction: TransactionLog = {
      ...transaction,
      id: `txn-${String(this.transactionCount + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString()
    }
    
    this.transactionCount++
    
    // Read current log
    const currentData = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'))
    
    // Append transaction
    currentData.transactions.push(fullTransaction)
    
    // Update metadata
    currentData.metadata.progress.completed = this.transactionCount
    currentData.metadata.progress.percentage = Math.round(
      (this.transactionCount / this.estimatedTotal) * 100
    )
    currentData.metadata.lastUpdate = new Date().toISOString()
    
    // Calculate running summary
    const durations = currentData.transactions.map((t: TransactionLog) => t.durationMs)
    currentData.metadata.summary = {
      totalTransactions: this.transactionCount,
      successful: currentData.transactions.filter((t: TransactionLog) => t.result === 'success').length,
      failed: currentData.transactions.filter((t: TransactionLog) => t.result === 'error').length,
      slowTransactions: currentData.transactions.filter((t: TransactionLog) => t.durationMs > this.slowThreshold).length,
      avgDuration: Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
    }
    
    // Write back
    fs.writeFileSync(this.logFilePath, JSON.stringify(currentData, null, 2))
    
    // Also log to console for immediate feedback
    const status = fullTransaction.result === 'success' ? '✅' : '❌'
    const duration = fullTransaction.durationMs > this.slowThreshold 
      ? `⚠️  ${fullTransaction.durationMs}ms` 
      : `${fullTransaction.durationMs}ms`
    
    console.log(`  ${status} ${fullTransaction.operation.padEnd(20)} | ${duration.padStart(10)} | ${fullTransaction.entityId}`)
    
    return fullTransaction
  }

  complete(): void {
    const currentData = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'))
    currentData.metadata.status = 'completed'
    currentData.metadata.endTime = new Date().toISOString()
    fs.writeFileSync(this.logFilePath, JSON.stringify(currentData, null, 2))
  }

  getTransactionCount(): number {
    return this.transactionCount
  }

  getRecentTransactions(count: number = 5): TransactionLog[] {
    const currentData = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'))
    return currentData.transactions.slice(-count)
  }
}

export function readTransactionLog(): { metadata: LogMetadata; transactions: TransactionLog[] } {
  const logFilePath = path.join(OUTPUT_DIR, 'transaction-log.json')
  if (!fs.existsSync(logFilePath)) {
    return { metadata: {} as LogMetadata, transactions: [] }
  }
  return JSON.parse(fs.readFileSync(logFilePath, 'utf-8'))
}
