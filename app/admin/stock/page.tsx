import { getStockOverview } from '@/app/actions/inventory'
import { StockClient } from '@/components/stock/stock-client'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const data = await getStockOverview()
  return <StockClient {...data} />
}
