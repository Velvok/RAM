-- =====================================================
-- RESERVAS DE LO YA CORTADO: DE LA CHAPA BASE A LA PIEZA
-- =====================================================
-- Con «varias piezas por chapa» (00074) lo cortado y sin entregar se reserva
-- en PIEZAS del producto pedido, no en la chapa base. Esta migración pasa a
-- ese modelo las órdenes que ya estaban cortadas con el anterior (una chapa
-- reservada por pieza en la chapa base): mueve su reserva y apunta
-- assigned_inventory_id al inventario de la pieza, que es donde la entrega
-- la libera. Lo que falta por cortar no cambia (una pieza por chapa = igual).
--
-- Es idempotente: solo toca órdenes cuya reserva sigue en la chapa base.

do $$
declare
  r record;
begin
  for r in
    select co.id,
           co.quantity_cut - coalesce(co.quantity_delivered, 0) as piezas,
           ib.id as base_inv,
           ip.id as pieza_inv
    from public.cut_orders co
    join public.orders o on o.id = co.order_id
    join public.inventory ib on ib.product_id = co.material_base_id
    join public.inventory ip on ip.product_id = co.product_id
    where o.status not in ('entregado', 'cancelado')
      and co.material_base_id is not null
      and co.material_base_id <> co.product_id
      and co.quantity_cut - coalesce(co.quantity_delivered, 0) > 0
      and (co.assigned_inventory_id is null or co.assigned_inventory_id = ib.id)
  loop
    update public.inventory set stock_reservado = greatest(0, stock_reservado - r.piezas) where id = r.base_inv;
    update public.inventory set stock_reservado = stock_reservado + r.piezas where id = r.pieza_inv;
    update public.cut_orders set assigned_inventory_id = r.pieza_inv where id = r.id;
  end loop;
end $$;
