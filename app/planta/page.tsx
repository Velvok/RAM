'use client'

import { useRouter } from 'next/navigation'

export default function PlantaPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Interfaz de Planta
          </h1>
          <p className="text-xl text-slate-300">
            Modo Tablet - Optimizado para operarios
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-8 border border-slate-700">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-green-500 font-semibold">Sistema Operativo</span>
              </div>
            </div>

            <div className="space-y-4 text-slate-300">
              <h3 className="text-lg font-semibold text-white">Funcionalidades Disponibles:</h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <div>
                    <div className="font-medium text-white">Login con PIN</div>
                    <div className="text-sm text-slate-400">Autenticación rápida (PIN: 1234)</div>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <div>
                    <div className="font-medium text-white">Órdenes de Corte</div>
                    <div className="text-sm text-slate-400">Ver órdenes asignadas en tiempo real</div>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <div>
                    <div className="font-medium text-white">Registro de Operaciones</div>
                    <div className="text-sm text-slate-400">Iniciar, pausar y finalizar cortes</div>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <div>
                    <div className="font-medium text-white">Modo Offline</div>
                    <div className="text-sm text-slate-400">PWA con caché automático</div>
                  </div>
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t border-slate-700">
              <button
                onClick={() => router.push('/planta/login')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors"
              >
                Ingresar con PIN →
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <a 
            href="/"
            className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    </div>
  )
}
