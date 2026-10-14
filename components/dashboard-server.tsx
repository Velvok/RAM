import { getDashboardData } from '@/app/actions/dashboard-data'
import { DashboardRAMClient } from '@/components/dashboard-ram-client'

export async function DashboardServer() {
  const dashboardData = await getDashboardData()
  return <DashboardRAMClient data={dashboardData} />
}
