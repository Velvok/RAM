'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlantaPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/planta/login')
  }, [router])

  return null
}
