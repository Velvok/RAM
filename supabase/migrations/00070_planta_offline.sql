-- =====================================================
-- PLANTA SIN CONEXIÓN: operaciones sincronizadas y estado de las tablets
-- =====================================================
-- La tablet de planta guarda en local cada corte, preparación, recogida o nota
-- y lo envía a /api/planta/sync cuando hay conexión. Cada operación lleva un
-- op_id generado en la tablet: si el envío se repite (corte de red a mitad,
-- reintento), el servidor devuelve el resultado guardado y no la aplica dos
-- veces (ni avisa dos veces a EVO).
--
-- planta_devices guarda la última noticia de cada tablet y cuántas acciones
-- tiene sin enviar, para que el admin sepa que la planta está sin conexión.
--
-- Solo las usa el servidor con service role: RLS activado y sin políticas.

create table if not exists public.planta_operations (
  id               uuid primary key default gen_random_uuid(),
  op_id            uuid not null unique,
  device_id        text not null,
  operator_id      uuid references public.users(id) on delete set null,
  operator_name    text,
  kind             text not null check (kind in ('cut', 'prepare', 'confirm_pickup', 'change_sheet', 'note', 'note_read')),
  order_id         uuid references public.orders(id) on delete set null,
  payload          jsonb not null default '{}'::jsonb,
  occurred_at      timestamptz not null,
  received_at      timestamptz not null default now(),
  status           text not null default 'processing' check (status in ('processing', 'applied', 'rejected')),
  message          text,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references public.users(id) on delete set null
);

create index if not exists planta_operations_status_idx
  on public.planta_operations (status, acknowledged_at) where status = 'rejected';
create index if not exists planta_operations_order_idx
  on public.planta_operations (order_id, received_at desc);
create index if not exists planta_operations_device_idx
  on public.planta_operations (device_id, received_at desc);

create table if not exists public.planta_devices (
  device_id          text primary key,
  operator_id        uuid references public.users(id) on delete set null,
  operator_name      text,
  last_seen_at       timestamptz not null default now(),
  pending_ops        integer not null default 0,
  oldest_pending_at  timestamptz,
  pending_order_ids  uuid[] not null default '{}',
  last_sync_at       timestamptz,
  last_offline_sync  jsonb,
  user_agent         text,
  created_at         timestamptz not null default now()
);

alter table public.planta_operations enable row level security;
alter table public.planta_devices enable row level security;

revoke all on public.planta_operations from anon, authenticated;
revoke all on public.planta_devices from anon, authenticated;

comment on table public.planta_operations is
  'Operaciones de planta enviadas por la tablet (también las hechas sin conexión). op_id único = idempotencia. Solo servidor.';
comment on table public.planta_devices is
  'Última noticia de cada tablet de planta y acciones pendientes de enviar. Solo servidor.';
