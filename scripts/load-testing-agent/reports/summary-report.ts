/**
 * Summary Report Generator
 */

import fs from 'fs'
import path from 'path'
import { readTransactionLog } from '../core/transaction-logger'

const OUTPUT_DIR = path.join(__dirname, '..', 'output')

export function generateSummaryReport(simulationId: string): void {
  const { metadata, transactions } = readTransactionLog()
  
  if (!metadata || transactions.length === 0) {
    console.log('No transaction data to generate report')
    return
  }
  
  const summary = metadata.summary || {
    totalTransactions: transactions.length,
    successful: transactions.filter(t => t.result === 'success').length,
    failed: transactions.filter(t => t.result === 'error').length,
    slowTransactions: transactions.filter(t => t.durationMs > 5000).length,
    avgDuration: Math.round(transactions.reduce((sum, t) => sum + t.durationMs, 0) / transactions.length)
  }
  
  const startTime = new Date(metadata.startTime).toLocaleString()
  const endTime = metadata.endTime ? new Date(metadata.endTime).toLocaleString() : 'N/A'
  const duration = metadata.endTime 
    ? ((new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime()) / 1000 / 60).toFixed(1)
    : 'N/A'
  
  // Group transactions by operation
  const byOperation = transactions.reduce((acc, t) => {
    acc[t.operation] = (acc[t.operation] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  // Get slowest transactions
  const slowestTransactions = [...transactions]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5)
  
  const report = `# Informe de Simulación RAM - Resumen Ejecutivo

**ID**: ${simulationId}  
**Inicio**: ${startTime}  
**Fin**: ${endTime}  
**Duración**: ${duration} minutos

---

## 📊 Métricas Generales

| Métrica | Valor |
|---------|-------|
| **Transacciones totales** | ${summary.totalTransactions} |
| **Exitosas** | ${summary.successful} ✅ |
| **Fallidas** | ${summary.failed} ❌ |
| **Lentas (>5s)** | ${summary.slowTransactions} ⚠️ |
| **Tiempo promedio** | ${summary.avgDuration}ms |

---

## 📈 Transacciones por Tipo

| Operación | Cantidad | % del total |
|-----------|----------|-------------|
${Object.entries(byOperation).map(([op, count]) => 
  `| ${op} | ${count} | ${((count / summary.totalTransactions) * 100).toFixed(1)}% |`
).join('\n')}

---

## 🐌 Transacciones Más Lentas

| # | Operación | Duración | ID |
|---|-----------|----------|----|
${slowestTransactions.map((t, i) => 
  `| ${i + 1} | ${t.operation} | ${t.durationMs}ms | ${t.entityId} |`
).join('\n')}

---

## ✅ Validaciones

**Estado**: ${metadata.status === 'completed' ? '✅ Completado exitosamente' : '⚠️ Interrumpido'}

${summary.failed === 0 ? '✅ No se detectaron errores durante la simulación.' : `⚠️ Se detectaron ${summary.failed} errores.`}

${summary.slowTransactions === 0 ? '✅ Todas las transacciones completadas en menos de 5 segundos.' : `⚠️ ${summary.slowTransactions} transacciones tardaron más de 5 segundos.`}

---

## 📁 Archivos Generados

- transaction-log.json - Log detallado de todas las transacciones
- live-progress.md - Dashboard en tiempo real (ultimo estado)
- analysis-report.json - Analisis tecnico para debugging

---

*Generado el ${new Date().toLocaleString()}*
`

  const reportPath = path.join(OUTPUT_DIR, 'summary-report.md')
  fs.writeFileSync(reportPath, report)
  
  console.log(`📄 Summary report generated: ${reportPath}`)
}
