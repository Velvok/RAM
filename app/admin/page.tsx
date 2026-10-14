import { DashboardServer } from '@/components/dashboard-server'
import { PageHeader } from '@/components/page-header'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export default async function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Gerencial" subtitle="Vista general del sistema RAM - Velvok" />

      <DashboardServer />
    </div>
  )
}
