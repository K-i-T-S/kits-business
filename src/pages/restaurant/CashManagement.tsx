/* eslint-disable security/detect-object-injection */
import { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import FeatureGate from '@/components/FeatureGate';
import { supabase } from '@/utils/supabaseClient';
import { useApp } from '@/context/AppContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DenominationBreakdown {
  usd: Record<string, number>;
  lbp: Record<string, number>;
}

interface CashSession {
  id: string;
  tenant_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_float_usd: number;
  opening_float_lbp: number;
  expected_cash_usd: number | null;
  expected_cash_lbp: number | null;
  actual_cash_usd: number | null;
  actual_cash_lbp: number | null;
  over_short_usd: number | null;
  over_short_lbp: number | null;
  denomination_breakdown: DenominationBreakdown | null;
  notes: string | null;
  status: 'open' | 'closed';
}

// ─── Constants ───────────────────────────────────────────────────────────────

const USD_BILLS = ['100', '50', '20', '10', '5', '1'] as const;
const USD_COINS = ['0.25', '0.10'] as const;
const USD_DENOMS = [...USD_BILLS, ...USD_COINS];

const LBP_BILLS = ['100000', '50000', '25000', '10000', '5000', '1000'] as const;
const LBP_COINS = ['500', '250'] as const;
const LBP_DENOMS = [...LBP_BILLS, ...LBP_COINS];

function emptyUSD(): Record<string, number> {
  return Object.fromEntries(USD_DENOMS.map((d) => [d, 0]));
}

function emptyLBP(): Record<string, number> {
  return Object.fromEntries(LBP_DENOMS.map((d) => [d, 0]));
}

function calcUSDTotal(denoms: Record<string, number>): number {
  return USD_DENOMS.reduce((sum, d) => sum + parseFloat(d) * (denoms[d] ?? 0), 0);
}

function calcLBPTotal(denoms: Record<string, number>): number {
  return LBP_DENOMS.reduce((sum, d) => sum + parseInt(d, 10) * (denoms[d] ?? 0), 0);
}

function fmtUSD(v: number): string {
  return `$${v.toFixed(2)}`;
}

