import { NextRequest, NextResponse } from 'next/server'
import { processPendingQueue } from '@/lib/ram-outbound'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Endpoint para procesar la cola de eventos pendientes hacia RAM.
 *
 * Llamarlo:
 * - Manualmente: GET /api/cron/process-outbound-queue
 * - Vía cron job de Vercel (vercel.json: crons)
 * - Vía Supabase pg_cron
 *
 * Si CRON_SECRET está configurado, requiere Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  // Verificar autenticación si hay CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await processPendingQueue(20)
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error procesando cola:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
