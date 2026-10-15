-- =====================================================
-- VERSIONAR outbound_events Y evo_locks
-- =====================================================
-- Estas dos tablas ya existen y están en uso en producción (lib/ram-outbound.ts)
-- pero nunca se habían versionado en ninguna migración — solo existían
-- creadas directamente en la base de datos real. Esta migración las
-- documenta con IF NOT EXISTS para que un entorno reconstruido desde cero
-- las tenga, sin tocar nada si ya existen (como es el caso hoy).
--
-- NOTA: la función `rollback_order` (usada en
-- app/api/webhooks/pedidos/nuevo/route.ts al reprocesar un pedido_creado
-- modificado) también existe solo en la base de datos real y no se ha
-- podido recuperar su definición exacta en esta sesión (no hay acceso a
-- una conexión SQL directa ni a un RPC genérico de introspección). Sigue
-- pendiente de versionar — recuperar su definición desde el editor SQL del
-- dashboard de Supabase (pg_get_functiondef) y añadirla en una migración
-- aparte.

CREATE TABLE IF NOT EXISTS outbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | success | failed
  http_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  related_entity_type TEXT,
  related_entity_id UUID,
  viewed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_events_status ON outbound_events(status);
CREATE INDEX IF NOT EXISTS idx_outbound_events_created_at ON outbound_events(created_at);
CREATE INDEX IF NOT EXISTS idx_outbound_events_related_entity ON outbound_events(related_entity_type, related_entity_id);

COMMENT ON TABLE outbound_events IS 'Cola Outbox de eventos salientes hacia EVO (lib/ram-outbound.ts). Procesados uno a la vez (ver evo_locks) con reintentos exponenciales.';

CREATE TABLE IF NOT EXISTS evo_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  locked_until TIMESTAMP WITH TIME ZONE,
  locked_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evo_locks IS 'Lock simple para serializar el despacho de eventos outbound hacia EVO (processOnePendingPrep en lib/ram-outbound.ts): nunca enviar un PREP nuevo hasta que el anterior esté confirmado.';

-- Fila inicial del lock usado por processOnePendingPrep, si no existe ya
INSERT INTO evo_locks (name, locked_until, locked_by)
SELECT 'evo_prep_dispatcher', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM evo_locks WHERE name = 'evo_prep_dispatcher');
