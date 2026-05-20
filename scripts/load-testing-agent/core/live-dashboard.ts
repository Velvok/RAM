/**
 * Live Dashboard - Real-time progress display in markdown file
 */

import fs from 'fs'
import path from 'path'
import { TransactionLog, LogMetadata } from './transaction-logger'

const OUTPUT_DIR = path.join(__dirname, '..', 'output')

interface DashboardState {
  simulationId: string
  startTime: string
  currentTransaction?: TransactionLog
  recentTransactions: TransactionLog[]
  metadata: LogMetadata
  counts: {
    orders: { created: number; delivered: number; partial: number; byStatus: Record<string, number> }
    cutOrders: { total: number; byStatus: Record<string, number> }
    inventory: { consumed: number; generated: number }
  }
}

export class LiveDashboard {
  private interval: NodeJS.Timeout | null = null
  private dashboardPath: string
  private state: DashboardState

  constructor(simulationId: string) {
    this.dashboardPath = path.join(OUTPUT_DIR, 'live-progress.md')
    
    this.state = {
      simulationId,
      startTime: new Date().toISOString(),
      recentTransactions: [],
      metadata: {
        simulationId,
        startTime: new Date().toISOString(),
        status: 'running',
        progress: { completed: 0, total: 100, percentage: 0 }
      },
      counts: {
        orders: { created: 0, delivered: 0, partial: 0, byStatus: {} },
        cutOrders: { total: 0, byStatus: {} },
        inventory: { consumed: 0, generated: 0 }
      }
    }
    
    this.start()
  }

  start(): void {
    // Initial write
    this.update()
    
    // Update every 2 seconds
    this.interval = setInterval(() => {
      this.update()
    }, 2000)
    
    console.log(`📊 Live dashboard started: ${this.dashboardPath}`)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    
    // Final update
    this.state.metadata.status = 'completed'
    this.state.metadata.endTime = new Date().toISOString()
    this.update()
    
    console.log(`📊 Live dashboard stopped`)
  }

  updateState(updates: Partial<DashboardState>): void {
    this.state = { ...this.state, ...updates }
  }

  setCurrentTransaction(transaction: TransactionLog): void {
    this.state.currentTransaction = transaction
    this.state.recentTransactions.unshift(transaction)
    if (this.state.recentTransactions.length > 10) {
      this.state.recentTransactions.pop()
    }
    this.update()
  }

  updateMetadata(metadata: LogMetadata): void {
    this.state.metadata = metadata
  }

  private update(): void {
    const content = this.generateDashboard()
    fs.writeFileSync(this.dashboardPath, content)
  }

  private generateDashboard(): string {
    const elapsed = this.getElapsedTime()
    const { metadata, currentTransaction, recentTransactions, counts } = this.state
    const summary = metadata.summary || { totalTransactions: 0, successful: 0, failed: 0, slowTransactions: 0, avgDuration: 0 }
    
    return `# ${metadata.status === 'running' ? '🔴' : '✅'} Simulación RAM - ${metadata.status === 'running' ? 'En Progreso' : 'Completada'}

**ID**: ${this.state.simulationId}  
**Inicio**: ${new Date(this.state.startTime).toLocaleString()}  
**Tiempo transcurrido**: ${elapsed}  
**Estado**: ${metadata.status === 'running' ? '⏳ En progreso' : '✅ Completado'}

---

## 📊 Progreso General

| Métrica | Valor |
|---------|-------|
| Transacciones | ${metadata.progress.completed}/${metadata.progress.total} (${metadata.progress.percentage}%) |
| Exitosas | ${summary.successful} ✅ |
| Fallidas | ${summary.failed} ❌ |
| Lentas (>5s) | ${summary.slowTransactions} ⚠️ |
| Tiempo promedio | ${summary.avgDuration}ms |

---

## 📦 Pedidos

| Estado | Cantidad |
|--------|----------|
| **Creados** | ${counts.orders.created} |
| **Entregados** | ${counts.orders.delivered} ✅ |
| **Parcialmente** | ${counts.orders.partial} 🟡 |
| Pendientes | ${counts.orders.byStatus['nuevo'] || 0} |
| En corte | ${counts.orders.byStatus['en_corte'] || 0} |

---

## 🔧 Órdenes de Corte

| Estado | Cantidad |
|--------|----------|
| **Total** | ${counts.cutOrders.total} |
| Pendientes | ${counts.cutOrders.byStatus['pendiente'] || 0} |
| En proceso | ${counts.cutOrders.byStatus['en_proceso'] || 0} |
| Completadas | ${counts.cutOrders.byStatus['completada'] || 0} |

---

## 📦 Stock

| Métrica | Valor |
|---------|-------|
| Consumido | ${counts.inventory.consumed} unidades |
| Generado (remanentes) | ${counts.inventory.generated} unidades |

---

## ⏳ Transacción Actual

${currentTransaction ? `
**Operación**: \`${currentTransaction.operation}\`  
**Actor**: ${currentTransaction.actor}  
**Entidad**: ${currentTransaction.entityType} (\`${currentTransaction.entityId}\`)  
**Iniciada**: ${new Date(currentTransaction.timestamp).toLocaleTimeString()}  
**Estado**: ${currentTransaction.result === 'success' ? '✅ Completada' : '❌ Error'}
${currentTransaction.errorDetails ? `**Error**: ${currentTransaction.errorDetails}` : ''}
` : '*Esperando siguiente transacción...*'}

---

## 📜 Últimas Transacciones

| # | Operación | Actor | Duración | Estado |
|---|-----------|-------|----------|--------|
${recentTransactions.slice(0, 5).map((t, i) => 
  `| ${recentTransactions.length - i} | ${t.operation} | ${t.actor} | ${t.durationMs}ms | ${t.result === 'success' ? '✅' : '❌'} |`
).join('\n')}

---

## 🎯 Próximas Operaciones

${this.generateNextOperations()}

---

*Actualizado: ${new Date().toLocaleTimeString()}*  
*Archivo: \`output/transaction-log.json\` para detalles completos*
`
  }

  private getElapsedTime(): string {
    const start = new Date(this.state.startTime).getTime()
    const now = Date.now()
    const diff = now - start
    
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    return `${minutes}m ${seconds}s`
  }

  private generateNextOperations(): string {
    // This would show upcoming operations based on the scenario
    // For now, just show a placeholder
    const remaining = this.state.metadata.progress.total - this.state.metadata.progress.completed
    if (remaining <= 0) {
      return '✅ Todas las operaciones completadas'
    }
    return `${remaining} operaciones pendientes...`
  }
}
