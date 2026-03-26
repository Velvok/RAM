import OpenAI from 'openai'

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Tipos para el contexto del dashboard
interface DashboardContext {
  pedidos: Array<{
    numero: string
    cliente: string
    estado: string
    fecha: string
    metraje: string
    producto: string
  }>
  stock: Array<{
    codigo: string
    total: number
    disponible: number
    reservado: number
    clientes: string[]
  }>
  kpis: {
    pendientes: number
    enProduccion: number
    pendientesEntrega: number
    total: number
  }
  metricas: {
    totalPedidos: number
    totalProductosStock: number
    stockCritico: number
    pedidosHoy: number
  }
}

/**
 * Convierte el estado actual del dashboard en un JSON completo
 * Incluye TODO el stock y todos los pedidos para análisis preciso
 */
export function getDashboardContext(data: any): string {
  // Calcular métricas adicionales
  const stockCritico = data.stockProductos?.filter((s: any) => 
    s.disponible < (s.total * 0.2) && s.disponible > 0
  ).length || 0

  const hoy = new Date().toISOString().split('T')[0]
  const pedidosHoy = data.recentOrders?.filter((p: any) => 
    p.fecha?.startsWith(hoy)
  ).length || 0

  const context: DashboardContext = {
    pedidos: data.recentOrders?.map((p: any) => ({
      numero: p.pedido,
      cliente: p.cliente,
      estado: p.estado,
      fecha: p.fecha,
      metraje: p.metraje,
      producto: p.producto
    })) || [],
    stock: data.stockProductos?.map((s: any) => ({
      codigo: s.codigo,
      total: s.total,
      disponible: s.disponible,
      reservado: s.reservado,
      clientes: s.clientes || []
    })) || [],
    kpis: {
      pendientes: data.kpis?.pendingOrders || 0,
      enProduccion: data.kpis?.inProductionOrders || 0,
      pendientesEntrega: data.kpis?.pendingDeliveryOrders || 0,
      total: data.kpis?.totalOrders || 0
    },
    metricas: {
      totalPedidos: data.recentOrders?.length || 0,
      totalProductosStock: data.stockProductos?.length || 0,
      stockCritico: stockCritico,
      pedidosHoy: pedidosHoy
    }
  }

  return JSON.stringify(context, null, 0)
}

/**
 * Búsqueda semántica usando GPT-4o-mini
 * Procesa lenguaje natural y devuelve resultados relevantes
 */
export async function handleSemanticSearch(
  query: string,
  dashboardData: any
): Promise<{
  pedidos: string[]
  productos: string[]
  insights: string
}> {
  try {
    const context = getDashboardContext(dashboardData)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de búsqueda para Comercial RAM. 
Analiza la consulta del usuario y devuelve resultados relevantes basándote SOLO en los datos proporcionados.

DATOS DISPONIBLES:
${context}

INSTRUCCIONES:
- Si el usuario busca algo "urgente", filtra pedidos en estado "en_corte" o "aprobado"
- Si menciona un cliente, busca por nombre exacto o similar
- Si menciona un producto, busca por código
- Si pregunta por stock, analiza disponibilidad
- Devuelve SOLO un JSON con este formato:
{
  "pedidos": ["PED-123", "PED-456"],
  "productos": ["AC25110.2,0", "CINC.25"],
  "insights": "Breve explicación de los resultados"
}

NO inventes datos. Si no encuentras nada, devuelve arrays vacíos.`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    
    return {
      pedidos: result.pedidos || [],
      productos: result.productos || [],
      insights: result.insights || 'No se encontraron resultados relevantes.'
    }
  } catch (error) {
    console.error('Error en búsqueda semántica:', error)
    return {
      pedidos: [],
      productos: [],
      insights: 'Error al procesar la búsqueda.'
    }
  }
}

/**
 * Chat con el asistente de IA
 * Analiza métricas y responde preguntas sobre el dashboard
 */
export async function chatWithAssistant(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  dashboardData: any
): Promise<string> {
  try {
    const context = getDashboardContext(dashboardData)
    
    // Debug: mostrar contexto generado
    console.log('🔍 Contexto generado (primeros 500 chars):', context.substring(0, 500))
    console.log('📏 Tamaño total del contexto:', context.length, 'caracteres')
    
    const systemPrompt = `Eres un analista de datos de Comercial RAM (empresa de corte de chapas metálicas).

DATOS COMPLETOS DEL SISTEMA:
${context}

INSTRUCCIONES CRÍTICAS:
1. NO saludes, NO uses cortesías - responde DIRECTO
2. USA SOLO los datos JSON de arriba - NO inventes
3. Para buscar stock: busca en el array "stock" por campo "codigo"
4. Para buscar pedidos: busca en el array "pedidos" por campos "numero", "cliente", "estado"
5. Los KPIs están en el objeto "kpis"
6. Las métricas calculadas están en "metricas"
7. Si preguntan por "PUA" o "PUAS", busca códigos que contengan "PUA"
8. Si no encuentras datos, di: "No tengo esos datos"
9. Respuestas de máximo 2-3 oraciones
10. Usa números EXACTOS de los datos

EJEMPLOS:
Pregunta: "cuanto stock de pua hay?"
Respuesta CORRECTA: "El producto PUAS tiene 45 disponibles de 100 totales."
Respuesta INCORRECTA: "Hay 1 pedido finalizado" (esto no responde la pregunta)

Pregunta: "cuantos pedidos pendientes?"
Respuesta CORRECTA: "Hay 3 pedidos pendientes según los KPIs."

Pregunta: "dime ventas de hoy"
Respuesta CORRECTA: "Hoy se registraron 2 pedidos según las métricas."

NO HAGAS:
- Saludar: "¡Hola!" ❌
- Inventar: "Aproximadamente..." ❌  
- Responder otra cosa: Si preguntan stock, NO hables de pedidos ❌

Responde en español de Argentina.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.1,
      max_tokens: 400
    })

    return completion.choices[0].message.content || 'No pude generar una respuesta.'
  } catch (error) {
    console.error('Error en chat con asistente:', error)
    return 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
  }
}
