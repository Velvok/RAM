import { getOperationalDashboard } from '@/app/actions/dashboard-operativo'
import { DashboardOperativo } from '@/components/dashboard-operativo'

export async function DashboardServer() {
  const data = await getOperationalDashboard()
  return <DashboardOperativo initial={data} />
}
