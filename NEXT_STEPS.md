# 🚀 Próximos Pasos Inmediatos

## 1️⃣ Instalación y Configuración (15 min)

### Instalar dependencias
```bash
cd /Users/alvaropons/Desktop/ALVARO/VELVOK/RAM
npm install
```

### Configurar variables de entorno
```bash
cp .env.local.example .env.local
```

Editar `.env.local` con tus credenciales de Supabase:
- Ir a https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy
- Settings → API
- Copiar URL y keys

## 2️⃣ Base de Datos (10 min)

### Ejecutar migración
1. Abrir https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy
2. SQL Editor → New Query
3. Copiar contenido de `supabase/migrations/00001_initial_schema.sql`
4. Ejecutar (Run)

### Verificar tablas creadas
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver 17 tablas.

## 3️⃣ Primer Arranque (5 min)

```bash
npm run dev
```

Abrir http://localhost:3000

**Nota**: Los errores de lint desaparecerán después de `npm install`.

## 4️⃣ Crear Datos de Prueba (10 min)

### Usuario Admin
```sql
-- En Supabase SQL Editor
INSERT INTO users (email, full_name, role, is_active)
VALUES ('admin@velvok.com', 'Admin Velvok', 'admin', true);
```

### Productos de Prueba
```sql
INSERT INTO products (code, name, category, thickness_mm, min_remnant_threshold, is_active)
VALUES 
  ('CH-3MM', 'Chapa 3mm', 'chapas', 3.0, 500, true),
  ('CH-6MM', 'Chapa 6mm', 'chapas', 6.0, 500, true),
  ('CH-10MM', 'Chapa 10mm', 'chapas', 10.0, 500, true),
  ('PF-100', 'Perfil 100x50', 'perfiles', NULL, 1000, true);

-- Crear inventario inicial
INSERT INTO inventory (product_id, stock_total)
SELECT id, 10000 FROM products;
```

### Cliente de Prueba
```sql
INSERT INTO clients (business_name, tax_id, is_active)
VALUES ('Cliente Test S.A.', '30-12345678-9', true);
```

## 5️⃣ Probar Webhook (Opcional)

### Usar herramienta como Postman o curl:

```bash
curl -X POST http://localhost:3000/api/webhooks/evo \
  -H "Content-Type: application/json" \
  -H "x-evo-webhook-secret: your_webhook_secret_here" \
  -d '{
    "event_type": "order_created",
    "order_id": "EVO-001",
    "client_id": "CLI-001",
    "order_number": "PED-2024-001",
    "client_data": {
      "business_name": "Cliente Test",
      "tax_id": "30-12345678-9"
    },
    "order_lines": [
      {
        "product_id": "PROD-001",
        "product_code": "CH-3MM",
        "product_name": "Chapa 3mm",
        "quantity": 500,
        "unit_price": 1500,
        "subtotal": 750000
      }
    ],
    "total_weight": 500,
    "total_amount": 750000
  }'
```

## 6️⃣ Desarrollo Prioritario

### Semana 1 (Crítico)
- [ ] **Autenticación PIN** para operarios
- [ ] **Pantalla login planta** (`/app/(planta)/planta/login/page.tsx`)
- [ ] **Lista de órdenes planta** (`/app/(planta)/planta/ordenes/page.tsx`)
- [ ] **Server Actions básicos** (`/app/actions/`)

### Semana 2 (Importante)
- [ ] **Sistema offline** (Service Workers + IndexedDB)
- [ ] **Sync Queue** para sincronización
- [ ] **Pantallas admin** (pedidos, stock, cortes)
- [ ] **Componentes de tablas** (TanStack Table)

### Semana 3 (Complementario)
- [ ] **Vercel AI SDK** integración
- [ ] **Generative UI** para copiloto
- [ ] **Dashboard avanzado** con gráficos
- [ ] **Gestión de recortes y acopios**

## 📋 Checklist Rápido

- [ ] `npm install` ejecutado
- [ ] `.env.local` configurado
- [ ] Migración SQL ejecutada en Supabase
- [ ] Datos de prueba creados
- [ ] `npm run dev` funcionando
- [ ] Dashboard admin accesible en `/admin`
- [ ] Estructura de planta accesible en `/planta`

## 🆘 Troubleshooting

### Error: Cannot find module
→ Ejecutar `npm install`

### Error: Supabase connection
→ Verificar `.env.local` con las keys correctas

### Error: Database tables not found
→ Ejecutar migración SQL en Supabase

### Errores de TypeScript
→ Normal antes de `npm install`, desaparecerán después

## 📞 Contacto

Si necesitas ayuda, revisa:
- `README.md` - Documentación completa
- `SETUP.md` - Guía de configuración detallada
- Supabase Dashboard - Para verificar base de datos

---

**¡Listo para empezar! 🎉**

El proyecto está inicializado con arquitectura sólida y listo para desarrollo.
