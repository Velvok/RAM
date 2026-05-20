/**
 * Operation: Complete Cut (Operator from Tablet)
 */

import { SimulationContext } from '../../core/orchestrator'

export async function completeCut(
  context: SimulationContext,
  cutOrderId: string,
  quantityCut: number,
  materialUsed: { id: string; quantity: number }
): Promise<boolean> {
  const { logger, supabase } = context
  
  const startTime = Date.now()
  
  try {
    // Get current state
    const { data: beforeCut } = await supabase
      .from('cut_orders')
      .select('*, order:orders(*)')
      .eq('id', cutOrderId)
      .single()
    
    // Complete the cut using the processCutOrder action
    const { processCutOrder } = await import('@/app/actions/cut-operations')
    
    await processCutOrder({
      cutOrderId,
      selectedMaterialId: materialUsed.id,
      materialLength: materialUsed.quantity,
      quantityToCut: quantityCut,
      operatorId: 'op-test-001' // Test operator ID
    })
    
    // Get after state
    const { data: afterCut } = await supabase
      .from('cut_orders')
      .select('*, order:orders(*), preparation_items(*)')
      .eq('id', cutOrderId)
      .single()
    
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'COMPLETE_CUT',
      actor: 'operator',
      entityType: 'cut_order',
      entityId: cutOrderId,
      beforeState: beforeCut,
      afterState: afterCut,
      payload: { cutOrderId, quantityCut, materialUsed },
      result: 'success',
      durationMs: duration,
      relatedEntities: {
        cutOrders: [cutOrderId],
        preparationItems: afterCut?.preparation_items?.map((pi: any) => pi.id) || []
      }
    })
    
    return true
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'COMPLETE_CUT',
      actor: 'operator',
      entityType: 'cut_order',
      entityId: cutOrderId,
      beforeState: null,
      afterState: null,
      payload: { cutOrderId, quantityCut, materialUsed },
      result: 'error',
      errorDetails: error.message,
      durationMs: duration
    })
    
    return false
  }
}
