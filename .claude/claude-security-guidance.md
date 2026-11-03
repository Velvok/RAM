# Reglas de seguridad de este proyecto (para el revisor automático)

- Supabase: toda tabla con datos de clientes tiene RLS y políticas; nada de
  `using (true)` para `anon`. El cliente service role (`SUPABASE_SERVICE_ROLE_KEY`)
  solo en servidor, filtrando siempre por el dueño de los datos.
- Server actions y route handlers comprueban la sesión (`supabase.auth.getUser()`)
  y el rol antes de leer parámetros; un id recibido del cliente se valida contra
  lo que el usuario puede tocar.
- Endpoints externos (cron, webhooks, integraciones): secreto Bearer comparado
  con `timingSafeEqual`; sin secreto configurado, rechazar.
- Secretos solo en variables de entorno sin `NEXT_PUBLIC_`; nunca en logs,
  respuestas, mensajes de error ni en el repo.
- Salidas de IA validadas con zod antes de persistir; documentos del cliente al
  modelo como datos delimitados.
