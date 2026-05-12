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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-slate-600">Entrada 24h</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.inbound_24h}</div>
          <div className="text-xs text-slate-500 mt-1">RAM → Velvok</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-slate-600">Salida 24h</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{stats.outbound_24h}</div>
          <div className="text-xs text-slate-500 mt-1">Velvok → RAM</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-slate-600">Exitosos 24h</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.success_24h}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-slate-600">Errores 24h</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed_24h}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-slate-600">Pendientes</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
          <div className="text-xs text-slate-500 mt-1">Por reintentar</div>
        </div>
      </div>

      <LogsClient
        initialLogs={logsResult.logs}
        totalLogs={logsResult.total}
        eventTypes={eventTypes}
      />
    </div>
  )
}
