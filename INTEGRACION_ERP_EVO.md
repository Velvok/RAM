# 🔗 INTEGRACIÓN CON ERP EVO - GUÍA COMPLETA

**Fecha:** 7 de Marzo, 2026  
**Sistema:** RAM (Velvok) ↔️ ERP EVO

---

## 📋 RESUMEN EJECUTIVO

RAM depende del ERP EVO para recibir:
1. **Pedidos de clientes** - Cuando un cliente hace un pedido en EVO
2. **Datos de productos** - Catálogo de productos y precios
3. **Datos de clientes** - Información de clientes

EVO necesita recibir de RAM:
1. **Estado de pedidos** - Cuando un pedido cambia de estado
2. **Confirmación de despachos** - Cuando se despacha un pedido
3. **Datos de pesadas** - Peso real vs teórico

---

## 🎯 LO QUE NECESITAS DE EVO

### 1. WEBHOOK PARA ENVIAR PEDIDOS A RAM

EVO debe configurar un webhook que envíe datos a RAM cuando:
- Se crea un nuevo pedido
- Se modifica un pedido existente
- Se cancela un pedido

**Endpoint de RAM:**
```
POST https://tu-dominio.com/api/webhooks/evo
```

**Headers requeridos:**
```json
{
  "Content-Type": "application/json",
  "x-evo-webhook-secret": "TU_SECRET_COMPARTIDO"
}
```

**Payload del webhook (Crear Pedido):**
```json
{
  "event_type": "order_created",
  "order_id": "EVO-12345",
  "order_number": "PED-2024-001",
  "client_id": "CLI-001",
  "client_data": {
    "business_name": "Metalúrgica San Martín S.A.",
    "tax_id": "30-12345678-9",
    "contact_name": "Juan Pérez",
    "contact_phone": "+54 11 1234-5678",
    "contact_email": "juan@metalurgica.com",
    "address": "Av. Industrial 1234, Buenos Aires"
  },
  "order_lines": [
    {
      "product_id": "PROD-001",
      "product_code": "CH-10MM-1000",
      "product_name": "Chapa 10mm 1000x2000",
      "quantity": 500.00,
      "unit_price": 1500.00,
      "subtotal": 750000.00
    }
  ],
  "total_weight": 500.00,
  "total_amount": 750000.00,
  "notes": "Entrega urgente",
  "delivery_date": "2024-03-15"
}
```

**Payload del webhook (Actualizar Pedido):**
```json
{
  "event_type": "order_updated",
  "order_id": "EVO-12345",
  "order_number": "PED-2024-001",
  "status": "aprobado",
  "notes": "Cliente confirmó pago"
}
```

**Payload del webhook (Cancelar Pedido):**
```json
{
  "event_type": "order_cancelled",
  "order_id": "EVO-12345",
  "order_number": "PED-2024-001",
  "cancellation_reason": "Cliente solicitó cancelación"
}
```

---

### 2. API REST PARA CONSULTAR DATOS

RAM necesita poder consultar datos de EVO cuando sea necesario.

#### 2.1 Obtener Productos

**Endpoint:**
```
GET https://evo-api.tuempresa.com/api/v1/products
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "PROD-001",
      "code": "CH-10MM-1000",
      "name": "Chapa 10mm 1000x2000",
      "description": "Chapa de acero laminado en caliente",
      "category": "chapas",
      "unit": "kg",
      "thickness_mm": 10.0,
      "width_mm": 1000.0,
      "length_mm": 2000.0,
      "weight_per_unit": 157.0,
      "unit_price": 1500.00,
      "is_active": true
    }
  ]
}
```

#### 2.2 Obtener Clientes

**Endpoint:**
```
GET https://evo-api.tuempresa.com/api/v1/clients
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "CLI-001",
      "business_name": "Metalúrgica San Martín S.A.",
      "tax_id": "30-12345678-9",
      "contact_name": "Juan Pérez",
      "contact_phone": "+54 11 1234-5678",
      "contact_email": "juan@metalurgica.com",
      "address": "Av. Industrial 1234, Buenos Aires",
      "is_active": true
    }
  ]
}
```

#### 2.3 Obtener Detalle de Pedido

