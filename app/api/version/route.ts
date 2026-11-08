import { NextResponse } from 'next/server'

// Versión del despliegue que está sirviendo ahora. Pública a propósito: solo
// devuelve un identificador de compilación, sin datos.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID || null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
