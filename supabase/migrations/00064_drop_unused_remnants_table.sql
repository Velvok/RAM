-- La funcionalidad de "Recortes" (/admin/recortes) era código muerto: el único
-- flujo real de corte (app/actions/cut-operations.ts) nunca escribía en esta
-- tabla, solo notificaba el remanente a EVO. El remanente se integra como stock
-- local del producto de la medida correspondiente a través de
-- generateRemnantStock() (app/actions/stock-management.ts), no de esta tabla.
-- La única función que insertaba aquí (finishCutOrder) no se llamaba desde
-- ningún sitio. Se elimina la página de admin, las server actions y la tabla.
DROP TABLE IF EXISTS remnants;
