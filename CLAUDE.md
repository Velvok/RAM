# RAM

## Qué es

Gestión de pedidos, corte de chapa y stock de Comercial RAM, integrada con el ERP EVO: los pedidos entran por webhook desde EVO, se aprueban en `/admin` y los operarios los cortan o preparan en `/planta` (tablets con PIN); cada corte o preparación se notifica a EVO por una cola saliente.

## Stack y comandos

npm run dev · npm run build · npm run start · npm run lint · npm run type-check · npm run clean · npm run clean-only · npm run typecheck · npm run aislamiento · npm test

## Mapa del código

- `app/admin`: panel (sesión de Supabase; solo usuarios admin/manager de la tabla `users`).
- `app/planta`: tablets de planta (sesión firmada `planta_session` que crea el login por PIN; la protege `proxy.ts`).
- `app/actions`: server actions. Cada export empieza por `requireAdmin()` o `requireStaff()` de `lib/auth/guards.ts`.
- `app/api/webhooks`: entradas de EVO (Bearer `EVO_WEBHOOK_SECRET`). Lo que llamen sin usuario va dentro de `runAsSystem()`.
- `lib/ram-outbound.ts`: cola saliente hacia EVO (`outbound_events`, un evento a la vez con `evo_locks`).
- `lib/order-modification.ts`: modificaciones de pedido que manda EVO (estado `modificado`).
- `app/actions/dashboard-operativo.ts` + `components/dashboard-operativo.tsx`: dashboard operativo (`/admin`), todo calculado sobre tablas existentes.
- `product_movements` (migración 00069) + `lib/historial-movimientos.ts`: historial de movimientos por producto (entregas, compras, cortes, remanentes) que alimenta `/admin/historial` (`app/actions/historial.ts`). Lo escriben el webhook de entrega, `processCutOrder` y el webhook `stock_actualizado`.
- `supabase/migrations`: migraciones; se aplican con `./scripts/supabase-sql.sh -f`.

## Reglas

- Seguridad, verificación, migraciones y tests: skills `velvok-seguridad-supabase`, `velvok-verificacion`, `velvok-migraciones-supabase`, `velvok-tests`. Infra y cuentas: `velvok-infra`.
- Nada se da por hecho sin ejecutarlo: `bash ~/.claude/skills/velvok-verificacion/scripts/verificar.sh`.
- Código, comentarios y commits en español; commits solo cuando se pidan.
