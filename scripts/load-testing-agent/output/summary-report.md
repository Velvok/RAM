# Informe de Simulación RAM - Resumen Ejecutivo

**ID**: sim-2026-05-20T11-25-21-159Z  
**Inicio**: 5/20/2026, 1:25:22 PM  
**Fin**: 5/20/2026, 1:25:24 PM  
**Duración**: 0.0 minutos

---

## 📊 Métricas Generales

| Métrica | Valor |
|---------|-------|
| **Transacciones totales** | 4 |
| **Exitosas** | 2 ✅ |
| **Fallidas** | 2 ❌ |
| **Lentas (>5s)** | 0 ⚠️ |
| **Tiempo promedio** | 601ms |

---

## 📈 Transacciones por Tipo

| Operación | Cantidad | % del total |
|-----------|----------|-------------|
| CREATE_ORDER | 2 | 50.0% |
| APPROVE_ORDER | 2 | 50.0% |

---

## 🐌 Transacciones Más Lentas

| # | Operación | Duración | ID |
|---|-----------|----------|----|
| 1 | CREATE_ORDER | 854ms | e2ca13f9-03e1-404a-98ad-b146b9165b0f |
| 2 | CREATE_ORDER | 852ms | b16e217d-4215-4b3f-a26a-a07e9e523e10 |
| 3 | APPROVE_ORDER | 447ms | b16e217d-4215-4b3f-a26a-a07e9e523e10 |
| 4 | APPROVE_ORDER | 252ms | e2ca13f9-03e1-404a-98ad-b146b9165b0f |

---

## ✅ Validaciones

**Estado**: ✅ Completado exitosamente

⚠️ Se detectaron 2 errores.

✅ Todas las transacciones completadas en menos de 5 segundos.

---

## 📁 Archivos Generados

- transaction-log.json - Log detallado de todas las transacciones
- live-progress.md - Dashboard en tiempo real (ultimo estado)
- analysis-report.json - Analisis tecnico para debugging

---

*Generado el 5/20/2026, 1:25:25 PM*
