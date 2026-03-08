# 🚀 INSTRUCCIONES RÁPIDAS - RAM

## ✅ PROBLEMA RESUELTO

He reorganizado la estructura de carpetas. Las páginas ahora están en la ubicación correcta:

```
app/
  (admin)/
    layout.tsx          ✅
    page.tsx           ✅ Dashboard
    pedidos/
      page.tsx         ✅ Lista de pedidos
    stock/
      page.tsx         ✅ Inventario
    cortes/
      page.tsx         ✅ Órdenes de corte
```

---

## 🔄 CÓMO INICIAR EL SERVIDOR

### Opción 1: Script automático
```bash
./restart.sh
```

### Opción 2: Manual
```bash
# 1. Limpiar caché
rm -rf .next

# 2. Iniciar servidor
npm run dev
```

---

## 🌐 RUTAS QUE AHORA FUNCIONAN

### Admin
- ✅ http://localhost:3000/admin - Dashboard
- ✅ http://localhost:3000/admin/pedidos - Pedidos (2 pedidos de prueba)
- ✅ http://localhost:3000/admin/stock - Stock (6 productos)
- ✅ http://localhost:3000/admin/cortes - Órdenes de corte (3 órdenes)

### Planta
- ✅ http://localhost:3000/planta - Página de inicio
- ✅ http://localhost:3000/planta/login - Login PIN (1234)
- ✅ http://localhost:3000/planta/ordenes - Órdenes asignadas

---

## 🔍 QUÉ VAS A VER EN CADA PANTALLA

### 1. Dashboard (/admin)
- 4 tarjetas con métricas
- Pedidos Recientes: 2
- Órdenes Activas: 3
- Stock Bajo: 0
- Incidencias: 0

### 2. Pedidos (/admin/pedidos)
**Tabla con 2 pedidos:**
- PED-2024-001 - Metalúrgica San Martín - 500 kg - $750,000 - LANZADO
- PED-2024-002 - Construcciones del Sur - 300 kg - $450,000 - INGRESADO

### 3. Stock (/admin/stock)
**Tabla con 6 productos:**
- CH-3MM-1000 - 10,000 kg total - 250 kg reservado
- CH-6MM-1000 - 10,000 kg total - 250 kg reservado
- CH-10MM-1000 - 10,000 kg total - 300 kg reservado
- PF-100X50 - 10,000 kg total
- PF-150X75 - 10,000 kg total
- TU-50X50 - 10,000 kg total

### 4. Cortes (/admin/cortes)
**Tabla con 3 órdenes:**
- CUT-2024-001 - CH-3MM-1000 - 250 kg - Pedro Gómez - LANZADA
- CUT-2024-002 - CH-6MM-1000 - 250 kg - Luis Fernández - LANZADA
- CUT-2024-003 - CH-10MM-1000 - 300 kg - Sin asignar - GENERADA

### 5. Planta (/planta)
**Página actualizada con:**
- ✅ Badge verde "Sistema Operativo"
- ✅ Lista de funcionalidades con checkmarks
- ✅ Botón "Ingresar con PIN"

### 6. Login PIN (/planta/login)
**Teclado numérico:**
- Ingresar PIN: 1234
- Seleccionar operario: Pedro Gómez, Luis Fernández o Roberto Silva

### 7. Órdenes Planta (/planta/ordenes)
**Después de login con Pedro Gómez:**
- Ver 1 orden asignada: CUT-2024-001
- Hacer clic para ver detalle

---

## ⚠️ IMPORTANTE

### Si ves errores 404:
1. Asegúrate de que el servidor esté corriendo
2. Limpia la caché del navegador (Cmd+Shift+R en Mac)
3. Reinicia el servidor con `./restart.sh`

### Si la página de planta muestra "En Desarrollo":
1. El navegador tiene la versión antigua en caché
2. Presiona Cmd+Shift+R para forzar recarga
3. O abre en modo incógnito

### Si no ves datos en las tablas:
1. Verifica que los datos estén en Supabase
2. Revisa la consola del navegador (F12)
3. Verifica las variables de entorno en .env.local

---

## 🎯 PRÓXIMOS PASOS

1. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

2. **Abre el navegador:**
   - http://localhost:3000/admin

3. **Navega por las secciones:**
   - Dashboard → Ver métricas
   - Pedidos → Ver 2 pedidos
   - Stock → Ver 6 productos
   - Cortes → Ver 3 órdenes

4. **Prueba la interfaz de planta:**
   - http://localhost:3000/planta/login
   - PIN: 1234
   - Selecciona Pedro Gómez
   - Ve su orden asignada

---

## 📊 DATOS DE PRUEBA

### Pedidos
- PED-2024-001 (Lanzado)
- PED-2024-002 (Ingresado)

### Productos
- 6 productos con 10,000 kg cada uno
- 3 con reservas activas

### Órdenes de Corte
- 2 asignadas a operarios
- 1 sin asignar

### Operarios (PIN: 1234)
- Pedro Gómez (1 orden)
- Luis Fernández (1 orden)
- Roberto Silva (0 órdenes)

---

**¡Todo está listo! Solo necesitas iniciar el servidor y refrescar el navegador.**
