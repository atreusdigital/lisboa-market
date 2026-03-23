-- ============================================================
-- MÓDULO: Turnos, Cierre de Caja, Gastos, Historial de Precios
-- ============================================================

-- Turnos por empleado
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(10,2) DEFAULT 0,
  closing_cash NUMERIC(10,2),
  total_sales NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_read" ON shifts FOR SELECT USING (get_user_role() = 'director' OR branch_id = get_user_branch());
CREATE POLICY "shifts_insert" ON shifts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "shifts_update" ON shifts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Cierre de caja diario
CREATE TABLE IF NOT EXISTS cash_closings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  shift_id UUID REFERENCES shifts(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  difference NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings_read" ON cash_closings FOR SELECT USING (get_user_role() = 'director' OR branch_id = get_user_branch());
CREATE POLICY "closings_insert" ON cash_closings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Gastos operativos
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('electricidad','limpieza','delivery','sueldo','mantenimiento','marketing','otros')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_read" ON expenses FOR SELECT USING (get_user_role() = 'director' OR branch_id = get_user_branch());
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (user_id = auth.uid() OR get_user_role() IN ('director','admin'));

-- Historial de precios
CREATE TABLE IF NOT EXISTS price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  old_cost_price NUMERIC(10,2),
  new_cost_price NUMERIC(10,2),
  old_sell_price NUMERIC(10,2),
  new_sell_price NUMERIC(10,2),
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_read" ON price_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "price_history_insert" ON price_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Precio por bulto en productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_quantity INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_cost NUMERIC(10,2);
