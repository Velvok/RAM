'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { markAsScrap } from '@/app/actions/remnants'
import { toast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'

export function MarkAsScrapButton({ remnantId }: { remnantId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleMarkAsScrap() {
    setLoading(true)

    try {
      await markAsScrap(remnantId, 'Marcado como scrap desde detalle')

      toast({
        title: 'Recorte marcado como scrap',
        description: 'El recorte ha sido marcado como desperdicio',
      })

      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar el recorte como scrap',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-slate-600">¿Estás seguro?</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleMarkAsScrap}
          disabled={loading}
        >
          {loading ? 'Marcando...' : 'Sí, marcar'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowConfirm(false)}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => setShowConfirm(true)}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Marcar como Scrap
    </Button>
  )
}
