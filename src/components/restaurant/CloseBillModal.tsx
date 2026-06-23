/**
 * CloseBillModal
 * Full bill-close payment sheet for restaurant waiters.
 *
 * Flow:
 *  1. Show item line-items + subtotal + charges + editable tip/discount
 *  2. Select payment method (Cash USD / Cash L.L. / Card / Split)
 *  3. Confirm — persists tip & discount, then calls fn_close_restaurant_bill RPC
 *  4. On success: shows brief receipt card + Print button, then closes
 *
 * Constraints:
 *  - Discount input only shown to owner/manager (canPerform('manage_settings'))
 *  - fn_close_restaurant_bill takes ONLY p_order_id + p_payment_method
 *    (tip/discount are read from the order row via updateTip/updateDiscount first)
 *  - Payment method mapping: cash_usd|cash_lbp → 'cash', card → 'card', split → 'other'
 */
import { X, Receipt, Check, Send } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import type { RestaurantOrderItem, TableOrderExtended } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

export type CloseBillPaymentMethod = 'cash_usd' | 'cash_lbp' | 'card' | 'split';

const LBP_RATE = 89_500;

/** Maps UI payment method to the values accepted by fn_close_restaurant_bill / sales table */
function mapPaymentMethod(method: CloseBillPaymentMethod): string {
  switch (method) {
    case 'cash_usd':
    case 'cash_lbp':
      return 'cash';
    case 'card':
      return 'card';
    case 'split':
      return 'other';
  }
}

interface ReceiptData {
  tableNumber: number | null;
  items: RestaurantOrderItem[];
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  vat: number;
  tip: number;
  grandTotal: number;
  paymentMethod: CloseBillPaymentMethod;
  paidAt: string;
  businessName: string;
}

/**
 * Formats a Lebanese phone number to E.164.
 * Strips non-digits, then:
 *   0XXXXXXX  → +961XXXXXXX
 *   961XXXXXXX → +961XXXXXXX
 *   +961…     → unchanged (already E.164)
 */
function formatLebanesePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('961')) return `+${digits}`;
  if (digits.startsWith('0')) return `+961${digits.slice(1)}`;
  if (digits.length > 0) return `+961${digits}`;
  return raw;
}

/** Returns a display hint like "+961 7 012 3456" */
function phoneHint(raw: string): string {
  const e164 = formatLebanesePhone(raw);
  // +961XXXXXXXXX → +961 X XXX XXXX (variable digit groupings for LB)
  const match = /^\+961(\d)(\d{3})(\d{4})$/.exec(e164);
  if (match) return `+961 ${match[1]} ${match[2]} ${match[3]}`;
  if (e164.startsWith('+')) return e164;
  return raw;
}

interface ReceiptViewProps {
  receipt: ReceiptData;
  onClose: () => void;
  canSendWhatsApp: boolean;
}

