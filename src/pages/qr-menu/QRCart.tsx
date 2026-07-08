import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { QRCartBundleItem, QRCartItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface QRCartProps {
  items: QRCartItem[];
  bundleItems: QRCartBundleItem[];
  tableId: string;
  tableDisplayLabel?: string;
  totalPrice: number;
  onUpdateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string, modifierKey: string) => void;
  onRemoveBundleItem: (cartKey: string) => void;
  onClose: () => void;
  onSuccess: (orderNumber: string, mode: 'direct' | 'pending') => void;
}

function getModifierKey(item: QRCartItem): string {
  const modStr = Object.entries(item.selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${item.menuItemId}__${modStr}`;
}

// Known bundle-related exception prefixes raised by qr_place_order's bundle
// branch (see the migration in Task 1) — pattern-matched against the plain
// exception-message string PostgREST returns, same convention this repo
// already uses for no_valid_items/table_not_found etc.
const BUNDLE_ERROR_PREFIXES = [
  'bundle_not_found',
  'bundle_inactive',
  'bundle_has_no_courses',
  'item_not_eligible_for_course',
  'item_no_longer_available',
  'incomplete_course_selection',
  'invalid_party_size',
  'malformed_bundle_item',
  'malformed_course_selection',
  'duplicate_course_selection',
  'course_not_in_bundle',
];

function mapPlaceOrderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (BUNDLE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return 'One of your combo selections is no longer available — please remove it from your cart and try again.';
  }
  return 'Something went wrong placing your order — please try again or ask your server for help.';
}

export default function QRCart({
  items,
  bundleItems,
  tableId,
  tableDisplayLabel,
  totalPrice,
  onUpdateQuantity,
  onRemoveItem,
  onRemoveBundleItem,
  onClose,
  onSuccess,
}: QRCartProps) {
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (items.length === 0 && bundleItems.length === 0) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const regularPayload = items.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        modifier_ids: Object.values(item.selectedModifiers).flat(),
        notes: item.notes || undefined,
      }));
      const bundlePayload = bundleItems.map((b) => ({
        bundle_id: b.bundleId,
        party_size: b.partySize,
        course_selections: b.courseSelections.map((cs) => ({
          bundle_course_id: cs.bundleCourseId,
          menu_item_id: cs.menuItemId,
        })),
      }));
      const payload = [...regularPayload, ...bundlePayload];

      const { data, error } = (await supabase.rpc('qr_place_order', {
        p_table_id: tableId,
        p_items: payload,
      })) as { data: { mode: 'direct' | 'pending'; order_id: string } | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      if (!data) throw new Error('qr_place_order returned no data');

      onSuccess(data.order_id.slice(-6).toUpperCase(), data.mode);
    } catch (err) {
      console.error('[QRCart] place order error:', err);
      setPlaceError(mapPlaceOrderError(err));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl"
      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3">
        <div className="h-1 w-10 rounded-full" style={{ background: 'var(--qr-border)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
            Your Order
          </h3>
          {(tableDisplayLabel ?? tableId) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              🪑 {tableDisplayLabel ? `Table ${tableDisplayLabel}` : `Table ${tableId.replace('table-', '')}`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: 'var(--qr-surface-2)' }}
          aria-label="Close cart"
        >
          <X className="h-4 w-4" style={{ color: 'var(--qr-text-muted)' }} />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <AnimatePresence>
          {items.map((item) => {
            const modKey = getModifierKey(item);
            const modSummary = Object.entries(item.selectedModifiers)
              .flatMap(([, ids]) => ids)
              .join(', ');

            return (
              <motion.div
                key={`${item.menuItemId}-${modKey}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                layout
                className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--qr-surface-2)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.menuItem.name}
                    </p>
                    {modSummary && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                        {modSummary}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs italic" style={{ color: 'var(--qr-text-muted)' }}>
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.menuItemId, modKey)}
                    className="flex-shrink-0 p-1"
                    style={{ color: 'var(--qr-text-muted)' }}
                    aria-label={`Remove ${item.menuItem.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                    <span className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Increase"
                    >
                      <Plus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Bundle cart lines — no quantity stepper; party size isn't adjustable
            in-cart (see useCart.ts design note), remove is the only control. */}
        <AnimatePresence>
          {bundleItems.map((b) => {
            const summary = b.courseSelections.map((cs) => cs.itemName).join(', ');
            return (
              <motion.div
                key={b.cartKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                layout
                className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--qr-surface-2)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      🎁 {b.bundleName}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                      for {b.partySize} guest{b.partySize !== 1 ? 's' : ''}
                    </p>
                    {summary && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                        {summary}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveBundleItem(b.cartKey)}
                    className="flex-shrink-0 p-1"
                    style={{ color: 'var(--qr-text-muted)' }}
                    aria-label={`Remove ${b.bundleName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
                    ${b.totalPrice.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t px-5 py-4" style={{ borderColor: 'var(--qr-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--qr-text-muted)' }}>
            Total ({items.reduce((s, i) => s + i.quantity, 0) + bundleItems.length} items)
          </span>
          <div className="text-right">
            <span className="text-xl font-bold" style={{ color: 'var(--qr-text)' }}>
              ${totalPrice.toFixed(2)}
            </span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              L.L. {(totalPrice * 89500).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {placeError && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-center text-xs"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--qr-text)' }}
          >
            {placeError}
          </p>
        )}

        <motion.button
          onClick={() => { void handlePlaceOrder(); }}
          disabled={placing || (items.length === 0 && bundleItems.length === 0)}
          className="w-full rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'var(--qr-accent)',
            color: 'var(--qr-bg)',
            boxShadow: '0 4px 24px rgba(var(--qr-accent-rgb), 0.35)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          {placing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="inline-block h-4 w-4 rounded-full border-2"
                style={{ borderColor: 'var(--qr-bg)', borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
              Placing Order...
            </span>
          ) : (
            'Place Order'
          )}
        </motion.button>

        <p className="mt-2 text-center text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          Your waiter will be notified immediately
        </p>
      </div>
    </motion.div>
  );
}
