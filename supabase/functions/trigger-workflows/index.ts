import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  trigger_type: string;
  tenant_id: string;
}

interface TenantRow {
  id: string;
  name: string;
  owner_phone?: string | null;
}

interface SaleRow {
  id: string;
  total: number;
}

interface SaleItemRow {
  product_id: string;
  quantity: number;
  products?: { name: string } | null;
}

interface ProductRow {
  id: string;
  name: string;
  stock_quantity: number;
  reorder_point: number;
}

interface WorkflowRow {
  id: string;
  tenant_id: string;
  trigger_type: string;
  is_active: boolean;
}

// ── WhatsApp helper ───────────────────────────────────────────────────────────

async function sendWhatsApp(
  phoneId: string,
  token: string,
  to: string,
  body: string,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\s/g, ''),
        type: 'text',
        text: { body },
      }),
    },
  );
  if (!res.ok) {
    const err: unknown = await res.json();
    console.error('[trigger-workflows] WhatsApp API error:', JSON.stringify(err));
  }
}

// ── Workflow handlers ─────────────────────────────────────────────────────────

async function runDailySummary(
  db: ReturnType<typeof createClient>,
  tenantId: string,
  waToken: string | null,
  waPhoneId: string | null,
): Promise<void> {
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, owner_phone')
    .eq('id', tenantId)
    .single<TenantRow>();

  if (!tenant) {
    console.warn('[trigger-workflows] daily_summary: tenant not found', tenantId);
    return;
  }

  // Today's date boundaries (UTC)
  const today = new Date();
  const startOfDay = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  ).toISOString();
  const endOfDay = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
  ).toISOString();

  const { data: sales } = await db
    .from('sales')
    .select('id, total')
    .eq('tenant_id', tenantId)
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay)
    .returns<SaleRow[]>();

  const salesRows = sales ?? [];
  const totalRevenue = salesRows.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const transactionCount = salesRows.length;

  // Find top product by quantity sold today
  let topProductName = 'N/A';
  let topProductQty = 0;

  if (salesRows.length > 0) {
    const saleIds = salesRows.map(s => s.id);
    const { data: saleItems } = await db
      .from('sale_items')
      .select('product_id, quantity, products(name)')
      .in('sale_id', saleIds)
      .returns<SaleItemRow[]>();

    if (saleItems && saleItems.length > 0) {
      const qtyByProduct = new Map<string, { name: string; qty: number }>();
      for (const item of saleItems) {
        const existing = qtyByProduct.get(item.product_id);
        const name = item.products?.name ?? item.product_id;
        if (existing) {
          existing.qty += item.quantity;
        } else {
          qtyByProduct.set(item.product_id, { name, qty: item.quantity });
        }
      }
      for (const [, val] of qtyByProduct) {
        if (val.qty > topProductQty) {
          topProductQty = val.qty;
          topProductName = val.name;
        }
      }
    }
  }

  const dateStr = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const message = [
    `📊 *Daily Sales Summary — ${tenant.name}*`,
    `📅 ${dateStr}`,
    '',
    `💰 Revenue: $${totalRevenue.toFixed(2)}`,
    `🧾 Transactions: ${transactionCount}`,
    `🏆 Top Product: ${topProductName}${topProductQty > 0 ? ` (${topProductQty} sold)` : ''}`,
    '',
    'Powered by KiTS Business',
  ].join('\n');

  if (waToken && waPhoneId && tenant.owner_phone) {
    await sendWhatsApp(waPhoneId, waToken, tenant.owner_phone, message);
  } else {
    console.log(
      '[trigger-workflows] WhatsApp not configured or no owner_phone — skipping send.',
      '\nMessage preview:\n',
      message,
    );
  }
}

