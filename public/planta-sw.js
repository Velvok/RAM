/* Service worker de planta: deja abrir la app sin conexión.
 * - /_next/static: primero caché (los nombres cambian en cada despliegue).
 * - Páginas de /planta y sus datos de navegación: primero red; sin red, la
 *   última copia guardada (y si no hay, la lista de pedidos).
 * - Todo lo demás (acciones, /api) pasa directo: la cola de acciones vive en
 *   IndexedDB, no aquí.
 * La versión llega en ?v= al registrarlo: cada despliegue estrena caché. */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `ram-planta-${VERSION}`
const NET_TIMEOUT_MS = 5000

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/planta/pedidos']).catch(() => {})).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ram-planta-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// La página avisa de lo que ya tiene cargado (HTML y ficheros de la app) para
// que quede guardado: lo que se cargó antes de que el service worker tomara el
// control no pasa por aquí y, sin esto, la app no abriría sin red tras recargar.
self.addEventListener('message', event => {
  const data = event.data || {}
  if (data.type !== 'warm' || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then(cache => Promise.all(data.urls.slice(0, 300).map(async u => {
      try {
        const url = new URL(u, self.location.origin)
        if (url.origin !== self.location.origin) return
        const isStatic = url.pathname.startsWith('/_next/static/')
        if (!isStatic && !url.pathname.startsWith('/planta')) return
        if (isStatic && (await cache.match(url.toString()))) return
        const res = await fetch(url.toString(), { credentials: 'same-origin' })
        if (res.ok && !res.redirected) await cache.put(isStatic ? url.toString() : cacheKey(new Request(url.toString())), res)
      } catch (e) {}
    }))),
  )
})

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(r => { clearTimeout(t); resolve(r) }, e => { clearTimeout(t); reject(e) })
  })
}

// Clave de caché sin el parámetro _rsc (cambia en cada petición)
function cacheKey(request) {
  const url = new URL(request.url)
  url.searchParams.delete('_rsc')
  const rsc = request.headers.get('RSC') === '1' ? '#rsc' : ''
  return url.toString() + rsc
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  const isPlanta = url.pathname.startsWith('/planta')
  const isNav = req.mode === 'navigate' || req.headers.get('RSC') === '1'
  if (isPlanta && isNav) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const key = cacheKey(req)
        try {
          const res = await withTimeout(fetch(req), NET_TIMEOUT_MS)
          // Redirecciones (login) y errores no se guardan
          if (res.ok && !res.redirected) cache.put(key, res.clone())
          return res
        } catch (e) {
          const hit = await cache.match(key)
          if (hit) return hit
          if (req.mode === 'navigate') {
            const list = await cache.match('/planta/pedidos')
            if (list) return list
          }
          throw e
        }
      }),
    )
  }
})
