-- Add missing columns to products table for frontend compatibility
-- This migration adds support for variants, supplier, and validity_date

-- Add JSONB column for variants
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';

-- Add supplier column
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier TEXT;

-- Add validity_date column
ALTER TABLE products ADD COLUMN IF NOT EXISTS validity_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);
CREATE INDEX IF NOT EXISTS idx_products_validity_date ON products(validity_date);

-- Add comment for documentation
COMMENT ON COLUMN products.variants IS 'JSON array of product variants with attributes, pricing, and stock information';
COMMENT ON COLUMN products.supplier IS 'Product supplier name';
COMMENT ON COLUMN products.validity_date IS 'Product expiration date';
