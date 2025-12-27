import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addProductColumns() {
  try {
    console.log('Adding variants column...');
    await supabase.rpc('exec_sql', { sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT \'[]\';' });
    
    console.log('Adding supplier column...');
    await supabase.rpc('exec_sql', { sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier TEXT;' });
    
    console.log('Adding validity_date column...');
    await supabase.rpc('exec_sql', { sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS validity_date TIMESTAMP WITH TIME ZONE;' });
    
    console.log('Creating indexes...');
    await supabase.rpc('exec_sql', { sql: 'CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);' });
    await supabase.rpc('exec_sql', { sql: 'CREATE INDEX IF NOT EXISTS idx_products_validity_date ON products(validity_date);' });
    
    console.log('Columns added successfully!');
  } catch (error) {
    console.error('Error adding columns:', error);
  }
}

addProductColumns();
