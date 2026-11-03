import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminUserIdFor } from '@/lib/auth/guards'
import { AdminShell } from '@/components/admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Tener cuenta no basta: solo usuarios admin/manager activos de la tabla users
  if (!(await adminUserIdFor(user))) {
    redirect('/login')
  }

  return <AdminShell displayEmail={user.email ?? 'Sesión sin email'}>{children}</AdminShell>
}
