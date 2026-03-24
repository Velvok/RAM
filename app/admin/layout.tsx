import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin-sidebar'

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
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar displayEmail={displayEmail} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
