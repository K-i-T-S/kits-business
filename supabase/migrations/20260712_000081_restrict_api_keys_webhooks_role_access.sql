-- Fixes BUG-084 (docs/qa-bug-tracker.md, 2026-07-12 QA sweep): api_keys, webhooks, and
-- webhook_deliveries' RLS policies had no role check at all -- any authenticated tenant
-- session, including a low-privilege PIN-logged cashier, could read/write API keys and
-- webhook signing secrets. Same class and same fix pattern as BUG-056
-- (restaurant_delivery_integrations, migration 20260712_000080). Restricting to
-- owner/admin, matching this feature's existing route gating in App.tsx.
DROP POLICY IF EXISTS "tenant_access" ON public.api_keys;
CREATE POLICY "owner_admin_api_keys" ON public.api_keys
  FOR ALL
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin'))
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "tenant_access" ON public.webhooks;
CREATE POLICY "owner_admin_webhooks" ON public.webhooks
  FOR ALL
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin'))
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "tenant_access" ON public.webhook_deliveries;
CREATE POLICY "owner_admin_webhook_deliveries" ON public.webhook_deliveries
  FOR ALL
  USING (
    webhook_id IN (
      SELECT id FROM public.webhooks
      WHERE tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    webhook_id IN (
      SELECT id FROM public.webhooks
      WHERE tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin')
    )
  );
