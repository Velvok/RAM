import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserId } from '@/lib/auth/guards'

// Solo para el panel de admin (sesión admin/manager) y solo rutas de la app:
// abierta permitía a cualquiera invalidar la caché de forma masiva.
const ALLOWED_PREFIXES = ['/admin/', '/planta/']

export async function POST(request: NextRequest) {
  if (!(await getAdminUserId())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path || !ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) {
      return NextResponse.json({ error: 'Path no válido' }, { status: 400 })
    }

    // Revalidar el path específico
    revalidatePath(path, 'page')

    // También revalidar el layout
    const layoutPath = path.split('/').slice(0, -1).join('/')
    if (layoutPath) {
      revalidatePath(layoutPath, 'layout')
    }

    return NextResponse.json({ revalidated: true, path })
  } catch (error) {
    return NextResponse.json({ error: 'Error revalidating' }, { status: 500 })
  }
}
