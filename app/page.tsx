import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="space-y-8">
          <div>
            <h1 className="text-6xl font-bold text-white mb-4">
              RAM <span className="text-blue-400">Velvok</span>
            </h1>
            <p className="text-2xl text-slate-300 mb-2">
              Sistema de Gestión de Corte y Stock
            </p>
            <p className="text-lg text-slate-400 italic">
              From Operation to Intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <Link 
              href="/admin"
              className="group relative overflow-hidden rounded-lg bg-white/10 backdrop-blur-sm p-8 hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-2">Administración</h2>
                <p className="text-slate-300">Dashboard gerencial completo</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-400 text-left">
                  <li>• Gestión de pedidos y stock</li>
                  <li>• Órdenes de corte</li>
                  <li>• Reportes y KPIs</li>
                  <li>• Configuración del sistema</li>
                </ul>
              </div>
            </Link>

            <Link 
              href="/planta"
              className="group relative overflow-hidden rounded-lg bg-slate-800/50 backdrop-blur-sm p-8 hover:bg-slate-800/70 transition-all duration-300 border border-slate-700"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-2">Planta</h2>
                <p className="text-slate-300">Interfaz operativa para tablets</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-400 text-left">
                  <li>• Login con PIN</li>
                  <li>• Órdenes de corte asignadas</li>
                  <li>• Registro de operaciones</li>
                  <li>• Modo offline-first</li>
                </ul>
              </div>
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div className="text-slate-400">
                <div className="text-white font-semibold mb-2">✅ Base de Datos</div>
                <div>18 tablas creadas</div>
                <div>RLS configurado</div>
              </div>
              <div className="text-slate-400">
                <div className="text-white font-semibold mb-2">✅ Integración</div>
                <div>Webhook ERP Evo</div>
                <div>Supabase conectado</div>
              </div>
              <div className="text-slate-400">
                <div className="text-white font-semibold mb-2">🚧 En Desarrollo</div>
                <div>Autenticación</div>
                <div>Pantallas operativas</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
