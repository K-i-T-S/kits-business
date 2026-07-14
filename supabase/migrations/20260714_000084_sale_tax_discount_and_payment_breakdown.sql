-- Fixes BUG-033 (Sale tax/discount breakdown hardcoded to zero) and BUG-032
-- (POS split-payment breakdown never persisted) -- docs/qa-bug-tracker.md.
--
-- BUG-033: AppContext.tsx's addSale wrote literal 0, 0 for discount/
-- tax_amount on every sale -- not a wiring bug, the canonical Sale type
-- never carried these fields even though POS.tsx computes them correctly.
-- sale.total/subtotal already reflect the real taxed/discounted amount
-- (customers were never charged wrong), but the breakdown itself was
-- permanently zeroed. The discount/tax_amount columns already exist
-- (numeric, default 0) -- this migration adds nothing for that half, the
-- frontend fix (already applied) just stops passing hardcoded zeros.
--
-- BUG-032: any split payment (2+ methods) collapsed to a single
-- hard-defaulted 'cash' payment_method, discarding the real per-method
-- breakdown that only ever existed in the ephemeral receipt object --
-- overstating expected cash and understating card settlement in any
-- downstream reconciliation. Adds a nullable payment_breakdown jsonb
-- column (populated only when a sale actually used 2+ payment methods;
-- single-method sales are already fully described by payment_method) rather
-- than a new child table, per the Agent Brief's stated alternative -- lower
-- risk given sales now writes through PowerSync (src/context/AppContext.tsx)
-- and this reuses the JSON_COLUMNS re-parse pattern already established in
-- src/powersync/connector.ts for exactly this local-text-to-jsonb case
-- (restaurant_order_items.modifiers, tenants.settings).
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_breakdown jsonb;

COMMENT ON COLUMN public.sales.payment_breakdown IS
  'Per-method breakdown (SplitPayment[]) for a split-payment sale (2+ methods). Null for single-method sales, which payment_method already fully describes.';
