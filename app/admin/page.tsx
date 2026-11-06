import { DashboardServer } from '@/components/dashboard-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export default async function AdminDashboard() {
  return <DashboardServer />
}
