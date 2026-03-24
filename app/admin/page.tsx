import { DashboardRAM } from '@/components/dashboard-ram'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export default async function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard Gerencial</h2>
        <p className="text-slate-600 mt-1">Vista general del sistema RAM - Velvok</p>
      </div>

      <DashboardRAM />
    </div>
  )
}
