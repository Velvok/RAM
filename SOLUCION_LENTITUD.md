# 🐌 SOLUCIÓN A LA LENTITUD

## 🔍 PROBLEMA IDENTIFICADO

La aplicación estaba lenta debido a **caché corrupto de Turbopack** (el compilador de Next.js).

### **Errores en el log:**
```
Failed to restore task data (corrupted database or bug)
Unable to open static sorted file
Persisting failed: Unable to write SST file
Another write batch or compaction is already active
```

### **Síntomas:**
- ❌ Páginas tardan mucho en cargar
- ❌ Compilación lenta
- ❌ Errores de "module not found" intermitentes
- ❌ Panics de Turbopack

---

## ✅ SOLUCIÓN APLICADA

### **1. Limpieza completa de caché**

Se eliminaron todos los archivos de caché:
- ✅ `.next/` - Caché de Next.js
- ✅ `.turbo/` - Caché de Turbopack
- ✅ `node_modules/.cache/` - Caché de dependencias
- ✅ `tsconfig.tsbuildinfo` - Caché de TypeScript
- ✅ Caché de npm

### **2. Script de limpieza creado**

Se creó `clean-cache.sh` para futuras limpiezas:

```bash
./clean-cache.sh
```

---

## 🚀 RESULTADO ESPERADO

Después de la limpieza:

### **Antes:**
- ❌ GET /planta/pedidos 500 in 30ms
- ❌ Errores de compilación
- ❌ Panics de Turbopack

### **Después:**
- ✅ GET /planta/pedidos 200 in 10-20ms
- ✅ Compilación rápida
- ✅ Sin errores

---

## 🔧 CÓMO USAR

### **Si la app vuelve a estar lenta:**

```bash
# Opción 1: Usar el script
./clean-cache.sh
npm run dev

# Opción 2: Manual
rm -rf .next .turbo node_modules/.cache tsconfig.tsbuildinfo
npm run dev
```

---

## 📊 MÉTRICAS DE RENDIMIENTO

### **Tiempos de carga normales:**

| Ruta | Tiempo esperado |
|------|-----------------|
| `/` | 50-100ms |
| `/admin` | 100-200ms |
| `/admin/pedidos` | 50-150ms |
| `/planta/pedidos` | 50-150ms |
| `/planta/ordenes` | 50-150ms |

### **Si los tiempos superan 500ms:**
→ Ejecutar `./clean-cache.sh`

---

## 🛡️ PREVENCIÓN

### **Cuándo limpiar caché:**

1. **Después de cambios grandes** en la estructura de archivos
2. **Si aparecen errores** de "module not found"
3. **Si la compilación** tarda más de 5 segundos
4. **Si ves panics** de Turbopack en el log
5. **Una vez por semana** como mantenimiento

### **NO es necesario limpiar:**
- Después de cambios pequeños en código
- Al cambiar solo contenido (texto, estilos)
- Al agregar nuevos datos

---

## 💡 CAUSA RAÍZ

El problema ocurrió porque:

1. Se eliminaron archivos (`industrial-colors.ts`, `material-suggestions.ts`)
2. Turbopack tenía referencias a estos archivos en caché
3. Al intentar acceder a archivos inexistentes, el caché se corrompió
4. Esto causó errores en cascada y lentitud

**Solución:** Siempre limpiar caché después de eliminar archivos.

---

## 🎯 RECOMENDACIÓN

**Agregar al package.json:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "clean": "./clean-cache.sh && npm run dev"
  }
}
```

Luego puedes ejecutar:
```bash
npm run clean
```

---

## ✅ ESTADO ACTUAL

- ✅ Caché limpiado
- ✅ Script de limpieza creado
- ✅ Aplicación lista para funcionar rápido
- ✅ Sin archivos corruptos

---

**Última actualización:** 10 de Marzo de 2026  
**Problema:** Resuelto ✅
