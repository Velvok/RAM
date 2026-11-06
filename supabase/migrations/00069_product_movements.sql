-- =====================================================
-- HISTORIAL DE MOVIMIENTOS POR PRODUCTO (base del Historial anual)
-- =====================================================
-- Una fila por movimiento real, con todas las dimensiones que el historial
-- necesita para filtrar y prever: producto, familia, largo, cliente, pedido,
-- tipo, unidades, metros y kilos. La escribe solo el servidor:
--   - entrega:   webhook pedido_entregado (completa y parcial)
--   - corte:     processCutOrder (chapas cortadas de otro largo)
--   - remanente: processCutOrder (sobrante que vuelve a stock)
--   - compra:    webhook stock_actualizado, cuando EVO sube el total de un
--                producto sin que haya habido un movimiento nuestro
--   - historico: carga del histórico anterior (annual_history o EVO)
-- Sustituye a annual_history (agregado mensual sin cliente ni compras), que
-- se mantiene por compatibilidad pero deja de usarse en la pantalla.

create table if not exists public.product_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  family_code   text not null,
  length_m      numeric,
  movement_type text not null check (movement_type in ('entrega', 'compra', 'corte', 'remanente', 'historico')),
  units         numeric not null default 0,
  meters        numeric not null default 0,
  kg            numeric not null default 0,
  client_id     uuid references public.clients(id) on delete set null,
  order_id      uuid references public.orders(id) on delete set null,
  order_number  text,
  source        text,              -- webhook_entrega | corte | stock_actualizado | annual_history | evo_import
  source_ref    text,              -- id_evento, cut_order id, etc. (idempotencia)
  occurred_at   timestamptz not null default now(),  -- mes/año se calculan en hora de Argentina al consultar
  created_at    timestamptz not null default now()
);

create index if not exists product_movements_product_date_idx on public.product_movements (product_id, occurred_at desc);
create index if not exists product_movements_type_date_idx on public.product_movements (movement_type, occurred_at desc);
create index if not exists product_movements_family_idx on public.product_movements (family_code);
create index if not exists product_movements_client_idx on public.product_movements (client_id);
create index if not exists product_movements_occurred_idx on public.product_movements (occurred_at desc);
-- Idempotencia por origen (los null de source_ref no chocan entre sí). Sin
-- WHERE: un índice parcial no sirve como destino de ON CONFLICT desde PostgREST.
drop index if exists public.product_movements_source_ref_uq;
create unique index if not exists product_movements_source_ref_uq on public.product_movements (source, source_ref, product_id, movement_type);

alter table public.product_movements enable row level security;
revoke all on public.product_movements from anon;
drop policy if exists product_movements_admin_select on public.product_movements;
create policy product_movements_admin_select on public.product_movements
  for select to authenticated using ((select private.is_admin()));

comment on table public.product_movements is 'Historial de movimientos por producto (entregas, compras, cortes, remanentes). Base del Historial anual.';

-- Carga inicial desde annual_history (agregado mensual de ventas, sin cliente):
-- una fila 'historico' por producto y mes, fechada el día 1.
insert into public.product_movements (product_id, family_code, length_m, movement_type, units, kg, source, source_ref, occurred_at)
select
  h.product_id,
  coalesce(nullif(regexp_replace(p.code, '^([A-Z0-9*\s]+)\..*$', '\1'), p.code), p.code),
  p.length_meters,
  'historico',
  coalesce(h.sales_units, 0),
  coalesce(h.sales_kg, 0),
  'annual_history',
  h.product_id::text || ':' || h.year || '-' || h.month,
  make_timestamptz(h.year, h.month, 1, 12, 0, 0, 'America/Argentina/Buenos_Aires')
from public.annual_history h
join public.products p on p.id = h.product_id
where coalesce(h.sales_units, 0) > 0
on conflict do nothing;
