import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kits-admin-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Protect with a simple one-time admin key passed as header
  const adminKey = req.headers.get('x-kits-admin-key');
  if (adminKey !== 'kits-migrate-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL') ?? Deno.env.get('DATABASE_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'No DATABASE_URL available' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

  const results: string[] = [];

  try {
    // Run each migration statement block
    const migrations = [
      { name: '000009_fix_onboarding_completed', sql: `UPDATE tenants SET onboarding_completed = true WHERE onboarding_completed = false;` },
