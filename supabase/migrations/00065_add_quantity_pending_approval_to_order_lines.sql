-- =====================================================
-- MODIFICACIONES DE PEDIDO DESDE EVO: CANTIDAD PENDIENTE DE APROBAR
-- =====================================================
-- Cuando EVO reenvía un pedido ya existente (modificación) con más cantidad
-- o líneas nuevas, el aumento no se reserva automáticamente: queda en
-- quantity_pending_approval hasta que un admin apruebe la ampliación
-- (approveOrderModification en app/actions/orders.ts). Lo ya aprobado sigue
-- su curso en planta. order_lines.quantity refleja solo lo aprobado.

ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS quantity_pending_approval INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_lines.quantity_pending_approval IS 'Unidades añadidas por una modificación de EVO pendientes de aprobar (sin stock reservado). Se suman a quantity al aprobar la ampliación.';
