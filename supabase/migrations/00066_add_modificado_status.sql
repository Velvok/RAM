-- =====================================================
-- MODIFICACIONES DE PEDIDO DESDE EVO: ESTADO 'modificado'
-- =====================================================
-- Cuando EVO amplía un pedido ya aprobado (más cantidad o líneas nuevas), el
-- pedido pasa a 'modificado' hasta que un admin apruebe la ampliación
-- (approveOrderModification en app/actions/orders.ts). Así se ve en la lista
-- que hay que volver a aprobarlo.
--
-- status_before_modification guarda el estado al que volver al aprobar (o si
-- EVO retira la ampliación antes). Mientras tanto la planta sigue viendo el
-- pedido y puede trabajar las líneas ya aprobadas: updateOrderStatus mantiene
-- ese estado "real" en status_before_modification en vez de pisar 'modificado'.
--
-- NOTA: en la BD real orders.status es el enum order_status (no TEXT), y el
-- constraint orders_status_check conserva valores antiguos del enum. Por eso:
--   1) El valor nuevo se añade al enum. Un valor de enum recién añadido no se
--      puede usar en la misma transacción, así que este ALTER TYPE debe
--      ejecutarse (y confirmarse) ANTES del resto del archivo.
--   2) El constraint se recrea con la lista real actual + 'modificado'.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'modificado';

-- ---- Ejecutar a partir de aquí en una transacción posterior ----

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'ingresado', 'generado', 'pendiente_aprobacion', 'lanzado',
    'nuevo', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'preparado_pendiente_retiro',
    'finalizado', 'modificado', 'parcialmente_entregado', 'entregado',
    'despachado', 'bloqueado', 'cancelado'
  ));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_before_modification TEXT;

COMMENT ON COLUMN orders.status IS 'Estado del pedido (en uso): nuevo, aprobado, aprobado_en_pausa, en_corte, finalizado, modificado, parcialmente_entregado, entregado, cancelado';
COMMENT ON COLUMN orders.status_before_modification IS 'Estado real del pedido mientras está en modificado (ampliación de EVO pendiente de aprobar). Se restaura al aprobar la ampliación.';
