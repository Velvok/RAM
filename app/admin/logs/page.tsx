import { getIntegrationLogs, getLogsStats, getEventTypes, markEventsAsViewed } from '@/app/actions/integration-logs'
import { LogsClient } from '@/components/logs/logs-client'
import { PageHeader } from '@/components/page-header'

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
      <PageHeader title="Logs de Integración" subtitle="Registro de eventos entre Velvok y RAM" />

      <LogsClient
        initialLogs={logsResult.logs}
        totalLogs={logsResult.total}
        eventTypes={eventTypes}
        initialStats={stats}
      />
    </div>
  )
}
