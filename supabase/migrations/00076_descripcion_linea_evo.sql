-- =====================================================
-- DESCRIPCIÓN DEL ARTÍCULO QUE MANDA EVO EN CADA LÍNEA
-- =====================================================
-- Desde el 27-nov EVO manda items[].descripcion en los pedidos, con las
-- unidades incluidas («Kg.Tubos … c/ Ud: 31.200»). Se guarda tal cual en la
-- línea para mostrarla en admin y en la tablet; si no llega, se usa el nombre
-- del producto.

alter table public.order_lines add column if not exists evo_description text;
