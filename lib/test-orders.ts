/**
 * "Generar pedido de prueba": oculto por defecto ahora que RAM trabaja con
 * pedidos reales. Para volver a usarlo, poner TEST_ORDERS_ENABLED=true en las
 * variables de entorno (Vercel o .env.local) y redesplegar.
 */
export function testOrdersEnabled() {
  return process.env.TEST_ORDERS_ENABLED === 'true'
}
