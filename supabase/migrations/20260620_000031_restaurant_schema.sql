-- Sprint 2.2: Restaurant Vertical Schema
-- Safe to re-run (uses IF NOT EXISTS)

-- ── restaurant_tables ────────────────────────────────────────────────────────
create table if not exists public.restaurant_tables (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  number      integer not null,
  name        text,
  section     text not null default 'indoor',      -- 'indoor'|'terrace'|'bar'
  seats       integer not null default 4,
  x           numeric not null default 10,          -- % from left in floor plan
  y           numeric not null default 10,          -- % from top in floor plan
  status      text not null default 'available',    -- 'available'|'occupied'|'reserved'|'cleaning'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.restaurant_tables enable row level security;

drop policy if exists "rt_select" on public.restaurant_tables;
drop policy if exists "rt_insert" on public.restaurant_tables;
drop policy if exists "rt_update" on public.restaurant_tables;
drop policy if exists "rt_delete" on public.restaurant_tables;

create policy "rt_select" on public.restaurant_tables for select
  using (tenant_id = current_tenant_id());
create policy "rt_insert" on public.restaurant_tables for insert
  with check (tenant_id = current_tenant_id());
create policy "rt_update" on public.restaurant_tables for update
  using (tenant_id = current_tenant_id());
create policy "rt_delete" on public.restaurant_tables for delete
  using (tenant_id = current_tenant_id());

-- ── table_orders ─────────────────────────────────────────────────────────────
create table if not exists public.table_orders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  table_id       uuid references public.restaurant_tables(id) on delete set null,
  status         text not null default 'open',       -- 'open'|'sent'|'served'|'paid'|'cancelled'
  current_course text not null default 'mains',      -- 'appetizers'|'mains'|'desserts'
  notes          text,
  opened_at      timestamptz default now(),
  closed_at      timestamptz
);

alter table public.table_orders enable row level security;

drop policy if exists "to_select" on public.table_orders;
drop policy if exists "to_insert" on public.table_orders;
drop policy if exists "to_update" on public.table_orders;
drop policy if exists "to_delete" on public.table_orders;

create policy "to_select" on public.table_orders for select
  using (tenant_id = current_tenant_id());
create policy "to_insert" on public.table_orders for insert
  with check (tenant_id = current_tenant_id());
create policy "to_update" on public.table_orders for update
  using (tenant_id = current_tenant_id());
create policy "to_delete" on public.table_orders for delete
  using (tenant_id = current_tenant_id());

-- ── restaurant_order_items ───────────────────────────────────────────────────
create table if not exists public.restaurant_order_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  order_id      uuid not null references public.table_orders(id) on delete cascade,
  product_name  text not null,
  quantity      integer not null default 1,
  unit_price    numeric not null default 0,
  modifiers     jsonb default '[]'::jsonb,          -- [{name: string, price_delta: number}]
  course        text not null default 'mains',
  status        text not null default 'pending',     -- 'pending'|'in_progress'|'ready'|'served'
  notes         text,
  sent_at       timestamptz,
  ready_at      timestamptz
);

alter table public.restaurant_order_items enable row level security;

drop policy if exists "roi_select" on public.restaurant_order_items;
drop policy if exists "roi_insert" on public.restaurant_order_items;
drop policy if exists "roi_update" on public.restaurant_order_items;
drop policy if exists "roi_delete" on public.restaurant_order_items;

create policy "roi_select" on public.restaurant_order_items for select
  using (tenant_id = current_tenant_id());
create policy "roi_insert" on public.restaurant_order_items for insert
  with check (tenant_id = current_tenant_id());
create policy "roi_update" on public.restaurant_order_items for update
  using (tenant_id = current_tenant_id());
create policy "roi_delete" on public.restaurant_order_items for delete
  using (tenant_id = current_tenant_id());

-- ── reservations ─────────────────────────────────────────────────────────────
create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  table_id     uuid references public.restaurant_tables(id) on delete set null,
  guest_name   text not null,
  guest_phone  text not null,
  party_size   integer not null default 2,
  reserved_at  timestamptz not null,
  notes        text,
  status       text not null default 'pending',      -- 'pending'|'confirmed'|'seated'|'completed'|'no_show'|'cancelled'
  created_at   timestamptz default now()
);

alter table public.reservations enable row level security;

drop policy if exists "res_select" on public.reservations;
drop policy if exists "res_insert" on public.reservations;
drop policy if exists "res_update" on public.reservations;
drop policy if exists "res_delete" on public.reservations;

create policy "res_select" on public.reservations for select
  using (tenant_id = current_tenant_id());
create policy "res_insert" on public.reservations for insert
  with check (tenant_id = current_tenant_id());
create policy "res_update" on public.reservations for update
  using (tenant_id = current_tenant_id());
create policy "res_delete" on public.reservations for delete
  using (tenant_id = current_tenant_id());
