-- ================================================
-- LISBOA MARKET — Schema inicial
-- ================================================

-- Sucursales
CREATE TABLE branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfiles de usuario (extiende auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'admin', 'empleado')),
  branch_id UUID REFERENCES branches(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  barcode TEXT UNIQUE,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sell_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock por sucursal
CREATE TABLE stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- Ventas
CREATE TABLE sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mercadopago', 'efectivo')),
  mp_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de venta
CREATE TABLE sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL
);

-- Proveedores
CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos a proveedores
CREATE TABLE supplier_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'confirmed', 'cancelled')),
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de pedido
CREATE TABLE supplier_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES supplier_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Cuentas corrientes con proveedores
CREATE TABLE accounts_payable (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, branch_id)
);

-- Pagos a proveedores
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts_payable(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'transferencia',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  notes TEXT,
  confirmed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'high_demand_low_stock', 'stagnant_product', 'payment_due', 'cash_anomaly')),
  product_id UUID REFERENCES products(id),
  branch_id UUID REFERENCES branches(id) NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Historial de actividad
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper: obtener sucursal del usuario
CREATE OR REPLACE FUNCTION get_user_branch()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Branches: todos pueden leer
CREATE POLICY "branches_read" ON branches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "branches_write" ON branches FOR ALL USING (get_user_role() = 'director');

-- Profiles: pueden leer todos, modificar directores o uno mismo
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_director" ON profiles FOR ALL USING (get_user_role() = 'director');

-- Products: todos leen, admin y director modifican
CREATE POLICY "products_read" ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_write" ON products FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- Stock: todos leen, admin y director modifican
CREATE POLICY "stock_read" ON stock FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_write" ON stock FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- Sales: empleados de su sucursal, admin de su sucursal, directores todo
CREATE POLICY "sales_read" ON sales FOR SELECT USING (
  get_user_role() = 'director' OR branch_id = get_user_branch()
);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (
  branch_id = get_user_branch() OR get_user_role() = 'director'
);

-- Sale items: heredan de sales
CREATE POLICY "sale_items_read" ON sale_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Suppliers: todos leen, admin y director modifican
CREATE POLICY "suppliers_read" ON suppliers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_write" ON suppliers FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- Supplier orders: por sucursal
CREATE POLICY "orders_read" ON supplier_orders FOR SELECT USING (
  get_user_role() = 'director' OR branch_id = get_user_branch()
);
CREATE POLICY "orders_write" ON supplier_orders FOR ALL USING (
  get_user_role() IN ('director', 'admin') AND (branch_id = get_user_branch() OR get_user_role() = 'director')
);

-- Order items
CREATE POLICY "order_items_read" ON supplier_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "order_items_write" ON supplier_order_items FOR ALL USING (
  get_user_role() IN ('director', 'admin')
);

-- Accounts payable
CREATE POLICY "accounts_read" ON accounts_payable FOR SELECT USING (
  get_user_role() = 'director' OR branch_id = get_user_branch()
);
CREATE POLICY "accounts_write" ON accounts_payable FOR ALL USING (
  get_user_role() IN ('director', 'admin')
);

-- Payments
CREATE POLICY "payments_read" ON payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_write" ON payments FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- Alerts
CREATE POLICY "alerts_read" ON alerts FOR SELECT USING (
  get_user_role() = 'director' OR branch_id = get_user_branch()
);
CREATE POLICY "alerts_write" ON alerts FOR ALL USING (
  get_user_role() IN ('director', 'admin')
);

-- Activity log
CREATE POLICY "activity_read" ON activity_log FOR SELECT USING (
  get_user_role() IN ('director', 'admin') OR user_id = auth.uid()
);
CREATE POLICY "activity_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================
-- DATOS INICIALES
-- ================================================

INSERT INTO branches (id, name, address) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Caballito', 'Av. Rivadavia 5200, Caballito, CABA'),
  ('b2000000-0000-0000-0000-000000000002', 'Villa Luro', 'Av. General Paz 1200, Villa Luro, CABA');

INSERT INTO suppliers (name, contact_name) VALUES
  ('Golomax', NULL),
  ('Salor', NULL),
  ('Vital', NULL),
  ('Quilmes', NULL),
  ('Coca Cola', NULL);

-- Cuentas corrientes iniciales (saldo 0)
INSERT INTO accounts_payable (supplier_id, branch_id, balance)
SELECT s.id, b.id, 0
FROM suppliers s
CROSS JOIN branches b;