async function runLowStockAlert(
  db: ReturnType<typeof createClient>,
  tenantId: string,
  waToken: string | null,
  waPhoneId: string | null,
): Promise<void> {
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, owner_phone')
    .eq('id', tenantId)
    .single<TenantRow>();

  if (!tenant) {
    console.warn('[trigger-workflows] low_stock_alert: tenant not found', tenantId);
    return;
  }

  const { data: products } = await db
    .from('products')
    .select('id, name, stock_quantity, reorder_point')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gt('reorder_point', 0)
    .returns<ProductRow[]>();

  const lowStock = (products ?? []).filter(
    (p) => p.stock_quantity <= p.reorder_point,
  );

  if (lowStock.length === 0) {
    console.log('[trigger-workflows] low_stock_alert: no low-stock products for tenant', tenantId);
    return;
  }

  const productLines = lowStock
    .map(p => `• ${p.name}: ${p.stock_quantity} remaining (reorder at ${p.reorder_point})`)
    .join('\n');

  const message = [
    `⚠️ *Low Stock Alert — ${tenant.name}*`,
    '',
    'The following products need restocking:',
    productLines,
    '',
    'Please reorder soon to avoid stockouts.',
  ].join('\n');

  if (waToken && waPhoneId && tenant.owner_phone) {
    await sendWhatsApp(waPhoneId, waToken, tenant.owner_phone, message);
  } else {
    console.log(
      '[trigger-workflows] WhatsApp not configured or no owner_phone — skipping send.',
      '\nMessage preview:\n',
      message,
    );
  }
}

// ── Scheduled run helper ──────────────────────────────────────────────────────

async function runAllActiveWorkflows(
  db: ReturnType<typeof createClient>,
  waToken: string | null,
  waPhoneId: string | null,
): Promise<number> {
  const { data: workflows } = await db
    .from('automated_workflows')
    .select('id, tenant_id, trigger_type, is_active')
    .eq('is_active', true)
    .returns<WorkflowRow[]>();

  let processed = 0;

  for (const wf of workflows ?? []) {
    if (wf.trigger_type === 'daily_summary') {
      await runDailySummary(db, wf.tenant_id, waToken, waPhoneId);
      processed++;
    } else if (wf.trigger_type === 'low_stock_alert') {
      await runLowStockAlert(db, wf.tenant_id, waToken, waPhoneId);
      processed++;
    }

    await db
      .from('automated_workflows')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', wf.id);
  }

  return processed;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const waToken = Deno.env.get('WHATSAPP_TOKEN') ?? null;
  const waPhoneId = Deno.env.get('WHATSAPP_PHONE_ID') ?? null;

  if (!waToken || !waPhoneId) {
    console.log(
      '[trigger-workflows] WhatsApp not configured — WHATSAPP_TOKEN or WHATSAPP_PHONE_ID missing. Messages will be logged only.',
    );
  }

  const db = createClient(supabaseUrl, serviceKey);

  let body: Partial<RequestBody> = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as Partial<RequestBody>;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    if (body.trigger_type && body.tenant_id) {
      // ── Single tenant / specific trigger (called from UI) ─────────────────
      const { trigger_type, tenant_id } = body as RequestBody;

      if (trigger_type === 'daily_summary') {
        await runDailySummary(db, tenant_id, waToken, waPhoneId);
      } else if (trigger_type === 'low_stock_alert') {
        await runLowStockAlert(db, tenant_id, waToken, waPhoneId);
      } else {
        return new Response(
          JSON.stringify({ error: `Unknown trigger_type: ${trigger_type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Best-effort: update last_run_at + run_count for the matching workflow
      await db
        .from('automated_workflows')
        .update({ last_run_at: new Date().toISOString() })
        .eq('tenant_id', tenant_id)
        .eq('trigger_type', trigger_type)
        .eq('is_active', true);

      // Increment run_count with a raw SQL expression
      await db.rpc('increment_workflow_run_count', {
        p_tenant_id: tenant_id,
        p_trigger_type: trigger_type,
      });

      return new Response(
        JSON.stringify({ success: true, processed: 1 }),
        { headers: { 'Content-Type': 'application/json' } },
      );

    } else {
      // ── Scheduled run: all active workflows, all tenants ──────────────────
      const processed = await runAllActiveWorkflows(db, waToken, waPhoneId);
      return new Response(
        JSON.stringify({ success: true, processed }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[trigger-workflows] Unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
