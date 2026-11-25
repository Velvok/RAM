-- =====================================================
-- RAM TRABAJA EN UNIDADES: products.unit = 'ud'
-- =====================================================
-- La sincronización de stock de EVO creaba los productos con unit = 'kg'
-- (herencia del esquema inicial). RAM cuenta todo en unidades: pedidos,
-- cortes, stock e historial. El valor viajaba a EVO en el aviso de pedido
-- completado. Los nombres «Kg.…» vienen de EVO y no se tocan aquí.

alter table public.products alter column unit set default 'ud';
update public.products set unit = 'ud' where unit is distinct from 'ud';
