import { NextRequest, NextResponse } from 'next/server'
import { handleSemanticSearch } from '@/lib/ai-provider'
import { getAdminUserId } from '@/lib/auth/guards'

const MAX_BODY_CHARS = 200_000

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
    const { query, dashboardData } = JSON.parse(raw)

    if (!query || typeof query !== 'string' || query.length > 1000) {
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
