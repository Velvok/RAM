import { getIntegrationLogs, getLogsStats, getEventTypes, markEventsAsViewed } from '@/app/actions/integration-logs'
import { LogsClient } from '@/components/logs/logs-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function LogsPage() {
  // Marcar eventos como vistos para limpiar el contador del sidebar
  await markEventsAsViewed()

  const [logsResult, stats, eventTypes] = await Promise.all([
    getIntegrationLogs({ limit: 100 }),
    getLogsStats(),
    getEventTypes(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Logs de Integración</h2>
        <p className="text-slate-600">Registro de eventos entre Velvok y RAM</p>
      </div>

      <LogsClient
        initialLogs={logsResult.logs}
        totalLogs={logsResult.total}
        eventTypes={eventTypes}
        initialStats={stats}
      />
    </div>
  )
}
