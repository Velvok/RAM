-- =====================================================
-- CERRAR TODAS LAS SESIONES DE UN USUARIO DEL PANEL
-- =====================================================
-- Al restablecer la contraseña de un admin/manager (vuelve a «Primer acceso»)
-- hay que echarle de los navegadores donde siga dentro. La API de Auth solo
-- cierra sesiones a partir del JWT del propio usuario, así que se borran sus
-- sesiones (y con ellas los refresh tokens) desde aquí. El access token que
-- ya tenga caduca solo (1 h como máximo).
--
-- Solo la llama el servidor con service role.

create or replace function public.cerrar_sesiones_usuario(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  return n;
end;
$$;

revoke execute on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