function fmtLBP(v: number): string {
  return `L.L. ${v.toLocaleString()}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Over/Short helpers ──────────────────────────────────────────────────────

type BalanceStatus = 'balanced' | 'minor' | 'major';

function overShortStatus(actual: number | null, expected: number | null): BalanceStatus {
  if (actual === null || expected === null || expected === 0) return 'balanced';
  const pct = Math.abs(actual - expected) / expected;
  if (pct <= 0.01) return 'balanced'; // within 1%
  if (pct <= 0.05) return 'minor';
  return 'major';
}

function overShortColor(status: BalanceStatus): string {
  if (status === 'balanced') return 'text-emerald-400';
  if (status === 'minor') return 'text-amber-400';
  return 'text-red-400';
}

function overShortIcon(status: BalanceStatus) {
  if (status === 'balanced') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'minor') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

// ─── Denomination Stepper ────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  count: number;
  onChange: (n: number) => void;
}

function DenomStepper({ label, count, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/70 w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, count - 1))}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <span className="w-10 text-center text-white font-mono">{count}</span>
        <button
          type="button"
          onClick={() => onChange(count + 1)}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <span className="text-xs text-white/40 w-16 text-right font-mono">
        ×{count}
      </span>
    </div>
  );
}

// ─── Open Till Modal ──────────────────────────────────────────────────────────

interface OpenTillModalProps {
  onClose: () => void;
  onOpen: (floatUSD: number, floatLBP: number) => Promise<void>;
}

function OpenTillModal({ onClose, onOpen }: OpenTillModalProps) {
  const [floatUSD, setFloatUSD] = useState('0.00');
  const [floatLBP, setFloatLBP] = useState('0');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onOpen(parseFloat(floatUSD) || 0, parseInt(floatLBP, 10) || 0);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-400" />
            Open Till
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-white/60 mb-5">
          Record the opening float — cash already in the drawer before trading begins.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Opening Float (USD)</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={floatUSD}
              onChange={(e) => setFloatUSD(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Opening Float (LBP)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={floatLBP}
              onChange={(e) => setFloatLBP(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {loading ? 'Opening...' : 'Open Till'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Close Till Modal ─────────────────────────────────────────────────────────

interface CloseTillModalProps {
  session: CashSession;
  onClose: () => void;
  onConfirm: (
    actualUSD: number,
    actualLBP: number,
    breakdown: DenominationBreakdown,
    notes: string,
  ) => Promise<void>;
}

function CloseTillModal({ session, onClose, onConfirm }: CloseTillModalProps) {
  const [usdDenoms, setUsdDenoms] = useState<Record<string, number>>(emptyUSD);
  const [lbpDenoms, setLbpDenoms] = useState<Record<string, number>>(emptyLBP);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const usdTotal = calcUSDTotal(usdDenoms);
  const lbpTotal = calcLBPTotal(lbpDenoms);

  const expectedUSD = session.expected_cash_usd ?? 0;
  const expectedLBP = session.expected_cash_lbp ?? 0;

  const usdStatus = overShortStatus(usdTotal, expectedUSD);
  const lbpStatus = overShortStatus(lbpTotal, expectedLBP);

  const setUSDDenom = (key: string, val: number) =>
    setUsdDenoms((prev) => ({ ...prev, [key]: val }));

  const setLBPDenom = (key: string, val: number) =>
    setLbpDenoms((prev) => ({ ...prev, [key]: val }));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(
        usdTotal,
        lbpTotal,
        { usd: usdDenoms, lbp: lbpDenoms },
        notes,
      );
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-400" />
            Close Till — Count & Reconcile
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* USD denominations */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-500/20 rounded-full text-emerald-400 text-xs flex items-center justify-center font-bold">$</span>
              USD Denominations
            </h3>
            <div className="space-y-0.5">
              <div className="mb-2">
                <span className="text-xs text-white/40 uppercase tracking-wider">Bills</span>
              </div>
              {USD_BILLS.map((d) => (
                <DenomStepper
                  key={d}
                  label={`$${d}`}
                  count={usdDenoms[d] ?? 0}
                  onChange={(v) => setUSDDenom(d, v)}
                />
              ))}
              <div className="mt-3 mb-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Coins</span>
              </div>
              {USD_COINS.map((d) => (
                <DenomStepper
                  key={d}
                  label={`$${d}`}
                  count={usdDenoms[d] ?? 0}
                  onChange={(v) => setUSDDenom(d, v)}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-sm text-white/60">USD Total</span>
              <span className="text-base font-semibold text-white font-mono">{fmtUSD(usdTotal)}</span>
            </div>
          </div>

          {/* LBP denominations */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-red-500/20 rounded-full text-red-400 text-xs flex items-center justify-center font-bold">ل</span>
              LBP Denominations
            </h3>
            <div className="space-y-0.5">
              <div className="mb-2">
                <span className="text-xs text-white/40 uppercase tracking-wider">Bills</span>
              </div>
              {LBP_BILLS.map((d) => (
                <DenomStepper
                  key={d}
                  label={`L.L. ${parseInt(d, 10).toLocaleString()}`}
                  count={lbpDenoms[d] ?? 0}
                  onChange={(v) => setLBPDenom(d, v)}
                />
              ))}
              <div className="mt-3 mb-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Coins</span>
              </div>
              {LBP_COINS.map((d) => (
                <DenomStepper
                  key={d}
                  label={`L.L. ${parseInt(d, 10).toLocaleString()}`}
                  count={lbpDenoms[d] ?? 0}
                  onChange={(v) => setLBPDenom(d, v)}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-sm text-white/60">LBP Total</span>
              <span className="text-base font-semibold text-white font-mono">{fmtLBP(lbpTotal)}</span>
            </div>
          </div>

          {/* Reconciliation summary */}
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Reconciliation</h3>

            {/* USD row */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Expected USD</div>
                <div className="font-mono text-white">{fmtUSD(expectedUSD)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Counted USD</div>
                <div className="font-mono text-white">{fmtUSD(usdTotal)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Over/Short</div>
                <div className={`font-mono font-semibold flex items-center justify-center gap-1 ${overShortColor(usdStatus)}`}>
                  {overShortIcon(usdStatus)}
                  {fmtUSD(usdTotal - expectedUSD)}
                </div>
              </div>
            </div>

            {/* LBP row */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Expected LBP</div>
                <div className="font-mono text-white text-xs">{fmtLBP(expectedLBP)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Counted LBP</div>
                <div className="font-mono text-white text-xs">{fmtLBP(lbpTotal)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">Over/Short</div>
                <div className={`font-mono font-semibold flex items-center justify-center gap-1 text-xs ${overShortColor(lbpStatus)}`}>
                  {overShortIcon(lbpStatus)}
                  {fmtLBP(lbpTotal - expectedLBP)}
                </div>
              </div>
            </div>

            {session.expected_cash_usd === null && (
              <p className="text-xs text-amber-400/80">
                Note: Expected cash is based on orders with a recorded payment currency.
                Orders closed before migration 000043 may not be included.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any discrepancies or comments..."
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {loading ? 'Closing...' : 'Close Till & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CashManagement() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load sessions ──────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('restaurant_cash_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('opened_at', { ascending: false })
        .limit(11);

      if (err) throw err;

      const sessions = (data ?? []) as CashSession[];
      const open = sessions.find((s) => s.status === 'open') ?? null;
      const closed = sessions.filter((s) => s.status === 'closed').slice(0, 10);

      setActiveSession(open);
      setHistory(closed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // ── Compute expected cash from orders during session ─────────────────────

  async function computeExpected(sessionOpenedAt: string): Promise<{ usd: number; lbp: number }> {
    if (!tenantId) return { usd: 0, lbp: 0 };

    const { data } = await supabase
      .from('table_orders')
      .select('total_amount, payment_currency')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .eq('payment_method', 'cash')
      .gte('paid_at', sessionOpenedAt);

    const rows = (data ?? []) as Array<{ total_amount: number | null; payment_currency: string | null }>;

    let usd = 0;
    let lbp = 0;
    for (const r of rows) {
      const amt = r.total_amount ?? 0;
      if (r.payment_currency === 'lbp') {
        // total_amount on table_orders is stored in USD-equivalent; if payment_currency is LBP
        // we can't reconstruct the LBP amount from total_amount (no exchange rate stored).
        // We track LBP expected as 0 unless payment_currency column is populated with lbp amounts.
        lbp += 0; // LBP expected cannot be derived without lbp_total column
      } else {
        // payment_currency = 'usd' or NULL (pre-migration orders) — count as USD
        usd += amt;
      }
    }

    // Add opening float to expected (float is in the drawer from the start)
    return { usd, lbp };
  }

  // ── Open Till ──────────────────────────────────────────────────────────────

  async function handleOpenTill(floatUSD: number, floatLBP: number): Promise<void> {
    if (!tenantId) return;

    const { error: err } = await supabase
      .from('restaurant_cash_sessions')
      .insert({
        tenant_id: tenantId,
        opening_float_usd: floatUSD,
        opening_float_lbp: floatLBP,
        status: 'open',
      });

    if (err) throw err;
    await loadSessions();
  }

  // ── Close Till ─────────────────────────────────────────────────────────────

  async function handleCloseTill(
    actualUSD: number,
    actualLBP: number,
    breakdown: DenominationBreakdown,
    notes: string,
  ): Promise<void> {
    if (!tenantId || !activeSession) return;

    const expected = await computeExpected(activeSession.opened_at);
    // Add opening float to expected (cashier should count it back in)
    const expectedUSD = expected.usd + activeSession.opening_float_usd;
    const expectedLBP = expected.lbp + activeSession.opening_float_lbp;

    const { error: err } = await supabase
      .from('restaurant_cash_sessions')
      .update({
        closed_at: new Date().toISOString(),
        status: 'closed',
        actual_cash_usd: actualUSD,
        actual_cash_lbp: actualLBP,
        expected_cash_usd: expectedUSD,
        expected_cash_lbp: expectedLBP,
        denomination_breakdown: breakdown,
        notes: notes || null,
      })
      .eq('id', activeSession.id)
      .eq('tenant_id', tenantId);

    if (err) throw err;
    await loadSessions();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <FeatureGate feature="advanced_analytics">
      <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Landmark className="w-7 h-7 text-indigo-400" />
              Cash Drawer
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Till management — open, count, and reconcile shift cash
            </p>
          </div>
          <button
            onClick={() => void loadSessions()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Active Session Banner ─────────────────────────────────── */}
            {activeSession ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-semibold">Till Open</span>
                  </div>
                  <p className="text-white/70 text-sm">
                    Drawer open since{' '}
                    <span className="text-white font-medium">{fmtTime(activeSession.opened_at)}</span>
                    {' '}· Float:{' '}
                    <span className="text-white font-mono">{fmtUSD(activeSession.opening_float_usd)}</span>
                    {activeSession.opening_float_lbp > 0 && (
                      <> + <span className="text-white font-mono">{fmtLBP(activeSession.opening_float_lbp)}</span></>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  Close Till
                </button>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">No Active Session</p>
                  <p className="text-white/50 text-sm mt-0.5">
                    Open the till at the start of your shift to track cash collections.
                  </p>
                </div>
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  Open Till
                </button>
              </div>
            )}

            {/* ── Session History ───────────────────────────────────────── */}
            <div>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                Recent Sessions
              </h2>

              {history.length === 0 ? (
                <div className="bg-white/5 rounded-xl px-5 py-8 text-center text-white/40 text-sm">
                  No closed sessions yet
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-left">
                        <th className="px-4 py-3 text-white/50 font-medium">Opened</th>
                        <th className="px-4 py-3 text-white/50 font-medium">Closed</th>
                        <th className="px-4 py-3 text-white/50 font-medium text-right">Float USD</th>
                        <th className="px-4 py-3 text-white/50 font-medium text-right">Actual USD</th>
                        <th className="px-4 py-3 text-white/50 font-medium text-right">Over/Short</th>
                        <th className="px-4 py-3 text-white/50 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {history.map((s) => {
                        const usdStatus = overShortStatus(s.actual_cash_usd, s.expected_cash_usd);
                        const diff = s.over_short_usd;
                        return (
                          <tr key={s.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-white/80">
                              {fmtDateTime(s.opened_at)}
                            </td>
                            <td className="px-4 py-3 text-white/80">
                              {s.closed_at ? fmtDateTime(s.closed_at) : '—'}
                            </td>
                            <td className="px-4 py-3 text-white font-mono text-right">
                              {fmtUSD(s.opening_float_usd)}
                            </td>
                            <td className="px-4 py-3 text-white font-mono text-right">
                              {s.actual_cash_usd !== null ? fmtUSD(s.actual_cash_usd) : '—'}
                            </td>
                            <td className={`px-4 py-3 font-mono text-right font-semibold ${overShortColor(usdStatus)}`}>
                              {diff !== null ? (
                                <span className="flex items-center justify-end gap-1">
                                  {overShortIcon(usdStatus)}
                                  {diff >= 0 ? '+' : ''}{fmtUSD(diff)}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-white/60">
                                Closed
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showOpenModal && (
        <OpenTillModal
          onClose={() => setShowOpenModal(false)}
          onOpen={handleOpenTill}
        />
      )}
      {showCloseModal && activeSession && (
        <CloseTillModal
          session={activeSession}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseTill}
        />
      )}
    </FeatureGate>
  );
}
