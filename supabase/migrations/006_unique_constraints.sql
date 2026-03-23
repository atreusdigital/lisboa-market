-- Required for batch upsert by name (products without barcode)
ALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE (name);

-- Required for batch upsert of stock by product+branch
ALTER TABLE stock ADD CONSTRAINT stock_product_branch_unique UNIQUE (product_id, branch_id);
