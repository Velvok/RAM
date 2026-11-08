'use client'

import { useEffect, useRef } from 'react'
import { reportPossibleStaleDeploy } from '@/lib/stale-deploy'

interface UseAutoRefreshOptions {
  enabled?: boolean
  interval?: number // en segundos, default 10
  /**
   * Recibe los datos nuevos cuando cambian. Si no se pasa, se recarga la
   * página entera (comportamiento antiguo).
   */
  onChange?: (data: any) => void
}

export function useAutoRefresh(
  orderId: string,
  fetchOrder: () => Promise<any>,
  options: UseAutoRefreshOptions = {}
) {
  const { enabled = true, interval = 10 } = options
  const lastDataRef = useRef<any>(null)
  // Las funciones van en refs: si fueran dependencias del efecto, como el
  // componente las recrea en cada render, el polling se reiniciaba (y lanzaba
  // una consulta completa del pedido) con cada pulsación o cambio de estado.
  const fetchRef = useRef(fetchOrder)
  const onChangeRef = useRef(options.onChange)
  fetchRef.current = fetchOrder
  onChangeRef.current = options.onChange

  useEffect(() => {
    if (!enabled || !orderId) return

    lastDataRef.current = null
    let cancelled = false

    const checkForChanges = async () => {
      // Sin consultas con la pestaña en segundo plano
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const currentData = await fetchRef.current()
        if (cancelled) return

        if (lastDataRef.current && hasOrderChanged(lastDataRef.current, currentData)) {
          if (onChangeRef.current) {
            onChangeRef.current(currentData)
          } else {
            console.log('🔄 Cambios detectados, refrescando página...')
            window.location.reload()
            return
          }
        }

        lastDataRef.current = currentData
      } catch (error) {
        console.error('Error checking for changes:', error)
        reportPossibleStaleDeploy(error)
      }
    }

    checkForChanges()
    const intervalId = setInterval(checkForChanges, interval * 1000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [orderId, enabled, interval])
}

function hasOrderChanged(oldData: any, newData: any): boolean {
  if (!oldData || !newData) return false

  // Comparar campos relevantes del pedido
  if (oldData.status !== newData.status) return true
  if (oldData.updated_at !== newData.updated_at) return true

  // Comparar cut_orders
  const oldCutOrders = oldData.cut_orders || []
  const newCutOrders = newData.cut_orders || []

  if (oldCutOrders.length !== newCutOrders.length) return true

  for (const oldCO of oldCutOrders) {
    const newCO = newCutOrders.find((co: any) => co.id === oldCO.id)
    if (!newCO) return true

    if (oldCO.status !== newCO.status) return true
    if (oldCO.quantity_cut !== newCO.quantity_cut) return true
    if (oldCO.material_base_id !== newCO.material_base_id) return true
    if (oldCO.updated_at !== newCO.updated_at) return true
  }

  // Comparar preparation_items
  const oldPrepItems = oldData.preparation_items || []
  const newPrepItems = newData.preparation_items || []

  if (oldPrepItems.length !== newPrepItems.length) return true

  for (const oldPI of oldPrepItems) {
    const newPI = newPrepItems.find((pi: any) => pi.id === oldPI.id)
    if (!newPI) return true

    if (oldPI.status !== newPI.status) return true
    if (oldPI.quantity_prepared !== newPI.quantity_prepared) return true
    if (oldPI.updated_at !== newPI.updated_at) return true
  }

  return false
}
