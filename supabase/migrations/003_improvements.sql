-- Tabla de movimientos de stock
CREATE TABLE stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'manual_up', 'manual_down', 'sale')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_read" ON stock_movements FOR SELECT USING (
  get_user_role() = 'director' OR branch_id = get_user_branch()
);
CREATE POLICY "movements_insert" ON stock_movements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Soporte para múltiples sucursales por usuario
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}';
