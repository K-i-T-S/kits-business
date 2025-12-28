import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.ts';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Add cache control headers for API responses
app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
});

// Initialize Supabase client (service role for server-side ops)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Initialize Supabase client for user authentication (anon key)
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Helper function to verify user from Authorization header
async function verifyUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken);
  if (error || !user) {
    console.log('Verify user error:', error);
    return null;
  }
  return user;
}

// ======================
// Authentication Routes
// ======================

app.post('/make-server-210e7672/auth/signup', async (c) => {
  try {
    const { email, password, name, role = 'cashier', commission = 3 } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, commission },
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    const employee = {
      id: data.user.id,
      name,
      email,
      role,
      commission,
      totalSales: 0,
      shifts: []
    };

    await kv.set(`employee:${data.user.id}`, employee);

    return c.json({ user: data.user, employee });
  } catch (error) {
    console.log('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

app.get('/make-server-210e7672/auth/session', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const employee = await kv.get(`employee:${user.id}`);
    
    return c.json({ user, employee });
  } catch (error) {
    console.log('Session error:', error);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

// ======================
// Product Routes
// ======================

app.get('/make-server-210e7672/test', async (c) => {
  return c.json({ message: 'Function is working!', timestamp: new Date().toISOString() });
});

app.get('/make-server-210e7672/products', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      // For debugging: return all products
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('*');
      
      if (allError) {
        return c.json({ error: allError.message }, 500);
      }
      
      return c.json({ products: allProducts || [] });
    }

    // Get products from database filtered by tenant
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantUser.tenant_id)
      .eq('is_active', true);

    if (productsError) {
      return c.json({ error: productsError.message }, 500);
    }

    return c.json({ products: products || [] });
  } catch (error) {
    console.log('Get products error:', error);
    return c.json({ error: 'Failed to get products' }, 500);
  }
});

app.post('/make-server-210e7672/products', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const product = await c.req.json();
    
    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      return c.json({ error: 'User not associated with any tenant' }, 403);
    }

    // Insert product into database with tenant_id
    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: product.description || null,
        price: product.variants?.[0]?.price || 0,
        cost: product.variants?.[0]?.cost || 0,
        sku: product.sku || null,
        barcode: product.barcode || null,
        category: product.category || null,
        stock_quantity: product.variants?.[0]?.stock || 0,
        min_stock_level: product.variants?.[0]?.reorderLevel || 0,
        is_active: true,
        tenant_id: tenantUser.tenant_id,
        // Store variants as JSONB for now
        variants: product.variants || [],
        supplier: product.supplier || null,
        validity_date: product.validityDate || null
      })
      .select()
      .single();

    if (insertError) {
      return c.json({ error: insertError.message }, 500);
    }

    return c.json({ product: newProduct });
  } catch (error) {
    console.log('Create product error:', error);
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

app.put('/make-server-210e7672/products/:id', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const updates = await c.req.json();

    const existing = await kv.get(`product:${id}`);
    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const product = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`product:${id}`, product);

    return c.json({ product });
  } catch (error) {
    console.log('Update product error:', error);
    return c.json({ error: 'Failed to update product' }, 500);
  }
});

