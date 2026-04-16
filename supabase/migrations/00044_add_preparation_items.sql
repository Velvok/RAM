-- =====================================================
-- TABLA: preparation_items
-- Artículos a preparar (productos que no requieren corte)
-- =====================================================

CREATE TABLE preparation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES order_lines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_requested INTEGER NOT NULL,
  quantity_prepared INTEGER DEFAULT 0,
  assigned_inventory_id UUID REFERENCES inventory(id),
  assigned_to UUID REFERENCES users(id),
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX idx_preparation_items_order ON preparation_items(order_id);
CREATE INDEX idx_preparation_items_status ON preparation_items(status);
CREATE INDEX idx_preparation_items_assigned ON preparation_items(assigned_to);
CREATE INDEX idx_preparation_items_product ON preparation_items(product_id);

-- Comentarios
COMMENT ON TABLE preparation_items IS 'Artículos a preparar que no requieren corte (productos no-chapas)';
COMMENT ON COLUMN preparation_items.quantity_requested IS 'Cantidad total solicitada';
COMMENT ON COLUMN preparation_items.quantity_prepared IS 'Cantidad ya preparada por el operario';
COMMENT ON COLUMN preparation_items.assigned_inventory_id IS 'ID del inventario asignado para este artículo';
COMMENT ON COLUMN preparation_items.status IS 'Estado: pendiente, en_proceso, completada';
