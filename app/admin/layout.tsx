import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  return <AdminShell displayEmail={user.email ?? 'Sesión sin email'}>{children}</AdminShell>
}
