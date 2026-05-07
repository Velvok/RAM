# Estado Actual de la Integración EVO-Velvok

## 📊 Resumen General

**Estado**: 🟡 Parcialmente implementada  
**Última actualización**: 7 de mayo de 2026  
**Fases completadas**: 1 de 4  
**Nivel de preparación**: 60%

---

## 🔄 Estado por Fase

### ✅ Fase 1: Sincronización de Stock
**Estado**: Completada ✅  
**Implementación**: Base de datos preparada con campos `evo_product_id`  
**Endpoints**: `POST /webhooks/stock/actualizado` (pendiente implementar)  
**Observaciones**: Estructura lista, falta implementar el endpoint de recepción

### 🟡 Fase 2: Recepción de Pedidos (Evo → Velvok)
**Estado**: Parcialmente implementada 🟡  
**Endpoint existente**: `POST /api/webhooks/evo`  
**Estado actual**: Funcional pero necesita actualizaciones

#### ✅ Lo que funciona:
- Recepción de pedidos desde EVO
- Creación automática de clientes
- Creación automática de productos
- Generación de órdenes de corte
- Reserva automática de stock

#### ❌ Lo que falta:
- Implementar estructura `ref_evo` con campos:
  - `codtipmov`
  - `nromov` 
  - `a_b_c`
  - `codter`
- Definir estado inicial del pedido (nuevo vs pendiente)
- Manejo de idempotencia mediante `id_evento`
- Validación de versión para evitar duplicados

### ❌ Fase 3: Ejecución en Planta (Velvok → Evo)
**Estado**: No implementada ❌  
**Endpoint requerido**: `POST /api/v1/stock/movimientos`  
**Funcionalidades faltantes**:
- Envío de eventos de corte a EVO
- Manejo de movimientos (BAJA/ALTA)
- Trazabilidad con `ref_evo`
- Sistema de reversiones

### ❌ Fase 4: Entrega
**Estado**: No implementada ❌  
**Endpoints requeridos**:
- `Velvok → Evo`: Notificación de estado "preparado"
- `Evo → Velvok`: `POST /webhooks/pedidos/entregado`  
**Funcionalidades faltantes**:
- Validación previa en EVO
- Generación de remitos
- Actualización de estado a "entregado"

---

## 🗄️ Estructura de Base de Datos

### ✅ Tablas con campos EVO:
- `clients.evo_client_id` ✅
- `products.evo_product_id` ✅  
- `orders.evo_order_id` ✅
- `orders.evo_data` (JSONB) ✅
- `dispatches.evo_dispatch_id` ✅

### ❌ Campos faltantes para `ref_evo`:
```sql
-- Necesario agregar a orders:
ALTER TABLE orders ADD COLUMN ref_evo JSONB;

-- Estructura esperada:
{
  "codtipmov": "PEDIDO",
  "nromov": "100000001", 
  "a_b_c": "I",
  "codter": "00001"
}
```

---

## 🔌 Endpoints Actuales

### ✅ Implementado:
- `POST /api/webhooks/evo` - Recepción básica de pedidos

### ❌ Pendientes de implementar:
- `POST /webhooks/stock/actualizado` - Sincronización de stock
- `POST /webhooks/pedidos/entregado` - Notificación de entrega
- `POST /api/v1/stock/movimientos` - Envío de movimientos a EVO

---

## 🚨 Issues Críticos a Resolver

### 1. 🔐 Seguridad
- **Falta**: Implementación de firma HMAC en webhooks
- **Actual**: Solo validación por `x-evo-webhook-secret`
- **Riesgo**: Medium

### 2. 🔄 Idempotencia
- **Falta**: Control por `id_evento`
- **Problema**: Eventos duplicados pueden procesarse
- **Impacto**: Datos inconsistentes

### 3. 📦 Versionamiento
- **Falta**: Control de versión en eventos
- **Problema**: No se puede garantizar orden cronológico
- **Impacto**: Stock desincronizado

### 4. 🏗️ Arquitectura
- **Problema**: Webhook actual usa `createClient()` (con RLS)
- **Solución**: Migrar a `createAdminClient()`
- **Estado**: Detectado, no corregido

---

## 📋 Requerimientos de EVO para Empezar

### 🔴 Críticos (Bloqueantes):

1. **Definición de `ref_evo`**:
   ```json
   {
     "codtipmov": "PEDIDO",
     "nromov": "100000001", 
     "a_b_c": "I",
     "codter": "00001"
   }
   ```

2. **Endpoint de stock**:
   - URL completa: `https://tu-dominio.com/webhooks/stock/actualizado`
   - Método: POST
   - Autenticación: Bearer Token + HMAC

3. **Especificación de idempotencia**:
   - Formato del `id_evento`
   - Política de reintentos
   - Timeout máximo

4. **Definición de estados iniciales**:
   - ¿Los pedidos llegan como "nuevo" o "pendiente"?
   - ¿Qué pedidos requieren corte vs preparación?

### 🟡 Importantes (No bloqueantes):

1. **Formato de movimientos de stock**:
   - Estructura exacta para `POST /api/v1/stock/movimientos`
   - Códigos de operario válidos
   - Tipos de artículos

2. **Política de reintentos**:
   - Backoff exponencial
   - Número máximo de reintentos
   - Dead Letter Queue

3. **Seguridad**:
   - Algoritmo HMAC (SHA256?)
   - Secreto compartido
   - Rotación de claves

---

## 🚀 Plan de Acción Inmediato

### Semana 1: Preparación
- [ ] Agregar campo `ref_evo` a tabla `orders`
- [ ] Migrar webhook EVO a `createAdminClient()`
- [ ] Implementar control de idempotencia
- [ ] Agregar logging detallado

### Semana 2: Fase 2 Completa
- [ ] Actualizar webhook para recibir `ref_evo`
- [ ] Implementar control de versión
- [ ] Agregar firma HMAC
- [ ] Testing con EVO

### Semana 3: Fase 3
- [ ] Implementar `POST /api/v1/stock/movimientos`
- [ ] Sistema de reversiones
- [ ] Testing bidireccional

### Semana 4: Fase 4
- [ ] Implementar notificación de "preparado"
- [ ] Webhook de entrega
- [ ] Testing completo del flujo

---

## 📈 Métricas de Éxito

### Técnicas:
- **Latencia**: < 3 segundos por evento
- **Disponibilidad**: > 99.5%
- **Tasa de error**: < 0.1%

### Funcionales:
- **Sincronización de stock**: Tiempo real
- **Trazabilidad**: 100% de eventos
- **Consistencia**: Cero duplicados

---

## 🎯 Conclusión

La integración tiene una **base sólida** pero requiere **trabajo significativo** para estar completa. La arquitectura está bien diseñada y la base de datos está preparada. Los principales bloqueantes son:

1. **Definiciones de EVO** (campos `ref_evo`, estados, formatos)
2. **Implementación técnica** (seguridad, idempotencia, endpoints faltantes)
3. **Testing y validación** (flujo completo)

**Estimación de tiempo**: 3-4 semanas para implementación completa una vez que EVO proporcione las definiciones faltantes.
