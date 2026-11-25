'use client'

// Último recurso: falló incluso la estructura común de la app. No puede usar
// los estilos ni los componentes de la app, así que va con estilos propios.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#020817', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600 }}>La aplicación no ha podido arrancar</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: '#64748b' }}>
            Vuelve a intentarlo. Si sigue pasando, avisa a soporte.
          </p>
          <button onClick={reset} style={{ height: 44, padding: '0 20px', fontSize: 14, fontWeight: 500, color: '#ffffff', background: '#3437ed', border: 0, borderRadius: 8, cursor: 'pointer' }}>
            Volver a intentarlo
          </button>
        </div>
      </body>
    </html>
  )
}
