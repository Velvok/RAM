import { NextRequest, NextResponse } from 'next/server'
import { chatWithAssistant } from '@/lib/ai-provider'

export async function POST(request: NextRequest) {
  try {
    const { messages, dashboardData } = await request.json()

    if (!messages || !Array.isArray(messages)) {
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
