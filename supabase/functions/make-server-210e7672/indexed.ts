import { createClient } from '@supabase/supabase-js';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  variants: any[];
  supplier: string;
  category: string;
  validityDate?: string;
  tenant_id: string;
}

interface Sale {
  id: string;
  date: string;
  items: any[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  employeeId: string;
  customerId?: string;
  tenant_id: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  debtBalance: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  tenant_id: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  commission: number;
  totalSales: number;
  shifts: any[];
  tenant_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/make-server-210e7672', '');

    // Set tenant context for RLS
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant context
    const { data: tenantData, error: tenantError } = await supabaseClient
      .rpc('get_current_user_tenant');

    if (tenantError || !tenantData || tenantData.length === 0) {
      throw new Error('User is not associated with any tenant');
    }

    const tenantId = tenantData[0].tenant_id;
    const userRole = tenantData[0].user_role;

    // Set tenant context for RLS
    await supabaseClient.rpc('set_tenant_context', { tenant_id: tenantId });

    // Handle different endpoints
    if (path === '/products' && req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return new Response(JSON.stringify({ products: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/products' && req.method === 'POST') {
      const product = await req.json();
      const { data, error } = await supabaseClient
        .from('products')
        .insert({ ...product, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ product: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/products/') && req.method === 'PUT') {
      const productId = path.split('/')[3];
      const updates = await req.json();
      const { data, error } = await supabaseClient
        .from('products')
        .update(updates)
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ product: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/products/') && req.method === 'DELETE') {
      const productId = path.split('/')[3];
      const { error } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/sales' && req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return new Response(JSON.stringify({ sales: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/sales' && req.method === 'POST') {
      const sale = await req.json();
      const { data, error } = await supabaseClient
        .from('sales')
        .insert({ ...sale, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ sale: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/customers' && req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return new Response(JSON.stringify({ customers: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/customers' && req.method === 'POST') {
      const customer = await req.json();
      const { data, error } = await supabaseClient
        .from('customers')
        .insert({ ...customer, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ customer: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/employees' && req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return new Response(JSON.stringify({ employees: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/employees' && req.method === 'POST') {
      const employee = await req.json();
      const { data, error } = await supabaseClient
        .from('employees')
        .insert({ ...employee, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ employee: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/init-demo' && req.method === 'POST') {
      // Initialize demo data for the tenant if needed
      const { data: existingProducts } = await supabaseClient
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (!existingProducts || existingProducts.length === 0) {
        // Create demo products
        const demoProducts = [
          {
            name: 'Demo Product 1',
            barcode: '123456789',
            sku: 'DEMO-001',
            variants: [{
              id: crypto.randomUUID(),
              attributes: { size: 'M', color: 'Blue' },
              cost: 10.00,
              costHistory: [],
              price: 20.00,
              stock: 100,
              reorderLevel: 10
            }],
            supplier: 'Demo Supplier',
            category: 'Demo Category',
            tenant_id: tenantId
          }
        ];

        await supabaseClient.from('products').insert(demoProducts);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
