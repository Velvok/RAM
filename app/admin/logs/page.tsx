import { getIntegrationLogs, getIntegrationHealth, getEventTypes, markEventsAsViewed } from '@/app/actions/integration-logs'
import { LogsClient } from '@/components/logs/logs-client'

export const dynamic = 'force-dynamic'

export default async function LogsPage() {
  // Marcar eventos como vistos para limpiar el contador del menú
  await markEventsAsViewed()

  const [logsResult, health, eventTypes] = await Promise.all([
    getIntegrationLogs({ limit: 100, fromDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() }),
    getIntegrationHealth(),
    getEventTypes(),
  ])

  return <LogsClient initialLogs={logsResult.logs} totalLogs={logsResult.total} eventTypes={eventTypes} initialHealth={health} />
}
