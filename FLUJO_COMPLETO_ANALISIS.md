# 📊 ANÁLISIS DEL FLUJO COMPLETO

## 🎯 OBJETIVO

Implementar un flujo completo desde la creación de pedido hasta su finalización, con gestión automática de stock.

---

## 📋 FLUJO DESEADO (PASO A PASO)

### **1. GENERACIÓN DE PEDIDO DE PRUEBA**
✅ **Ya funciona**
- Se crea pedido con productos que existen en stock
- Estado inicial: `nuevo`

### **2. APROBACIÓN DE PEDIDO**
🔧 **Necesita cambios**

**Actualmente:**
- Se crean órdenes de corte (1 por unidad)
- NO se asigna stock
- NO se reserva stock

**Debe hacer:**
1. Crear órdenes de corte (1 por unidad)
2. **Por cada orden de corte:**
   - Buscar stock disponible del producto
   - Asignar la mejor pieza (lógica inteligente)
   - Guardar en `cut_orders.material_base_id`
   - Reservar stock: `stock_total` → `stock_reservado`
3. Cambiar estado a `aprobado`

### **3. LÓGICA DE ASIGNACIÓN DE STOCK**

**Reglas:**
- Si se pide 7m y hay 7m disponible → asignar esa
- Si no hay exacta → asignar la más pequeña que sea mayor
- Ejemplo: pido 7m, hay [5m, 8m, 10m] → asignar 8m
- Solo asignar del mismo `product_id` (tipo de material)

**Campos a usar:**
- `inventory.stock_total` - Stock total
- `inventory.stock_reservado` - Stock reservado
- `inventory.stock_en_proceso` - Stock en proceso (¿para qué?)
- `inventory.stock_disponible` - Calculado: total - reservado - en_proceso

### **4. STOCK EN PROCESO - ACLARACIÓN**

**Pregunta:** ¿Para qué usamos `stock_en_proceso`?

**Propuesta:**
- `stock_reservado`: Cuando se aprueba el pedido (stock asignado pero no cortado)
- `stock_en_proceso`: Cuando se inicia el corte (operario empieza a cortar)
- Cuando se finaliza: se resta de `stock_total` y `stock_en_proceso`

**Flujo:**
```
Aprobar pedido:
  stock_total: 100 → 100
  stock_reservado: 0 → 7
  stock_disponible: 100 → 93

Iniciar corte:
  stock_total: 100 → 100
  stock_reservado: 7 → 0
  stock_en_proceso: 0 → 7
  stock_disponible: 93 → 93

Finalizar corte:
  stock_total: 100 → 93
  stock_reservado: 0 → 0
  stock_en_proceso: 7 → 0
  stock_disponible: 93 → 93
```

### **5. DETALLE DE PEDIDO (ADMIN)**

**Actualmente:**
- Muestra órdenes de corte
- NO muestra stock asignado

**Debe mostrar:**
- Número de corte
- Producto solicitado
- Cantidad solicitada
- **Stock asignado** (ej: "Chapa 8m - ID: ABC123")
- Estado
- Operario asignado

### **6. PLANTA - DETALLE DE PEDIDO**

**Actualmente:**
- Muestra lista de órdenes de corte
- NO hay sugerencias
- NO hay selección manual

**Debe tener:**
- Lista de órdenes pendientes
- Click en orden → pantalla de selección de material

### **7. PLANTA - SELECCIÓN DE MATERIAL**

**Debe mostrar:**

**A) Sugerencia del sistema (pre-seleccionada):**
- La pieza que se asignó automáticamente
- Mostrar: "Chapa Sinusoidal CINC.25 - 8m"
- Botón: "USAR SUGERENCIA"

**B) Selección manual:**
- Botón: "SELECCIÓN MANUAL"
- Al hacer click → mostrar lista de opciones
- **Solo mostrar del mismo `product_id`**
- Ordenadas por tamaño (más cercanas primero)
- Mostrar: tamaño, stock disponible

### **8. CONFIRMACIÓN Y FINALIZACIÓN**

**Al confirmar corte:**
1. Guardar material usado en `cut_lines`
2. Actualizar `cut_orders.status` = 'completada'
3. Actualizar stock:
   - Restar de `stock_total`
   - Restar de `stock_en_proceso`
4. Actualizar estado del pedido

### **9. ESTADOS DEL PEDIDO**

**Flujo de estados:**
```
nuevo → aprobado → en_corte → finalizado
```

**Lógica:**
- `nuevo`: Recién creado
- `aprobado`: Aprobado, stock asignado, esperando corte
- `en_corte`: Al menos 1 orden completada, pero no todas
- `finalizado`: Todas las órdenes completadas

---

## 🗄️ ESTRUCTURA DE DATOS

### **inventory**
```sql
stock_total       -- Stock físico total
stock_reservado   -- Asignado a pedidos aprobados
stock_en_proceso  -- En proceso de corte
stock_disponible  -- Calculado: total - reservado - en_proceso
```

### **cut_orders**
```sql
material_base_id  -- ID del producto de stock asignado
status            -- pendiente | completada
```

### **cut_lines**
```sql
material_used_id     -- ID del producto realmente usado
quantity_used        -- Cantidad usada
quantity_produced    -- Cantidad producida
remnant_generated    -- Recorte generado
```

---

## 🔧 CAMBIOS NECESARIOS

### **1. Función: `assignStockToCutOrder(cutOrderId, productId, quantityNeeded)`**
- Buscar stock disponible del producto
- Encontrar la mejor pieza (lógica inteligente)
- Asignar en `cut_orders.material_base_id`
- Reservar stock

### **2. Función: `reserveStock(productId, quantity)`**
- Actualizar `inventory.stock_reservado += quantity`

### **3. Función: `releaseStock(productId, quantity)`**
- Actualizar `inventory.stock_reservado -= quantity`
- Actualizar `inventory.stock_en_proceso += quantity`

### **4. Función: `consumeStock(productId, quantity)`**
- Actualizar `inventory.stock_total -= quantity`
- Actualizar `inventory.stock_en_proceso -= quantity`

### **5. Actualizar `approveOrder()`**
- Después de crear cut_orders
- Asignar stock a cada orden
- Reservar stock

### **6. Actualizar `finishCutOrder()`**
- Liberar stock reservado
- Consumir stock
- Actualizar estado del pedido

### **7. Crear `getAvailableStockOptions(productId, minQuantity)`**
- Para selección manual en planta
- Retornar opciones ordenadas por tamaño

---

## 📝 DATOS DE PRUEBA

**Necesitamos:**
- Productos en `products` (ya tenemos de migración 00017)
- Stock en `inventory` con cantidades positivas
- Pedido de prueba que use esos productos

**Ejemplo:**
```
Producto: Chapa Sinusoidal CINC.25
Stock disponible: [5m, 7m, 8m, 10m, 12m]
Pedido: 2 unidades de 7m

Resultado:
- Orden 1: asignar 7m (exacta)
- Orden 2: asignar 8m (siguiente disponible)
```

---

## ✅ PLAN DE IMPLEMENTACIÓN

1. ✅ Analizar estructura actual
2. 🔧 Crear funciones de gestión de stock
3. 🔧 Actualizar `approveOrder` con asignación automática
4. 🔧 Actualizar UI de admin para mostrar stock asignado
5. 🔧 Implementar sugerencias en planta
6. 🔧 Implementar selección manual en planta
7. 🔧 Actualizar lógica de estados
8. 🔧 Generar datos de prueba
9. 🧪 Probar flujo completo

---

**¿Procedemos con la implementación paso por paso?**
