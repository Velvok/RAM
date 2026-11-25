-- =====================================================
-- VARIAS PIEZAS POR CHAPA
-- =====================================================
-- Hasta ahora cada pieza gastaba una chapa base entera (3 piezas de 4 m con
-- chapa de 12 m = 3 chapas y 24 m de sobrante). Ahora de cada chapa salen
-- todas las piezas que caben: pieces_per_sheet = floor(largo chapa / largo
-- pieza), fijado al asignar la chapa a la orden de corte.
--
-- Con el valor por defecto (1) las órdenes anteriores se comportan igual.
-- material_quantity (ya existía, siempre 1) guarda las chapas previstas.
--
-- Reservas (lib/sheet-plan.ts, cutReservation): lo que falta por cortar se
-- reserva en CHAPAS de la chapa base; lo cortado y sin entregar, en PIEZAS del
-- producto de la pieza (cut_orders.assigned_inventory_id apunta a él).

alter table public.cut_orders
  add column if not exists pieces_per_sheet integer not null default 1;

comment on column public.cut_orders.pieces_per_sheet is 'Piezas que salen de cada chapa base (floor(largo chapa / largo pieza))';
comment on column public.cut_orders.material_quantity is 'Chapas base previstas para lo pedido (ceil(piezas / pieces_per_sheet))';
