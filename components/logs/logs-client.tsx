'use client'

import { useState, useEffect, useMemo, Fragment as FragmentRow } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getIntegrationLogs, getLogsStats, retryOutboundEvent, sendTestEvent, type IntegrationLog, type LogsFilters } from '@/app/actions/integration-logs'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle, Clock, RefreshCw, Search, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { toast } from 'sonner'

interface LogsStats {
  inbound_24h: number
  outbound_24h: number
  success_24h: number
  failed_24h: number
  pending: number
}

interface LogsClientProps {
  initialLogs: IntegrationLog[]
  totalLogs: number
  eventTypes: string[]
  initialStats: LogsStats
}

export function LogsClient({ initialLogs, totalLogs, eventTypes, initialStats }: LogsClientProps) {
  const [logs, setLogs] = useState<IntegrationLog[]>(initialLogs)
  const [total, setTotal] = useState(totalLogs)
  const [stats, setStats] = useState<LogsStats>(initialStats)
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [newLogsCount, setNewLogsCount] = useState(0)

  const [filters, setFilters] = useState<LogsFilters>({
    direction: 'all',
    status: 'all',
    search: '',
    limit: 100,
    offset: 0,
  })

  // Suscripción a Realtime + auto-refresh inmediato cuando llegan eventos
  useEffect(() => {
    const supabase = createClient()
    let refreshTimeout: NodeJS.Timeout | null = null

    const triggerRefresh = () => {
      // Debounce: agrupar múltiples eventos en un único refresh
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        refreshLogs()
      }, 800)
    }

    const channel = supabase
      .channel('integration-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evo_events' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbound_events' }, triggerRefresh)
      .subscribe((status) => {
        console.log('[Logs] realtime status:', status)
      })

    // Fallback: polling cada 10s por si Realtime falla
    const pollInterval = setInterval(() => {
      refreshLogs()
    }, 10000)

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout)
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshLogs = async () => {
    setLoading(true)
    try {
      const [result, newStats] = await Promise.all([
        getIntegrationLogs(filters),
        getLogsStats()
      ])
      setLogs(result.logs)
      setTotal(result.total)
      setStats(newStats)
      setNewLogsCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh cuando cambian filtros
  useEffect(() => {
    refreshLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.direction, filters.status, filters.eventType, filters.offset])

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search, offset: 0 }))
  }

  const handleRetry = async (eventId: string) => {
    try {
      const result = await retryOutboundEvent(eventId)
      if (result.success) {
        toast.success('Evento reenviado exitosamente')
      } else {
        toast.error('Reintento falló', { description: result.error })
      }
      await refreshLogs()
    } catch (error: any) {
      toast.error('Error al reintentar', { description: error.message })
    }
  }

  const handleSendTest = async () => {
    try {
      await sendTestEvent()
      toast.success('Ping de prueba enviado a RAM', {
        description: 'Revisa el resultado en la lista',
      })
      setTimeout(refreshLogs, 1500)
    } catch (error: any) {
      toast.error('Error enviando test', { description: error.message })
    }
  }

  const filteredLogs = useMemo(() => {
    if (!filters.search) return logs
    const searchLower = filters.search.toLowerCase()
    return logs.filter(log =>
      log.event_type?.toLowerCase().includes(searchLower) ||
      log.error_message?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchLower)
    )
  }, [logs, filters.search])

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
    }
    const icons: Record<string, any> = {
      success: <CheckCircle2 className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      processing: <RefreshCw className="w-3 h-3 animate-spin" />,
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
        {icons[status]}
        {status}
      </span>
    )
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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

      <div className="bg-white rounded-lg shadow">
        {/* Filtros */}
        <div className="p-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por tipo, error o payload..."
              value={filters.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dirección */}
          <select
            value={filters.direction}
            onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value as any, offset: 0 }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las direcciones</option>
            <option value="inbound">📥 Entrada (RAM → Velvok)</option>
            <option value="outbound">📤 Salida (Velvok → RAM)</option>
          </select>

          {/* Estado */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any, offset: 0 }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="success">✅ Exitoso</option>
            <option value="failed">❌ Fallido</option>
            <option value="pending">⏳ Pendiente</option>
          </select>

          {/* Tipo de evento */}
          <select
            value={filters.eventType || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value || undefined, offset: 0 }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {/* Test ping */}
          <button
            onClick={handleSendTest}
            className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2 text-sm font-medium"
            title="Enviar evento de prueba a RAM"
          >
            <Send className="w-4 h-4" />
            Test Ping
          </button>

          {/* Refrescar */}
          <button
            onClick={refreshLogs}
            disabled={loading}
            className="relative px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
            {newLogsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {newLogsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-12"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dirección</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo de Evento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">HTTP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Error</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No hay logs de integración para mostrar
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <FragmentRow key={log.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        {expandedRow === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {log.direction === 'inbound' ? (
                        <span className="inline-flex items-center gap-1 text-blue-700 font-medium text-sm">
                          <ArrowDownCircle className="w-4 h-4" />
                          Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-medium text-sm">
                          <ArrowUpCircle className="w-4 h-4" />
                          Salida
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-900">{log.event_type}</td>
                    <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {log.http_status ? (
                        <span className={`font-mono ${log.http_status >= 200 && log.http_status < 300 ? 'text-green-600' : 'text-red-600'}`}>
                          {log.http_status}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                      {log.error_message || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.direction === 'outbound' && log.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(log.id)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                          title="Reintentar"
                        >
                          <RefreshCw className="w-3 h-3 inline mr-1" />
                          Reintentar
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-slate-50">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Payload</h4>
                            <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-x-auto max-h-64">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                          {(log.response_body || log.error_message) && (
                            <div>
                              <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">
                                {log.status === 'success' ? 'Respuesta' : 'Error'}
                              </h4>
                              <pre className={`p-3 rounded text-xs overflow-x-auto max-h-64 ${
                                log.status === 'failed' ? 'bg-red-50 text-red-900' : 'bg-slate-900 text-blue-400'
                              }`}>
                                {log.response_body
                                  ? JSON.stringify(log.response_body, null, 2)
                                  : log.error_message}
                              </pre>
                            </div>
                          )}
                          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-slate-500">ID:</span>
                              <p className="font-mono text-slate-900">{log.id}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Origen:</span>
                              <p className="font-mono text-slate-900">{log.source}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Intentos:</span>
                              <p className="font-mono text-slate-900">{log.attempts}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Entidad relacionada:</span>
                              <p className="font-mono text-slate-900">
                                {log.related_entity_type ? `${log.related_entity_type}` : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
        <div>
          Mostrando {(filters.offset || 0) + 1} - {Math.min((filters.offset || 0) + filteredLogs.length, total)} de {total} logs
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - (prev.limit || 100)) }))}
            disabled={(filters.offset || 0) === 0}
            className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 100) }))}
            disabled={(filters.offset || 0) + (filters.limit || 100) >= total}
            className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
