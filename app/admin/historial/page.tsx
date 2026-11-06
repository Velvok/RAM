import { getHistorial } from '@/app/actions/historial'
import { HistorialClient } from '@/components/historial-client'

export const dynamic = 'force-dynamic'

export default async function HistorialAnualPage() {
  const data = await getHistorial()
  return <HistorialClient initial={data} />
}
