-- Migration 000027: CRM campaigns and automated workflows
-- Run in Supabase Dashboard → SQL Editor

-- campaigns table
create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type text not null default 'email', -- 'email' | 'whatsapp'
  status text not null default 'draft', -- 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  subject text,
  body text not null default '',
  target_segment text default 'all', -- 'all' | 'new' | 'vip' | 'inactive'
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table campaigns enable row level security;

create policy "tenant_campaigns" on campaigns
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- automated_workflows table (simple rules)
create table if not exists automated_workflows (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  trigger_type text not null, -- 'new_customer' | 'no_purchase_30d' | 'birthday' | 'low_stock'
  action_type text not null, -- 'send_email' | 'whatsapp_alert'
  action_config jsonb default '{}'::jsonb,
  is_active boolean default true,
  last_run_at timestamptz,
  run_count integer default 0,
  created_at timestamptz default now()
);

alter table automated_workflows enable row level security;

create policy "tenant_workflows" on automated_workflows
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
