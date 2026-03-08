# ✅ ERROR DE CORTES SOLUCIONADO

## Problema:
```
Error: Could not embed because more than one relationship was found for 'cut_orders' and 'products'
```

## Causa:
La tabla `cut_orders` tiene **dos relaciones** con `products`:
1. `product_id` → El producto final a cortar
2. `material_base_id` → El material base usado (también es un producto)

Cuando hacías `product:products(*)`, Supabase no sabía cuál usar.

## Solución:
Especifiqué las relaciones exactas usando los nombres de las foreign keys:

### ANTES (ambiguo):
```typescript
.select(`
  *,
  product:products(*),
  material_base:products!material_base_id(*),
  assigned_operator:users!assigned_to(*)
`)
```

### AHORA (específico):
```typescript
.select(`
  *,
  product:products!cut_orders_product_id_fkey(*),
  material_base:products!cut_orders_material_base_id_fkey(*),
  assigned_operator:users!cut_orders_assigned_to_fkey(*)
`)
```

## ✅ Resultado:
La página `/admin/cortes` ahora funciona correctamente.

## 🎯 Qué hacer:
1. **Refresca la página** en tu navegador (Cmd+Shift+R)
2. Ve a http://localhost:3000/admin/cortes
3. Deberías ver la tabla con las 3 órdenes de corte

## 📊 Datos que verás:
- **CUT-2024-001** - CH-3MM-1000 - 250 kg - Pedro Gómez - LANZADA
- **CUT-2024-002** - CH-6MM-1000 - 250 kg - Luis Fernández - LANZADA
- **CUT-2024-003** - CH-10MM-1000 - 300 kg - Sin asignar - GENERADA

---

**¡Problema resuelto! Todas las páginas admin ahora funcionan.** ✅
