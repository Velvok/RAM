import { NextRequest, NextResponse } from 'next/server'
import { chatWithAssistant } from '@/lib/ai-provider'
import { getAdminUserId } from '@/lib/auth/guards'

const MAX_BODY_CHARS = 200_000
const MAX_MESSAGES = 40

export async function POST(request: NextRequest) {
  if (!(await getAdminUserId())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Tope de tamaño: cada petición se manda entera al modelo (coste por token)
  const raw = await request.text()
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: 'Petición demasiado grande' }, { status: 413 })
  }

  try {
    const { messages, dashboardData } = JSON.parse(raw)

    if (!messages || !Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: 'Mensajes inválidos' },
        { status: 400 }
      )
    }

    // Debug: verificar qué datos está recibiendo
    console.log('📊 Dashboard Data recibido:', {
      pedidos: dashboardData?.recentOrders?.length || 0,
      stock: dashboardData?.stockProductos?.length || 0,
      kpis: dashboardData?.kpis
    })

    const response = await chatWithAssistant(messages, dashboardData)

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Error en API de chat:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
