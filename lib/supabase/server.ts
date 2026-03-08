import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
      global: {
        // Deshabilitar caché en todas las queries de Supabase
        fetch: (url: any, options: any = {}) => {
          return fetch(url, {
            ...options,
            cache: 'no-store',
            next: { revalidate: 0 }
          })
        }
      }
    }
  )
}
