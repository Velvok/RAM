# Informe de Simulación RAM - Resumen Ejecutivo

**ID**: sim-2026-05-20T11-41-10-553Z  
**Inicio**: 5/20/2026, 1:41:11 PM  
**Fin**: 5/20/2026, 1:41:22 PM  
**Duración**: 0.2 minutos

---

## 📊 Métricas Generales

| Métrica | Valor |
|---------|-------|
| **Transacciones totales** | 35 |
| **Exitosas** | 25 ✅ |
| **Fallidas** | 10 ❌ |
| **Lentas (>5s)** | 0 ⚠️ |
| **Tiempo promedio** | 423ms |

---

## 📈 Transacciones por Tipo

| Operación | Cantidad | % del total |
|-----------|----------|-------------|
| CREATE_ORDER | 20 | 57.1% |
| APPROVE_ORDER | 5 | 14.3% |
| COMPLETE_CUT | 10 | 28.6% |

---

## 🐌 Transacciones Más Lentas

| # | Operación | Duración | ID |
|---|-----------|----------|----|
| 1 | CREATE_ORDER | 549ms | 8c2cb2e9-6517-4c43-a4f8-ae5da607163c |
| 2 | CREATE_ORDER | 544ms | a655ed46-1b3b-4ff4-82be-549dcfa8a38a |
| 3 | CREATE_ORDER | 531ms | 8c57bddd-edbe-4940-a0c3-cd61b92e67c2 |
| 4 | COMPLETE_CUT | 509ms | 8bc3663c-c7fd-4936-9068-43af7e3e322d |
| 5 | CREATE_ORDER | 499ms | be5a3bf2-0e76-4e91-8179-688d0da28a06 |

---

## ✅ Validaciones

**Estado**: ✅ Completado exitosamente

⚠️ Se detectaron 10 errores.

✅ Todas las transacciones completadas en menos de 5 segundos.

---

## 📁 Archivos Generados

- transaction-log.json - Log detallado de todas las transacciones
- live-progress.md - Dashboard en tiempo real (ultimo estado)
- analysis-report.json - Analisis tecnico para debugging

---

*Generado el 5/20/2026, 1:41:23 PM*
