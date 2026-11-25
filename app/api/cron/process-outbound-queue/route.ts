import { NextRequest, NextResponse } from 'next/server'
import { processPendingQueue } from '@/lib/ram-outbound'
import { safeEqual } from '@/lib/auth/planta-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Endpoint para procesar la cola de eventos pendientes hacia RAM.
 *
 * Llamarlo:
 * - Manualmente: GET /api/cron/process-outbound-queue
 * - Vía cron job de Vercel (vercel.json: crons)
 * - Vía Supabase pg_cron
 *
 * Requiere Authorization: Bearer {CRON_SECRET}. Sin CRON_SECRET configurado
 * responde 503: nunca queda abierto.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Cada envío puede esperar a EVO hasta 90 s (RAM_TIMEOUT_MS) más 5 s de
    // pausa: con maxDuration=300 caben 3 sin que Vercel corte la función.
    const result = await processPendingQueue(3)
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error procesando cola:', error)
    return NextResponse.json(
      { success: false, error: 'Error procesando la cola' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
