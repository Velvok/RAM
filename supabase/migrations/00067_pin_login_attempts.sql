-- =====================================================
-- LÍMITE DE INTENTOS DEL LOGIN POR PIN DE PLANTA
-- =====================================================
-- loginWithPin (app/actions/auth.ts) registra aquí cada PIN fallido con la IP
-- de origen y rechaza el login si esa IP acumula demasiados fallos recientes.
-- Sin esto, un PIN de 4 dígitos se adivina por fuerza bruta en minutos.
--
-- Solo la usa el servidor con service role: RLS activado y sin políticas, de
-- modo que anon/authenticated no pueden leerla ni escribirla.

create table if not exists public.pin_login_attempts (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  created_at  timestamptz not null default now()
);

create index if not exists pin_login_attempts_ip_created_idx
  on public.pin_login_attempts (ip, created_at desc);

alter table public.pin_login_attempts enable row level security;

revoke all on public.pin_login_attempts from anon, authenticated;

comment on table public.pin_login_attempts is
  'PIN de planta fallidos por IP, para limitar intentos. Solo servidor (service role).';
