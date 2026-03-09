import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // TEMPORALMENTE DESHABILITADO - Permitir acceso sin auth
  // TODO: Habilitar cuando se configure Supabase Auth
  /*
  if (!user) {
    redirect('/login')
  }
  */

  const displayEmail = user?.email || 'admin@velvok.com (modo demo)'

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-slate-900">
                RAM <span className="text-blue-600">Velvok</span>
              </h1>
              <nav className="flex space-x-4">
                <a href="/admin" className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </a>
                <a href="/admin/pedidos" className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium">
                  Pedidos
                </a>
                <a href="/admin/stock" className="text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium">
                  Stock
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">{displayEmail}</span>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
