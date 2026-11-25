-- =====================================================
-- DESHACER CORTES
-- =====================================================
-- Un admin puede deshacer el último corte de una orden desde el historial del
-- pedido (corte registrado por error). Cada corte es una fila de cut_lines:
-- aquí se guarda qué evento se mandó a EVO por ese corte, y si se deshizo,
-- cuándo, quién, por qué y con qué evento inverso se avisó a EVO.
-- La fila no se borra al deshacer: queda como rastro.

alter table public.cut_lines add column if not exists outbound_event_id uuid references public.outbound_events(id) on delete set null;
alter table public.cut_lines add column if not exists reverted_at timestamptz;
alter table public.cut_lines add column if not exists reverted_by uuid references public.users(id) on delete set null;
alter table public.cut_lines add column if not exists revert_reason text;
alter table public.cut_lines add column if not exists reversal_event_id uuid references public.outbound_events(id) on delete set null;

comment on column public.cut_lines.outbound_event_id is 'Evento enviado a EVO por este corte (corte_realizado o chapa_preparada). Null si no se notificó.';
comment on column public.cut_lines.reverted_at is 'Cuándo se deshizo este corte. Null = corte vigente.';
comment on column public.cut_lines.reversal_event_id is 'Evento inverso enviado a EVO al deshacer. Null si no hizo falta avisar.';
