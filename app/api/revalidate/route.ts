import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
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