**Endpoint:**
```
GET https://evo-api.tuempresa.com/api/v1/orders/{order_id}
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "id": "EVO-12345",
    "order_number": "PED-2024-001",
    "client_id": "CLI-001",
    "status": "pendiente",
    "total_weight": 500.00,
    "total_amount": 750000.00,
    "created_at": "2024-03-01T10:00:00Z",
    "delivery_date": "2024-03-15",
    "lines": [
      {
        "product_id": "PROD-001",
        "product_code": "CH-10MM-1000",
        "quantity": 500.00,
        "unit_price": 1500.00,
        "subtotal": 750000.00
      }
    ]
  }
}
```

---

## 📤 LO QUE RAM ENVIARÁ A EVO

### 1. ACTUALIZACIÓN DE ESTADO DE PEDIDOS

Cuando un pedido cambia de estado en RAM, se notifica a EVO.

**Endpoint de EVO:**
```
POST https://evo-api.tuempresa.com/api/v1/orders/{order_id}/status
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Payload:**
```json
{
  "order_id": "EVO-12345",
  "status": "en_corte",
  "updated_at": "2024-03-05T14:30:00Z",
  "notes": "Orden de corte CUT-2024-001 iniciada"
}
```

**Estados posibles:**
- `ingresado` - Pedido recibido en RAM
- `generado` - Órdenes de corte generadas
- `pendiente_aprobacion` - Esperando aprobación de pago
- `lanzado` - Aprobado y listo para cortar
- `en_corte` - En proceso de corte
- `preparado_pendiente_retiro` - Listo para despachar
- `despachado` - Despachado al cliente
- `entregado` - Entregado al cliente
- `bloqueado` - Bloqueado por algún motivo
- `cancelado` - Cancelado

---

### 2. CONFIRMACIÓN DE DESPACHOS

Cuando se despacha un pedido, RAM notifica a EVO.

**Endpoint de EVO:**
```
POST https://evo-api.tuempresa.com/api/v1/dispatches
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Payload:**
```json
{
  "order_id": "EVO-12345",
  "dispatch_number": "DESP-2024-001",
  "dispatch_date": "2024-03-10",
  "carrier": "Transporte XYZ",
  "tracking_number": "TRK-123456",
  "items": [
    {
      "product_id": "PROD-001",
      "quantity": 500.00,
      "actual_weight": 498.50
    }
  ],
  "total_weight": 498.50,
  "notes": "Despacho completo"
}
```

---

### 3. DATOS DE PESADAS

Cuando se pesa un pedido, RAM envía los datos a EVO.

**Endpoint de EVO:**
```
POST https://evo-api.tuempresa.com/api/v1/weighings
```

**Headers:**
```json
{
  "Authorization": "Bearer TU_API_KEY",
  "Content-Type": "application/json"
}
```

**Payload:**
```json
{
  "order_id": "EVO-12345",
  "theoretical_weight": 500.00,
  "actual_weight": 498.50,
  "difference": -1.50,
  "ticket_number": "BAL-001-2024",
  "weighed_at": "2024-03-10T16:45:00Z",
  "notes": "Diferencia dentro del margen aceptable"
}
```

---

## 🔐 SEGURIDAD

### 1. Autenticación del Webhook

EVO debe incluir un header de autenticación:
```
x-evo-webhook-secret: TU_SECRET_COMPARTIDO
```

RAM validará este secret antes de procesar el webhook.

### 2. API Keys

Para las llamadas de RAM a EVO, necesitas proporcionar:
- **API Key** - Token de autenticación
- **Base URL** - URL base de la API de EVO

Estas se configuran en el archivo `.env.local` de RAM:
```env
EVO_API_URL=https://evo-api.tuempresa.com/api/v1
EVO_API_KEY=tu_api_key_aqui
EVO_WEBHOOK_SECRET=tu_secret_compartido_aqui
```

### 3. HTTPS

Todas las comunicaciones deben ser por HTTPS.

---

## 📊 FLUJO COMPLETO DE INTEGRACIÓN

### Flujo 1: Nuevo Pedido

```
1. Cliente crea pedido en EVO
   ↓
2. EVO envía webhook a RAM
   POST /api/webhooks/evo
   ↓
3. RAM procesa el pedido:
   - Crea/actualiza cliente
   - Crea/actualiza productos
   - Crea pedido
   - Crea líneas de pedido
   - Reserva stock
   ↓
4. RAM responde a EVO:
   200 OK { "success": true, "order_id": "..." }
   ↓
5. RAM genera órdenes de corte automáticamente
   ↓
6. RAM notifica a EVO del cambio de estado
   POST /api/v1/orders/{id}/status
```

