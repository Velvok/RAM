import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EvoMonitoringPage() {
  const supabase = createAdminClient()

  // Obtener eventos recientes
  const { data: recentEvents } = await supabase
    .from('evo_events')
    .select(`
      id_evento,
      tipo_evento,
      processed_at,
      success,
      errors,
      payload
    `)
    .order('processed_at', { ascending: false })
    .limit(10)

  // Obtener resumen de actividad
  const { data: activitySummary } = await supabase
    .from('evo_events')
    .select('tipo_evento, success, processed_at')
    .gte('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Estadísticas
  const stats = {
    total: activitySummary?.length || 0,
    successful: activitySummary?.filter(e => e.success).length || 0,
    failed: activitySummary?.filter(e => !e.success).length || 0,
    stockUpdates: activitySummary?.filter(e => e.tipo_evento === 'stock_actualizado').length || 0,
    ordersCreated: activitySummary?.filter(e => e.tipo_evento === 'pedido_creado').length || 0,
    deliveries: activitySummary?.filter(e => e.tipo_evento === 'pedido_entregado').length || 0,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">🔍 Monitoreo EVO</h1>
        <p className="text-slate-600 mt-1">Eventos recibidos del sistema EVO en tiempo real</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-slate-600">Total Eventos (24h)</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
          <div className="text-sm text-slate-600">Exitosos</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-sm text-slate-600">Fallidos</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">{stats.stockUpdates}</div>
          <div className="text-sm text-slate-600">Updates Stock</div>
        </div>
      </div>

      {/* Eventos recientes */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Eventos Recientes</h2>
        </div>
        <div className="p-6">
          {recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div key={event.id_evento} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        event.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {event.success ? '✅' : '❌'} {event.tipo_evento}
                      </span>
                      <span className="text-sm text-slate-600">
                        {new Date(event.processed_at).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-slate-500">
                      {event.id_evento}
                    </span>
                  </div>
                  {event.errors && event.errors.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      Errores: {event.errors.join(', ')}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    <pre className="bg-slate-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.payload, null, 2).substring(0, 200)}...
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 text-lg">📭</div>
              <p className="text-slate-600 mt-2">No se han recibido eventos de EVO</p>
              <p className="text-slate-500 text-sm mt-1">
                Verifica que EVO esté enviando a: https://comercial-ram.vercel.app/webhooks/...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Cómo verificar recepción de datos</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>1. <strong>Logs Vercel:</strong> Revisa el dashboard de Vercel → Functions → Logs</p>
          <p>2. <strong>Base de datos:</strong> Ejecuta <code>SELECT * FROM evo_events_recent;</code> en Supabase</p>
          <p>3. <strong>Esta página:</strong> Recarga para ver eventos en tiempo real</p>
          <p>4. <strong>Endpoints EVO:</strong></p>
          <ul className="ml-4 list-disc">
            <li>POST https://comercial-ram.vercel.app/webhooks/stock/actualizado</li>
            <li>POST https://comercial-ram.vercel.app/webhooks/pedidos/nuevo</li>
            <li>POST https://comercial-ram.vercel.app/webhooks/pedidos/entregado</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
