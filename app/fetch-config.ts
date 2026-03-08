// Configuración global para deshabilitar caché en todas las peticiones fetch
// Next.js 15 usa fetch internamente para server actions y queries

// Sobrescribir fetch global para forzar no-cache
if (typeof global !== 'undefined') {
  const originalFetch = global.fetch
  
  global.fetch = function(...args: Parameters<typeof fetch>) {
    const [url, init] = args
    
    // Forzar no-cache en todas las peticiones
    const modifiedInit: RequestInit = {
      ...init,
      cache: 'no-store',
      next: {
        revalidate: 0,
        ...(init?.next || {})
      }
    }
    
    return originalFetch(url, modifiedInit)
  }
}

export {}
