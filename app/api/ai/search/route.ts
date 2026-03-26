import { NextRequest, NextResponse } from 'next/server'
import { handleSemanticSearch } from '@/lib/ai-provider'

export async function POST(request: NextRequest) {
  try {
    const { query, dashboardData } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query inválida' },
        { status: 400 }
      )
    }

    const results = await handleSemanticSearch(query, dashboardData)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error en API de búsqueda semántica:', error)
    return NextResponse.json(
      { error: 'Error al procesar la búsqueda' },
      { status: 500 }
    )
  }
}
