-- Familias de productos
CREATE TABLE product_families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#1C2B23',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "families_read" ON product_families FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "families_write" ON product_families FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- FK en products
ALTER TABLE products ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES product_families(id) ON DELETE SET NULL;

-- Columnas de tracking de precios
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_price_updated_at TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sell_price_updated_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_updated_at TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_updated_by TEXT DEFAULT NULL;

-- Promociones
CREATE TABLE promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('tiered_discount', 'nx_for_y')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  rules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_read" ON promotions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "promotions_write" ON promotions FOR ALL USING (get_user_role() IN ('director', 'admin'));

-- Relación promociones <-> productos
CREATE TABLE promotion_products (
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (promotion_id, product_id)
);

ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_products_read" ON promotion_products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "promo_products_write" ON promotion_products FOR ALL USING (get_user_role() IN ('director', 'admin'));
