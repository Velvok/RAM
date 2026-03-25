import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Imagen de fondo con opacidad */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/planta-background.jpg"
          alt="Planta industrial"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        {/* Overlay oscuro con opacidad */}
        <div className="absolute inset-0 bg-slate-900/75"></div>
      </div>

      {/* Contenido adelante */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <div className="space-y-8">
          <div>
            <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
              RAM <span className="text-blue-400">Velvok</span>
            </h1>
            <p className="text-2xl text-slate-200 mb-2 drop-shadow-md">
              Sistema de Gestión de Corte y Stock
            </p>
            <p className="text-lg text-slate-300 italic drop-shadow-md">
              From Operation to Intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <Link 
              href="/admin"
              className="group relative overflow-hidden rounded-xl bg-white/95 backdrop-blur-md p-8 hover:bg-white transition-all duration-300 shadow-2xl hover:shadow-blue-500/20 hover:scale-105"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Administración</h2>
                <p className="text-slate-600 mb-4">Dashboard gerencial completo</p>
                <ul className="space-y-2 text-sm text-slate-700 text-left">
                  <li>• Gestión de pedidos y stock</li>
                  <li>• Órdenes de corte</li>
                  <li>• Reportes y KPIs</li>
                  <li>• Configuración del sistema</li>
                </ul>
              </div>
            </Link>

            <Link 
              href="/planta"
              className="group relative overflow-hidden rounded-xl bg-slate-800/95 backdrop-blur-md p-8 hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-slate-500/20 hover:scale-105"
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-2">Planta</h2>
                <p className="text-slate-300 mb-4">Interfaz operativa para tablets</p>
                <ul className="space-y-2 text-sm text-slate-400 text-left">
                  <li>• Login con PIN</li>
                  <li>• Órdenes de corte asignadas</li>
                  <li>• Registro de operaciones</li>
                  <li>• Modo offline-first</li>
                </ul>
              </div>
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div className="text-slate-300">
                <div className="text-white font-semibold mb-2">Base de Datos</div>
                <div>18 tablas creadas</div>
                <div>SLS configurado</div>
              </div>
              <div className="text-slate-300">
                <div className="text-white font-semibold mb-2">Integración</div>
                <div>Webhook ERP Evo</div>
                <div>Supabase conectado</div>
              </div>
              <div className="text-slate-300">
                <div className="text-white font-semibold mb-2">En Desarrollo</div>
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
