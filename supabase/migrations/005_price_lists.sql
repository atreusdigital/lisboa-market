-- Add new price list columns and subcategory to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedidos_ya_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rappi_price DECIMAL(10,2) NOT NULL DEFAULT 0;
