-- Fixes BUG-056 (docs/qa-bug-tracker.md, 2026-07-12 QA sweep): restaurant_delivery_integrations'
-- RLS policy had no role check at all -- any authenticated tenant session, including a
-- low-privilege PIN-logged cashier, could read the webhook_secret column (displayed in
-- cleartext behind a show/hide toggle in DeliveryIntegrations.tsx), enabling forged webhook
-- payloads impersonating a delivery platform. Restricting to owner/admin/manager -- consistent
-- with MultiBranchHub (the other reader of this table), already gated to owner/admin only via
-- the /restaurant/branches route, and with the now-updated /restaurant/delivery route gating
-- (src/constants/restaurantNavAccess.ts, cashier removed from that one route only --
-- /restaurant/delivery-orders, the day-to-day order queue, is untouched and still cashier-accessible).
DROP POLICY IF EXISTS "tenant_delivery_integrations" ON public.restaurant_delivery_integrations;

CREATE POLICY "owner_manager_delivery_integrations" ON public.restaurant_delivery_integrations
  FOR ALL
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() IN ('owner', 'admin', 'manager'));
