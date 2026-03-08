# 🔑 Configuración de Variables de Entorno

## ✅ Base de Datos Creada

**18 tablas** creadas exitosamente en Supabase con RLS habilitado:
- users (1 registro: admin@velvok.com)
- clients, products, inventory
- orders, order_lines
- cut_orders, cut_lines
- remnants, stock_reservations, stock_movements
- acopios, dispatches, weighings, incidents
- devices, sync_logs, audit_logs

## 📝 Configurar .env.local

Edita el archivo `.env.local` con estos valores:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://efhpkccbsshcuvsdcevy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmaHBrY2Nic3NoY3V2c2RjZXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDkxMDIsImV4cCI6MjA4ODM4NTEwMn0.1j_e_FcK9fwF5jmpWRSs1MmRunW5CnbIRqkXLS35oMQ
SUPABASE_SERVICE_ROLE_KEY=<TU_SERVICE_ROLE_KEY_AQUI>

# Vercel AI (opcional por ahora)
OPENAI_API_KEY=your_openai_api_key_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ERP Evo Webhook Secret
EVO_WEBHOOK_SECRET=tu_webhook_secret_seguro_aqui
```

## 🔐 Obtener Service Role Key

1. Ir a: https://supabase.com/dashboard/project/efhpkccbsshcuvsdcevy/settings/api
2. Copiar el valor de **service_role** (secret)
3. Pegarlo en `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ IMPORTANTE:** La service_role key es secreta y solo debe usarse en el servidor.

## ✅ Verificar

Después de configurar `.env.local`:

1. El servidor Next.js se recargará automáticamente
2. Deberías poder acceder a http://localhost:3000/admin
3. El error de "URL and Key required" desaparecerá

## 🎯 Siguiente Paso

Una vez configurado, podrás:
- Acceder al dashboard admin
- Ver las tablas en Supabase
- Crear productos de prueba
- Probar el webhook de ERP Evo
