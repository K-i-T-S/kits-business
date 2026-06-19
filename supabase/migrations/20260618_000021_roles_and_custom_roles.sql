-- ============================================================
-- New standard roles + custom roles feature
-- ============================================================

-- 1. Expand role CHECK constraints to include new standard roles
-- Must DROP and re-ADD because PostgreSQL doesn't support ALTER CONSTRAINT

ALTER TABLE public.tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_role_check;
ALTER TABLE public.tenant_users
  ADD CONSTRAINT tenant_users_role_check
  CHECK (role IN ('owner','admin','manager','supervisor','cashier','accountant','stockkeeper','viewer'));

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN ('owner','admin','manager','supervisor','cashier','accountant','stockkeeper','viewer'));

ALTER TABLE public.pending_invitations
  DROP CONSTRAINT IF EXISTS pending_invitations_role_check;
ALTER TABLE public.pending_invitations
  ADD CONSTRAINT pending_invitations_role_check
  CHECK (role IN ('owner','admin','manager','supervisor','cashier','accountant','stockkeeper','viewer'));

-- 2. Update current_user_role() — treat 'admin' as 'owner' for RLS purposes
--    so all existing policies work without modification
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE WHEN role = 'admin' THEN 'owner' ELSE role END
  FROM public.tenant_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- 3. Custom roles table — tenant-defined roles with permission JSONB
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  -- permissions JSONB: keys are action names, values are boolean
  -- e.g. {"create_sales": true, "view_reports": false, ...}
  permissions  JSONB NOT NULL DEFAULT '{}',
  -- base_role determines DB-level data access (mapped to RLS role)
  base_role    TEXT NOT NULL DEFAULT 'viewer'
    CHECK (base_role IN ('manager','cashier','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view custom roles" ON public.custom_roles
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "managers manage custom roles" ON public.custom_roles
  FOR ALL USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner', 'manager')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;

-- 4. Add custom_role_id to tenant_users (nullable — set when a user has a custom role)
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 5. Add custom_role_id to pending_invitations (nullable)
ALTER TABLE public.pending_invitations
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 6. Grant kits admin role in all existing tenants
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'kits.tech.co@gmail.com';
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    SELECT t.id, v_admin_id, 'admin'
    FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = t.id AND tu.user_id = v_admin_id
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'admin';
  END IF;
END;
$$;

-- 7. Trigger: auto-add kits admin to every new tenant
CREATE OR REPLACE FUNCTION public.add_kits_admin_to_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Only fire when the first owner is added (tenant just created)
  IF NEW.role != 'owner' THEN RETURN NEW; END IF;
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'kits.tech.co@gmail.com';
  IF v_admin_id IS NOT NULL AND v_admin_id != NEW.user_id THEN
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (NEW.tenant_id, v_admin_id, 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_owner_added_add_kits_admin ON public.tenant_users;
CREATE TRIGGER on_owner_added_add_kits_admin
  AFTER INSERT ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.add_kits_admin_to_tenant();
