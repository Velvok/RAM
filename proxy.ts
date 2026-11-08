import { NextResponse, type NextRequest } from 'next/server'
import { PLANTA_COOKIE, verifyPlantaToken } from '@/lib/auth/planta-session'

const PLANTA_PUBLIC = ['/planta', '/planta/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Páginas de planta: exigen la sesión firmada que crea el login por PIN
  // (solo /planta y /planta/…: /planta-sw.js es el service worker, público)
  const isPlanta = pathname === '/planta' || pathname.startsWith('/planta/')
  if (isPlanta && !PLANTA_PUBLIC.includes(pathname)) {
    if (!verifyPlantaToken(request.cookies.get(PLANTA_COOKIE)?.value)) {
      return NextResponse.redirect(new URL('/planta/login', request.url))
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  
  // Forzar no-cache en todas las rutas de admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
