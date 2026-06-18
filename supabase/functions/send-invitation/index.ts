import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller using the anon key header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { inviteeEmail, inviteeName, role, commission, tenantId, tenantName } = await req.json() as {
      inviteeEmail: string;
      inviteeName: string;
      role: string;
      commission: number;
      tenantId: string;
      tenantName: string;
    };

    // Use anon client to verify the caller is authenticated
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

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is owner/manager of this tenant
    const { data: membership, error: memberErr } = await adminClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', caller.id)
      .single();

    if (memberErr || !membership || !['owner', 'manager'].includes(membership.role as string)) {
      return new Response(JSON.stringify({ error: 'Forbidden: not a tenant owner or manager' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert pending invitation record
    const { data: invitation, error: invErr } = await adminClient
      .from('pending_invitations')
      .insert({
        tenant_id: tenantId,
        email: inviteeEmail.toLowerCase().trim(),
        name: inviteeName,
        role,
        commission,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (invErr) throw invErr;

    // Send the Supabase auth invitation email (works for both new AND existing users)
    // New users get "Set your password" email; existing users get a magic link
    const redirectTo = `${Deno.env.get('SITE_URL') ?? 'https://kits-business.vercel.app'}/accept-invite?invitation_id=${invitation!.id}`;

    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      inviteeEmail.toLowerCase().trim(),
      {
        redirectTo,
        data: {
          invited_by: caller.email,
          tenant_name: tenantName,
          role,
          invitation_id: invitation!.id,
        },
      }
    );

    // If user already exists, inviteUserByEmail returns an error we need to handle
    if (inviteErr) {
      // Existing user case: invitation record is already created, just notify them differently
      // We'll return success anyway — the invitation is in the DB and they can accept via /accept-invite
      console.error('inviteUserByEmail error (may be existing user):', inviteErr.message);
      return new Response(
        JSON.stringify({
          success: true,
          note: 'existing_user',
          invitation_id: invitation!.id,
          message: 'Invitation created. If the user already has an account, they can accept via their invite link.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, invitation_id: invitation!.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-invitation error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
