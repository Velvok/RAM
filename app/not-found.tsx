import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página no existe</h1>
        <p className="text-sm text-muted-foreground">Puede que el enlace esté mal escrito o que lo que buscabas ya no esté.</p>
        <div className="flex justify-center pt-2">
          <Link href="/" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ir al inicio</Link>
        </div>
      </div>
    </main>
  )
}
