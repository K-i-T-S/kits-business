import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.ts';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Initialize Supabase client (service role for server-side ops)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Helper function to verify user from Authorization header
async function verifyUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
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

app.get('/make-server-210e7672/products', async (c) => {
  try {
    const user = await verifyUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const products = await kv.getByPrefix('product:');
    return c.json({ products });
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
    product.id = product.id || Date.now().toString();
    product.createdAt = new Date().toISOString();
    product.updatedAt = new Date().toISOString();

    await kv.set(`product:${product.id}`, product);

    return c.json({ product });
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

    const product = await kv.get(`product:${productId}`);
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    product.variants = product.variants.map((variant: any) => {
      if (variant.id === variantId) {
        return {
          ...variant,
          stock: variant.stock + quantity
        };
      }
      return variant;
    });

    product.updatedAt = new Date().toISOString();
    await kv.set(`product:${productId}`, product);

    return c.json({ product });
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

    const sales = await kv.getByPrefix('sale:');
    return c.json({ sales });
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

    const sale = await c.req.json();
    sale.id = sale.id || Date.now().toString();
    sale.date = new Date().toISOString();
    sale.employeeId = user.id;

    for (const item of sale.items) {
      const product = await kv.get(`product:${item.productId}`);
      if (product) {
        product.variants = product.variants.map((variant: any) => {
          if (variant.id === item.variantId) {
            return {
              ...variant,
              stock: variant.stock - item.quantity
            };
          }
          return variant;
        });
        product.updatedAt = new Date().toISOString();
        await kv.set(`product:${item.productId}`, product);
      }
    }

    const employee = await kv.get(`employee:${user.id}`);
    if (employee) {
      employee.totalSales = (employee.totalSales || 0) + sale.total;
      await kv.set(`employee:${user.id}`, employee);
    }

    if (sale.customerId) {
      const customer = await kv.get(`customer:${sale.customerId}`);
      if (customer) {
        customer.totalPurchases = (customer.totalPurchases || 0) + sale.total;
        customer.lastPurchaseDate = sale.date;
        await kv.set(`customer:${sale.customerId}`, customer);
      }
    }

    await kv.set(`sale:${sale.id}`, sale);

    return c.json({ sale });
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

    const customers = await kv.getByPrefix('customer:');
    return c.json({ customers });
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

    const employees = await kv.getByPrefix('employee:');
    return c.json({ employees });
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
