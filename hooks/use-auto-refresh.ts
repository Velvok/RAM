'use client'

import { useEffect, useRef } from 'react'

interface UseAutoRefreshOptions {
  enabled?: boolean
  interval?: number // en segundos, default 10
  onDataChange?: (hasChanges: boolean) => void
}

export function useAutoRefresh(
  orderId: string,
  fetchOrder: () => Promise<any>,
  options: UseAutoRefreshOptions = {}
) {
  const { enabled = true, interval = 10, onDataChange } = options
  const lastDataRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled || !orderId) return

    const checkForChanges = async () => {
      try {
        const currentData = await fetchOrder()
        
        if (lastDataRef.current) {
          // Comparar datos relevantes para detectar cambios
          const hasChanges = hasOrderChanged(lastDataRef.current, currentData)
          
          if (hasChanges) {
            console.log('🔄 Cambios detectados, refrescando página...')
            window.location.reload()
          }
          
          onDataChange?.(hasChanges)
        }
        
        lastDataRef.current = currentData
      } catch (error) {
        console.error('Error checking for changes:', error)
      }
    }

    // Verificar inmediatamente al montar
    checkForChanges()

    // Configurar polling
    intervalRef.current = setInterval(checkForChanges, interval * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [orderId, enabled, interval, fetchOrder, onDataChange])
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
