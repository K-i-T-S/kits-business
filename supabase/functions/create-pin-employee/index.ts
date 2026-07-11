import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Track 1c (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
// creates a real per-employee Supabase Auth account for PIN-based staff
// login. The PIN is the literal account password (Option B, founder-
// approved) — verified natively via signInWithPassword() client-side,
// no custom token-minting needed here. This function only ever runs
// once per employee (account creation); the PIN sign-in itself happens
// entirely client-side against Supabase's own auth endpoint.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_STANDARD_ROLES = [
  'owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'stockkeeper', 'viewer',
];

function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { name, role, customRoleId, pin, tenantId } = await req.json() as {
      name: string;
      role: string;
      customRoleId?: string | null;
      pin: string;
      tenantId: string;
    };

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isValidPin(pin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 4-6 digits' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!VALID_STANDARD_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is owner/manager/admin of this tenant. Checks the raw
    // tenant_users.role directly (same pattern as send-invitation), but
    // explicitly includes 'admin' here — unlike send-invitation's existing
    // check, which bypasses current_user_role()'s admin->owner aliasing
    // and was found (not fixed) to lock out platform-admins earlier this
    // session. New code shouldn't repeat a known bug.
    const { data: membership, error: memberErr } = await adminClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', caller.id)
      .single();

    if (memberErr || !membership || !['owner', 'manager', 'admin'].includes(membership.role as string)) {
      return new Response(JSON.stringify({ error: 'Forbidden: not a tenant owner, manager, or admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Synthetic email — this account is never emailed, never used for
    // password recovery via email; it exists purely to give Supabase Auth
    // a real user record with a real (weak-by-design, PIN-length) password.
    const syntheticEmail = `pin-${crypto.randomUUID()}@pin.kits.internal`;

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { is_pin_employee: true, display_name: name.trim(), tenant_id: tenantId },
    });

    if (createErr || !created.user) {
      throw createErr ?? new Error('Failed to create PIN employee account');
    }

    const newUserId = created.user.id;

    const { error: tuErr } = await adminClient.from('tenant_users').insert({
      tenant_id: tenantId,
      user_id: newUserId,
      role,
      custom_role_id: customRoleId ?? null,
    });
    if (tuErr) throw tuErr;

    const { error: uatErr } = await adminClient.from('user_active_tenant').upsert({
      user_id: newUserId,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    });
    if (uatErr) throw uatErr;

    // employees.email stores the synthetic sign-in email for PIN staff
    // (who by definition often don't have a real contact email) — the
    // lock-screen roster needs this to call signInWithPassword() without
    // a separate lookup, since auth.users isn't directly queryable from
    // the client.
    const { error: empErr } = await adminClient.from('employees').insert({
      tenant_id: tenantId,
      user_id: newUserId,
      name: name.trim(),
      email: syntheticEmail,
      role,
      commission_rate: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    if (empErr) throw empErr;

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-pin-employee error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
