-- =====================================================
-- CERRAR EL ACCESO DIRECTO A LA BASE CON LA CLAVE PÚBLICA
-- =====================================================
-- La clave anon va en el bundle del navegador. Antes de esta migración:
--   - outbound_events tenía una política para el rol public con `true` en ALL:
--     cualquiera podía insertar/modificar eventos que luego se envían a EVO.
--   - user_selected_products y delivery_history admitían escritura pública.
--   - order_notes no tenía RLS.
--   - varias vistas (evo_*_recent, v_integration_logs…) se leían sin sesión.
--   - cualquier cuenta autenticada (no solo admins) tenía acceso total a casi
--     todas las tablas, incluida users (podía hacerse admin y leer pin_hash).
--
-- El servidor usa la service role (se salta RLS), así que nada de esto afecta
-- a las server actions ni a los webhooks. En el navegador solo quedan:
--   - admins (sesión de Supabase): leen outbound_events/evo_events/order_notes
--     por Realtime y la cuenta de pendientes del menú.
--   - planta: sin sesión de Supabase; deja de usar Realtime sobre order_notes
--     y pasa a consultar por server action.
--
-- Idempotente: se puede aplicar dos veces.

-- ---------- 1. Función de admin (una evaluación por consulta) ----------
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where (u.id = auth.uid()
           or (u.email is not null and u.email = lower(auth.jwt() ->> 'email')))
      and u.role::text in ('admin', 'manager')
      and u.is_active
  )
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

-- ---------- 2. Políticas públicas con `true` ----------
drop policy if exists "Admin can view all outbound events" on public.outbound_events;
drop policy if exists "Service role can manage outbound events" on public.outbound_events;
drop policy if exists outbound_events_admin_select on public.outbound_events;
create policy outbound_events_admin_select on public.outbound_events
  for select to authenticated using ((select private.is_admin()));

drop policy if exists "Allow public read access" on public.user_selected_products;
drop policy if exists "Allow public write access" on public.user_selected_products;
drop policy if exists user_selected_products_admin on public.user_selected_products;
create policy user_selected_products_admin on public.user_selected_products
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Allow read delivery_history" on public.delivery_history;
drop policy if exists "Allow server inserts delivery_history" on public.delivery_history;
drop policy if exists "Admin full access delivery_history" on public.delivery_history;
drop policy if exists delivery_history_admin on public.delivery_history;
create policy delivery_history_admin on public.delivery_history
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Users can view evo_events" on public.evo_events;
drop policy if exists evo_events_admin_select on public.evo_events;
create policy evo_events_admin_select on public.evo_events
  for select to authenticated using ((select private.is_admin()));

-- ---------- 3. order_notes: RLS ----------
alter table public.order_notes enable row level security;
drop policy if exists order_notes_admin on public.order_notes;
create policy order_notes_admin on public.order_notes
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------- 4. Políticas `authenticated` con `true` → solo admins ----------
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and roles = '{authenticated}'
      and (qual = 'true' or with_check = 'true')
  loop
    if p.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using ((select private.is_admin()))',
                     p.policyname, p.tablename);
    elsif p.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check ((select private.is_admin()))',
                     p.policyname, p.tablename);
    else
      execute format('alter policy %I on public.%I using ((select private.is_admin())) with check ((select private.is_admin()))',
                     p.policyname, p.tablename);
    end if;
  end loop;
end $$;

-- ---------- 5. Vistas: respetan RLS del que consulta y sin anon ----------
do $$
declare
  v record;
begin
  for v in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
    execute format('revoke all on public.%I from anon', v.relname);
  end loop;
end $$;

-- ---------- 6. Funciones: fuera de anon y search_path fijo ----------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'calculate_product_weight', 'calculate_total_meters', 'consume_reserved_stock',
        'consume_reserved_stock_match_exacto', 'extract_length_from_description',
        'get_available_units', 'get_user_role', 'reserve_stock', 'restore_reserved_stock',
        'rollback_order', 'unreserve_stock'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;

  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_user_role', 'rollback_order')
      and p.prosecdef
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
