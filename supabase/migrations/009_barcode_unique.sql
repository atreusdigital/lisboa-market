-- UNIQUE index on barcode (only for non-null values, so multiple NULL barcodes are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products(barcode) WHERE barcode IS NOT NULL;