### Flujo 2: Despacho de Pedido

```
1. Operario completa corte en RAM
   ↓
2. Admin marca pedido como "preparado"
   ↓
3. Admin crea despacho
   ↓
4. Se pesa el pedido
   ↓
5. RAM envía pesada a EVO
   POST /api/v1/weighings
   ↓
6. RAM envía despacho a EVO
   POST /api/v1/dispatches
   ↓
7. RAM actualiza estado a "despachado"
   POST /api/v1/orders/{id}/status
```

---

## 🛠️ IMPLEMENTACIÓN EN RAM

### Webhook ya implementado

El webhook de RAM ya está implementado en:
```
/app/api/webhooks/evo/route.ts
```

### Funciones a implementar

Necesitas crear estas funciones en RAM para enviar datos a EVO:

1. **`sendOrderStatusToEvo(orderId, status)`**
   - Envía actualización de estado a EVO

2. **`sendDispatchToEvo(dispatchData)`**
   - Envía confirmación de despacho a EVO

3. **`sendWeighingToEvo(weighingData)`**
   - Envía datos de pesada a EVO

4. **`syncProductsFromEvo()`**
   - Sincroniza catálogo de productos desde EVO

5. **`syncClientsFromEvo()`**
   - Sincroniza clientes desde EVO

---

## 📝 CHECKLIST PARA EVO

### Configuración Requerida

- [ ] Configurar webhook para enviar pedidos a RAM
- [ ] Proporcionar URL base de API REST
- [ ] Proporcionar API Key para autenticación
- [ ] Proporcionar Secret para webhook
- [ ] Implementar endpoint para recibir actualizaciones de estado
- [ ] Implementar endpoint para recibir despachos
- [ ] Implementar endpoint para recibir pesadas
- [ ] Configurar endpoints de consulta (productos, clientes, pedidos)

### Datos a Proporcionar

- [ ] URL del webhook de RAM (te la daremos cuando despliegues)
- [ ] Secret compartido para webhook
- [ ] URL base de API de EVO
- [ ] API Key de EVO
- [ ] Documentación de API de EVO (si existe)

---

## 🧪 TESTING

### 1. Probar Webhook (EVO → RAM)

Puedes probar el webhook de RAM con curl:

```bash
curl -X POST http://localhost:3000/api/webhooks/evo \
  -H "Content-Type: application/json" \
  -H "x-evo-webhook-secret: tu_secret_aqui" \
  -d '{
    "event_type": "order_created",
    "order_id": "EVO-TEST-001",
    "order_number": "PED-TEST-001",
    "client_id": "CLI-TEST",
    "client_data": {
      "business_name": "Cliente de Prueba",
      "tax_id": "30-99999999-9"
    },
    "order_lines": [
      {
        "product_id": "PROD-TEST",
        "product_code": "TEST-001",
        "product_name": "Producto de Prueba",
        "quantity": 100,
        "unit_price": 1000,
        "subtotal": 100000
      }
    ],
    "total_weight": 100,
    "total_amount": 100000
  }'
```

### 2. Probar API REST (RAM → EVO)

EVO debe proporcionar endpoints de prueba para que RAM pueda validar la integración.

---

## 📞 PRÓXIMOS PASOS

1. **Reunión con equipo de EVO** para:
   - Confirmar estructura de datos
   - Acordar endpoints
   - Definir secrets y API keys
   - Establecer ambiente de pruebas

2. **Configurar ambiente de staging** para:
   - Probar webhooks
   - Probar API REST
   - Validar flujos completos

3. **Documentar casos de error** para:
   - Pedidos duplicados
   - Productos no encontrados
   - Errores de red
   - Timeouts

4. **Implementar funciones de sincronización** en RAM

5. **Testing end-to-end** con datos reales

---

## ❓ PREGUNTAS PARA EVO

1. ¿Tienen ya implementados webhooks o necesitan desarrollarlos?
2. ¿Tienen API REST disponible o necesitan crearla?
3. ¿Qué formato de autenticación prefieren? (API Key, OAuth, JWT)
4. ¿Tienen ambiente de staging/pruebas disponible?
5. ¿Cuál es el SLA esperado para respuestas de API?
6. ¿Cómo manejan reintentos en caso de fallo?
7. ¿Tienen documentación de API existente?
8. ¿Qué información adicional necesitan de RAM?

---

**Este documento debe ser compartido con el equipo técnico de EVO para coordinar la integración.** 🔗