app.delete('/make-server-210e7672/products/:id', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    await kv.del(`product:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log('Delete product error:', error);
    return c.json({ error: 'Failed to delete product' }, 500);
  }
});

app.post('/make-server-210e7672/products/:productId/variants/:variantId/stock', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const productId = c.req.param('productId');
    const variantId = c.req.param('variantId');
    const { quantity } = await c.req.json();

    // Update product variant stock in database
    console.log('Looking for product:', productId, 'for tenant:', user.tenant_id);
    const { data: product, error } = await supabase
      .from('products')
      .select('variants, id, name')
      .eq('id', productId)
      .eq('tenant_id', user.tenant_id)
      .single();

    console.log('Product query result:', { data: product, error });

    if (error || !product) {
      console.log('Product not found details:', { productId, tenant_id: user.tenant_id, error });
      return c.json({ error: 'Product not found' }, 404);
    }

    // Update the specific variant's stock
    const updatedVariants = product.variants.map((variant: any) => {
      if (variant.id === variantId) {
        return {
          ...variant,
          stock: Math.max(0, variant.stock + quantity) // Ensure stock doesn't go negative
        };
      }
      return variant;
    });

    // Save updated variants back to database
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({ 
        variants: updatedVariants,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.log('Update stock error:', updateError);
      return c.json({ error: 'Failed to update stock' }, 500);
    }

    return c.json({ product: updatedProduct });
  } catch (error) {
    console.log('Update stock error:', error);
    return c.json({ error: 'Failed to update stock' }, 500);
  }
});

// ======================
// Sales Routes
// ======================

app.get('/make-server-210e7672/sales', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      return c.json({ error: 'User not associated with any tenant' }, 403);
    }

    // Get sales from database filtered by tenant
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantUser.tenant_id);

    if (salesError) {
      console.log('Get sales error:', salesError);
      return c.json({ error: salesError.message }, 500);
    }

    return c.json({ sales: sales || [] });
  } catch (error) {
    console.log('Get sales error:', error);
    return c.json({ error: 'Failed to get sales' }, 500);
  }
});

app.post('/make-server-210e7672/sales', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      return c.json({ error: 'User not associated with any tenant' }, 403);
    }

    // Find the employee record for this user
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantUser.tenant_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (employeeError || !employee) {
      return c.json({ error: 'No active employee found for user' }, 403);
    }

    const sale = await c.req.json();
    
    // Map frontend sale data to database schema
    const dbSale = {
      id: crypto.randomUUID(), // Always generate a proper UUID
      customer_id: sale.customerId || null,
      employee_id: employee.id, // Use the found employee ID
      sale_date: new Date().toISOString(),
      subtotal: sale.subtotal || 0,
      tax_amount: sale.tax || 0,
      total_amount: sale.total || 0,
      payment_method: sale.paymentMethod || 'cash',
      payment_status: 'completed',
      notes: sale.notes || null,
      tenant_id: tenantUser.tenant_id
    };

    // Update product stock in database for each sale item
    for (const item of sale.items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('variants')
        .eq('id', item.productId)
        .eq('tenant_id', tenantUser.tenant_id)
        .single();

      if (!productError && product) {
        // Update the specific variant's stock
        const updatedVariants = product.variants.map((variant: any) => {
          if (variant.id === item.variantId) {
            return {
              ...variant,
              stock: Math.max(0, variant.stock - item.quantity) // Ensure stock doesn't go negative
            };
          }
          return variant;
        });

        // Save updated variants back to database
        await supabase
          .from('products')
          .update({ 
            variants: updatedVariants,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId)
          .eq('tenant_id', tenantUser.tenant_id);
      }
    }

    // Insert sale into database
    const { data: newSale, error: insertError } = await supabase
      .from('sales')
      .insert([dbSale])
      .select()
      .single();

    if (insertError) {
      console.log('Create sale error:', insertError);
      return c.json({ error: insertError.message }, 500);
    }

    // Update customer if specified
    if (sale.customerId) {
      await supabase
        .from('customers')
        .update({ 
          total_purchases: supabase.raw('total_purchases + ?', [sale.total]),
          last_visit: new Date().toISOString()
        })
        .eq('id', sale.customerId)
        .eq('tenant_id', tenantUser.tenant_id);
    }

    return c.json({ sale: newSale });
  } catch (error) {
    console.log('Create sale error:', error);
    return c.json({ error: 'Failed to create sale' }, 500);
  }
});

// ======================
// Customer Routes
// ======================

app.get('/make-server-210e7672/customers', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      return c.json({ error: 'User not associated with any tenant' }, 403);
    }

    // Get customers from database filtered by tenant
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantUser.tenant_id);

    if (customersError) {
      console.log('Get customers error:', customersError);
      return c.json({ error: customersError.message }, 500);
    }

    return c.json({ customers: customers || [] });
  } catch (error) {
    console.log('Get customers error:', error);
    return c.json({ error: 'Failed to get customers' }, 500);
  }
});

app.post('/make-server-210e7672/customers', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const customer = await c.req.json();
    customer.id = customer.id || Date.now().toString();
    customer.createdAt = new Date().toISOString();

    await kv.set(`customer:${customer.id}`, customer);

    return c.json({ customer });
  } catch (error) {
    console.log('Create customer error:', error);
    return c.json({ error: 'Failed to create customer' }, 500);
  }
});

app.put('/make-server-210e7672/customers/:id', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const updates = await c.req.json();

    const existing = await kv.get(`customer:${id}`);
    if (!existing) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const customer = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`customer:${id}`, customer);

    return c.json({ customer });
  } catch (error) {
    console.log('Update customer error:', error);
    return c.json({ error: 'Failed to update customer' }, 500);
  }
});

// ======================
// Employee Routes
// ======================

app.get('/make-server-210e7672/employees', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (tenantError || !tenantUser) {
      return c.json({ error: 'User not associated with any tenant' }, 403);
    }

    // Get employees from database filtered by tenant
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantUser.tenant_id);

    if (employeesError) {
      console.log('Get employees error:', employeesError);
      return c.json({ error: employeesError.message }, 500);
    }

    return c.json({ employees: employees || [] });
  } catch (error) {
    console.log('Get employees error:', error);
    return c.json({ error: 'Failed to get employees' }, 500);
  }
});

app.post('/make-server-210e7672/employees', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, email, role, commission, password } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, commission },
      email_confirm: true
    });

    if (error) {
      console.log('Create employee error:', error);
      return c.json({ error: error.message }, 400);
    }

    const employee = {
      id: data.user.id,
      name,
      email,
      role,
      commission,
      totalSales: 0,
      shifts: [],
      createdAt: new Date().toISOString()
    };

    await kv.set(`employee:${data.user.id}`, employee);

    return c.json({ employee });
  } catch (error) {
    console.log('Create employee error:', error);
    return c.json({ error: 'Failed to create employee' }, 500);
  }
});

app.put('/make-server-210e7672/employees/:id', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const updates = await c.req.json();

    const existing = await kv.get(`employee:${id}`);
    if (!existing) {
      return c.json({ error: 'Employee not found' }, 404);
    }

    const employee = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`employee:${id}`, employee);

    return c.json({ employee });
  } catch (error) {
    console.log('Update employee error:', error);
    return c.json({ error: 'Failed to update employee' }, 500);
  }
});

// ======================
// Initialize Demo Data
// ======================

app.post('/make-server-210e7672/init-demo', async (c) => {
  try {
    const existing = await kv.get('demo:initialized');
    if (existing) {
      return c.json({ message: 'Demo data already initialized' });
    }

    const demoProducts = [
      {
        id: '1',
        name: 'Premium Coffee Beans',
        barcode: '1234567890123',
        sku: 'COF-001',
        category: 'Beverages',
        supplier: 'Global Coffee Importers',
        validityDate: '2025-12-31',
        variants: [
          {
            id: '1-1',
            attributes: { size: '250g', type: 'Arabica' },
            cost: 8.5,
            costHistory: [
              { date: '2024-01-15', cost: 8.0, quantity: 100 },
              { date: '2024-06-20', cost: 8.5, quantity: 150 }
            ],
            price: 15.99,
            stock: 45,
            reorderLevel: 20
          },
          {
            id: '1-2',
            attributes: { size: '500g', type: 'Arabica' },
            cost: 15.0,
            costHistory: [
              { date: '2024-01-15', cost: 14.5, quantity: 80 },
              { date: '2024-06-20', cost: 15.0, quantity: 120 }
            ],
            price: 28.99,
            stock: 32,
            reorderLevel: 15
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Organic Green Tea',
        barcode: '1234567890124',
        sku: 'TEA-001',
        category: 'Beverages',
        supplier: 'Tea Masters Ltd',
        validityDate: '2026-03-15',
        variants: [
          {
            id: '2-1',
            attributes: { size: '100g', type: 'Sencha' },
            cost: 6.0,
            costHistory: [
              { date: '2024-02-10', cost: 5.8, quantity: 60 },
              { date: '2024-08-15', cost: 6.0, quantity: 90 }
            ],
            price: 11.99,
            stock: 28,
            reorderLevel: 15
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const product of demoProducts) {
      await kv.set(`product:${product.id}`, product);
    }

    const demoCustomers = [
      {
        id: '1',
        name: 'John Smith',
        phone: '+1234567890',
        debtBalance: 0,
        totalPurchases: 485.5,
        lastPurchaseDate: '2024-12-20',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        phone: '+1234567891',
        debtBalance: 25.0,
        totalPurchases: 1250.75,
        lastPurchaseDate: '2024-12-18',
        createdAt: new Date().toISOString()
      }
    ];

    for (const customer of demoCustomers) {
      await kv.set(`customer:${customer.id}`, customer);
    }

    await kv.set('demo:initialized', true);

    return c.json({ message: 'Demo data initialized successfully' });
  } catch (error) {
    console.log('Init demo error:', error);
    return c.json({ error: 'Failed to initialize demo data' }, 500);
  }
});

Deno.serve(app.fetch);