function ReceiptView({ receipt, onClose, canSendWhatsApp }: ReceiptViewProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendWhatsApp = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    const e164 = formatLebanesePhone(trimmed);
    setSending(true);
    try {
      const invokeResult = await supabase.functions.invoke('whatsapp-receipt', {
        body: {
          to: e164,
          customerName: 'Valued Guest',
          saleId: receipt.paidAt, // use timestamp as fallback ID
          items: receipt.items.map(i => ({
            name: i.product_name,
            qty: i.quantity,
            price: i.unit_price,
          })),
          subtotal: receipt.subtotal,
          tax: receipt.vat,
          service_charge: receipt.serviceCharge,
          tip: receipt.tip,
          total: receipt.grandTotal,
          paymentMethod: mapPaymentMethod(receipt.paymentMethod),
          businessName: receipt.businessName,
          currency: 'USD',
          lbp_total: receipt.paymentMethod === 'cash_lbp'
            ? Math.round(receipt.grandTotal * LBP_RATE)
            : undefined,
        },
      });
      if (invokeResult.error) {
        console.error('[WhatsApp receipt]', invokeResult.error);
        toast.error(t('restaurant.bill.whatsappFailed', 'Failed to send receipt'));
      } else {
        toast.success(t('restaurant.bill.whatsappSent', 'Receipt sent via WhatsApp'));
        setPhone('');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Receipt card */}
      <div
        id="bill-receipt"
        className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3 font-mono text-sm"
      >
        <div className="text-center">
          <p className="text-base font-bold text-white">
            {receipt.tableNumber !== null ? `Table ${receipt.tableNumber}` : 'Receipt'}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{new Date(receipt.paidAt).toLocaleString()}</p>
        </div>

        <div className="border-t border-dashed border-white/20 pt-3 space-y-1.5">
          {receipt.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="flex-1 truncate text-white/70">
                {item.quantity}&times; {item.product_name}
              </span>
              <span className="flex-none text-white/60">
                ${(item.unit_price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-white/20 pt-3 space-y-1">
          <div className="flex justify-between text-white/60">
            <span>{t('restaurant.bill.subtotal', 'Subtotal')}</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          {receipt.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>{t('restaurant.bill.discount', 'Discount')}</span>
              <span>&#8722;${receipt.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-white/60">
            <span>{t('restaurant.bill.serviceCharge', 'Service')}</span>
            <span>${receipt.serviceCharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>{t('restaurant.bill.vat', 'VAT')}</span>
            <span>${receipt.vat.toFixed(2)}</span>
          </div>
          {receipt.tip > 0 && (
            <div className="flex justify-between text-white/60">
              <span>{t('restaurant.bill.tip', 'Tip')}</span>
              <span>${receipt.tip.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/20 pt-1.5 font-bold text-white">
            <span>{t('restaurant.bill.total', 'TOTAL')}</span>
            <span>${receipt.grandTotal.toFixed(2)}</span>
          </div>
          <div className="text-center text-xs text-white/40 pt-1">
            {receipt.paymentMethod === 'cash_usd' && 'Cash (USD)'}
            {receipt.paymentMethod === 'cash_lbp' && 'Cash (L.L.)'}
            {receipt.paymentMethod === 'card' && 'Card'}
            {receipt.paymentMethod === 'split' && 'Split'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 transition-all active:scale-95"
        >
          <Receipt className="h-4 w-4" />
          {t('restaurant.bill.print', 'Print')}
        </button>
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
        >
          <Check className="h-4 w-4" />
          {t('common.done', 'Done')}
        </button>
      </div>

      {/* WhatsApp receipt — Business plan only */}
      {canSendWhatsApp && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-white/60 flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {t('restaurant.bill.sendReceipt', 'Send receipt to customer')}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+961 X XXX XXX"
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none"
              />
              {phone.trim().length > 0 && (
                <p className="text-xs text-white/40 px-1">
                  {phoneHint(phone)}
                </p>
              )}
            </div>
            <button
              onClick={() => { void handleSendWhatsApp(); }}
              disabled={sending || phone.trim().length === 0}
              className="flex-none flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending
                ? t('restaurant.bill.sending', 'Sending…')
                : t('restaurant.bill.send', 'Send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CloseBillModalProps {
  /** The table number shown in the receipt header */
  tableNumber: number | null;
  /** Full extended order object — used for service_charge_pct, vat_pct, existing tip/discount */
  order: TableOrderExtended;
  /** All items on this order */
  items: RestaurantOrderItem[];
  /** Called to persist tip to DB before closing */
  onUpdateTip: (tipUsd: number) => Promise<void>;
  /** Called to persist discount to DB before closing */
  onUpdateDiscount: (pct: number) => Promise<void>;
  /**
   * Called with the mapped payment method (cash/card/other) after tip & discount are
   * persisted. Should call fn_close_restaurant_bill and handle success/error toasts.
   */
  onConfirm: (mappedPaymentMethod: string) => Promise<void>;
  /** Close the modal without confirming */
  onClose: () => void;
  /** Linked loyalty customer — shows redemption UI when provided with loyaltyRedeemRate */
  linkedCustomer?: { id: string; name: string; pointsBalance: number } | null;
  /** Loyalty redeem rate: e.g. 0.01 means 100 pts = $1. Defaults to 0.01 */
  loyaltyRedeemRate?: number;
  /** Called when user toggles points redemption; receives the USD discount amount (0 to cancel) */
  onRedeemPoints?: (discountUsd: number) => void;
}

export default function CloseBillModal({
  tableNumber,
  order,
  items,
  onUpdateTip,
  onUpdateDiscount,
  onConfirm,
  onClose,
  linkedCustomer,
  loyaltyRedeemRate,
  onRedeemPoints,
}: CloseBillModalProps) {
  const { t } = useTranslation();
  const { canPerform, plan } = useSubscription();
  const { currentTenant } = useApp();
  const canDiscount = canPerform('manage_settings');
  const canSendWhatsApp = plan === 'business';

  const [paymentMethod, setPaymentMethod] = useState<CloseBillPaymentMethod>('cash_usd');
  const [tipAmount, setTipAmount] = useState<number>(order.tip_amount_usd ?? 0);
  const [discountPct, setDiscountPct] = useState<number>(order.discount_pct ?? 0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [redeemingPoints, setRedeemingPoints] = useState(false);

  // Keyboard accessibility: focus close button on mount
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // Escape key closes modal (unless showing receipt)
  useEffect(() => {
    if (receipt) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, receipt]);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const effectiveDiscountPct = canDiscount ? discountPct : 0;
  const discountAmount = (subtotal * effectiveDiscountPct) / 100;
  const afterDiscount = subtotal - discountAmount;
  const serviceCharge = (afterDiscount * (order.service_charge_pct ?? 10)) / 100;
  const vat = (afterDiscount + serviceCharge) * ((order.vat_pct ?? 11) / 100);
  // Loyalty redemption — capped at 50% of subtotal
  const loyaltyDiscountUsd = redeemingPoints && linkedCustomer && loyaltyRedeemRate
    ? Math.min(linkedCustomer.pointsBalance * loyaltyRedeemRate, subtotal * 0.5)
    : 0;
  const grandTotal = afterDiscount + serviceCharge + vat + tipAmount - loyaltyDiscountUsd;
  const grandTotalLbp = Math.round(grandTotal * LBP_RATE);
  const changeUsd =
    paymentMethod.startsWith('cash') ? Math.max(0, cashReceived - grandTotal) : 0;

  // ── Confirm handler ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // Notify parent of redemption amount so it can deduct points
      if (loyaltyDiscountUsd > 0 && onRedeemPoints) {
        onRedeemPoints(loyaltyDiscountUsd);
      }
      // Persist tip & discount to DB so the RPC reads them from the order row
      await onUpdateTip(tipAmount);
      if (canDiscount) {
        await onUpdateDiscount(discountPct);
      }
      await onConfirm(mapPaymentMethod(paymentMethod));
      // Show receipt after successful close
      setReceipt({
        tableNumber,
        items,
        subtotal,
        discountAmount: canDiscount ? discountAmount : 0,
        serviceCharge,
        vat,
        tip: tipAmount,
        grandTotal,
        paymentMethod,
        paidAt: new Date().toISOString(),
        businessName: currentTenant?.name ?? 'Restaurant',
      });
    } finally {
      setConfirming(false);
    }
  };

  const paymentMethods: Array<{ key: CloseBillPaymentMethod; label: string }> = [
    { key: 'cash_usd', label: 'Cash USD' },
    { key: 'cash_lbp', label: 'Cash L.L.' },
    { key: 'card', label: 'Card' },
    { key: 'split', label: 'Split' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('restaurant.closeBill.title', 'Close Bill')}
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-slate-900 flex flex-col max-h-[90dvh] sm:max-h-[85vh] sm:rounded-2xl sm:border">
        {/* Header */}
        <div className="flex-none px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
          <h2 className="text-base font-bold text-white">
            {receipt
              ? t('restaurant.closeBill.receipt', 'Receipt')
              : t('restaurant.closeBill.title', 'Close Bill')}
            {tableNumber !== null && (
              <span className="ml-2 text-sm font-normal text-white/40">
                &#8212; Table {tableNumber}
              </span>
            )}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white transition-all"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {receipt ? (
            <ReceiptView receipt={receipt} onClose={onClose} canSendWhatsApp={canSendWhatsApp} />
          ) : (
            <>
              {/* Item line-items */}
              {items.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-none text-xs font-bold text-white/50 w-6 text-center">
                        {item.quantity}&times;
                      </span>
                      <span className="flex-1 truncate text-sm text-white">
                        {item.product_name}
                      </span>
                      <span className="flex-none text-sm text-white/60">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bill summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">{t('restaurant.bill.subtotal', 'Subtotal')}</span>
                  <span className="text-white">${subtotal.toFixed(2)}</span>
                </div>
                {effectiveDiscountPct > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">
                      {t('restaurant.bill.discount', 'Discount')} (
                      {effectiveDiscountPct.toFixed(1)}%)
                    </span>
                    <span className="text-emerald-400">&#8722;${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">
                    {t('restaurant.bill.serviceCharge', 'Service')} (
                    {order.service_charge_pct ?? 10}%)
                  </span>
                  <span className="text-white">${serviceCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">
                    {t('restaurant.bill.vat', 'VAT')} ({order.vat_pct ?? 11}%)
                  </span>
                  <span className="text-white">${vat.toFixed(2)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">{t('restaurant.bill.tip', 'Tip')}</span>
                    <span className="text-white">${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                {loyaltyDiscountUsd > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">{t('restaurant.bill.loyaltyDiscount', 'Points Discount')}</span>
                    <span className="text-emerald-400">&#8722;${loyaltyDiscountUsd.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2.5 flex justify-between items-end">
                  <span className="text-base font-bold text-white">
                    {t('restaurant.bill.total', 'Grand Total')}
                  </span>
                  <div className="text-end">
                    <p className="text-xl font-black text-white">${grandTotal.toFixed(2)}</p>
                    <p className="text-xs text-white/40">{grandTotalLbp.toLocaleString()} L.L.</p>
                  </div>
                </div>
              </div>

              {/* Tip input */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  {t('restaurant.bill.tipUsd', 'Tip (USD)')}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              {/* Discount input — manager/owner only */}
              {canDiscount && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    {t('restaurant.bill.discountPct', 'Discount (%)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={discountPct}
                    onChange={(e) =>
                      setDiscountPct(
                        Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Loyalty redemption — shown when customer is linked with points */}
              {linkedCustomer && loyaltyRedeemRate && linkedCustomer.pointsBalance > 0 && (
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {linkedCustomer.name}
                      </p>
                      <p className="text-xs text-white/50 mt-0.5">
                        {linkedCustomer.pointsBalance.toLocaleString()} pts ·{' '}
                        <span className="text-emerald-400 font-semibold">
                          worth ${(linkedCustomer.pointsBalance * loyaltyRedeemRate).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-white/60">
                        {t('restaurant.bill.redeemPoints', 'Redeem')}
                      </span>
                      <input
                        type="checkbox"
                        checked={redeemingPoints}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRedeemingPoints(checked);
                          const disc = checked
                            ? Math.min(linkedCustomer.pointsBalance * loyaltyRedeemRate, subtotal * 0.5)
                            : 0;
                          onRedeemPoints?.(disc);
                        }}
                        className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                      />
                    </label>
                  </div>
                  {redeemingPoints && loyaltyDiscountUsd > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 px-3 py-2">
                      <span className="text-xs font-semibold text-emerald-400">
                        {t('restaurant.bill.loyaltyDiscount', 'Points Discount Applied')}
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        &#8722;${loyaltyDiscountUsd.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment method selector */}
              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  {t('restaurant.bill.paymentMethod', 'Payment Method')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPaymentMethod(key)}
                      className={`rounded-xl py-3 text-sm font-semibold transition-all active:scale-95 ${
                        paymentMethod === key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash received input (cash payments only) */}
              {paymentMethod.startsWith('cash') && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    {paymentMethod === 'cash_usd'
                      ? t('restaurant.bill.cashReceivedUsd', 'Cash Received (USD)')
                      : t('restaurant.bill.cashReceivedLbp', 'Cash Received (L.L.)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={paymentMethod === 'cash_usd' ? 0.5 : 1000}
                    value={cashReceived}
                    onChange={(e) =>
                      setCashReceived(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                    placeholder={paymentMethod === 'cash_usd' ? '0.00' : '0'}
                  />
                  {changeUsd > 0 && (
                    <p className="mt-1.5 text-sm font-semibold text-emerald-400">
                      {t('restaurant.bill.change', 'Change')}: ${changeUsd.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={() => { void handleConfirm(); }}
                disabled={confirming}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-base font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <Receipt className="h-5 w-5" />
                {confirming
                  ? t('restaurant.bill.confirming', 'Processing...')
                  : t('restaurant.bill.confirm', 'Confirm Payment')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
