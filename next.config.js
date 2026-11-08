/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Configurar el root correcto para evitar conflictos con lockfiles en directorios padre
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Configuración optimizada de caché
    staleTimes: {
      dynamic: 30, // 30 segundos para rutas dinámicas
      static: 180, // 3 minutos para contenido estático
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Headers optimizados para caché estratégico
  async headers() {
    return [
      {
        // API routes - sin caché
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      // Assets estáticos - caché largo, solo en producción: en desarrollo
      // Turbopack reutiliza los nombres de los ficheros y el navegador se
      // quedaba con el JavaScript antiguo aunque el código hubiera cambiado.
      ...(process.env.NODE_ENV === 'production'
        ? [{
            source: '/_next/static/:path*',
            headers: [
              {
                key: 'Cache-Control',
                value: 'public, max-age=31536000, immutable',
              },
            ],
          }]
        : []),
      {
        // Imágenes - caché medio
        source: '/:path*.{jpg,jpeg,png,gif,svg,ico,webp}',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // (Se quitó una regla '/:path*' con 'public, s-maxage=60': al ser la
      // última pisaba el no-store de /api y marcaba como cacheables en CDN las
      // páginas de admin y planta, que son privadas y dinámicas.)
    ]
  },
}

module.exports = nextConfig
