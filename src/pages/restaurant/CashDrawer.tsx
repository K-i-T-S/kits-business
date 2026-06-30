import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  RefreshCw,
  X,
  Plus,
  Minus,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';
import type { CashSession, CashMovement } from '@/types/restaurant';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUSD(v: number): string {
  return `$${v.toFixed(2)}`;
}

function fmtLBP(v: number): string {
  return `L.L. ${Math.round(v).toLocaleString()}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtElapsed(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Movement type config ─────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<CashMovement['movement_type'], string> = {
  sale: 'Sale',
  refund: 'Refund',
  expense: 'Expense',
  float_add: 'Float Add',
  float_remove: 'Float Remove',
  tip_out: 'Tip Out',
};

const MOVEMENT_INCOME_TYPES: ReadonlyArray<CashMovement['movement_type']> = [
  'sale',
  'float_add',
];

function isIncoming(type: CashMovement['movement_type']): boolean {
  return MOVEMENT_INCOME_TYPES.includes(type);
}

// ─── Open Drawer Modal ────────────────────────────────────────────────────────

interface OpenDrawerModalProps {
  onClose: () => void;
  onOpen: (floatUSD: number, floatLBP: number) => Promise<void>;
}

function OpenDrawerModal({ onClose, onOpen }: OpenDrawerModalProps) {
  const [floatUSD, setFloatUSD] = useState('0.00');
  const [floatLBP, setFloatLBP] = useState('0');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onOpen(parseFloat(floatUSD) || 0, parseFloat(floatLBP) || 0);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open drawer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            Open Drawer
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-white/60 mb-5">
          Enter the opening float — cash already in the drawer before the shift begins.
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
            {loading ? 'Opening...' : 'Open Drawer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Movement Form Modal ──────────────────────────────────────────────────────

interface MovementType {
  type: CashMovement['movement_type'];
  label: string;
}

interface MovementModalProps {
  movementType: MovementType;
  onClose: () => void;
  onSave: (
    type: CashMovement['movement_type'],
    amountUSD: number,
    amountLBP: number,
    description: string,
  ) => Promise<void>;
}

function MovementModal({ movementType, onClose, onSave }: MovementModalProps) {
  const [amountUSD, setAmountUSD] = useState('0.00');
  const [amountLBP, setAmountLBP] = useState('0');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const usd = parseFloat(amountUSD) || 0;
    const lbp = parseFloat(amountLBP) || 0;
    if (usd === 0 && lbp === 0) {
      toast.error('Enter an amount in USD or LBP');
      return;
    }
    setLoading(true);
    try {
      await onSave(movementType.type, usd, lbp, description);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save movement');
    } finally {
      setLoading(false);
    }
  };

  const incoming = isIncoming(movementType.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {incoming
              ? <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
              : <ArrowDownCircle className="w-5 h-5 text-red-400" />}
            {movementType.label}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Amount (USD)</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Amount (LBP)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={amountLBP}
              onChange={(e) => setAmountLBP(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Supplier payment, tip distribution..."
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
            className={`flex-1 py-2 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60 ${
              incoming
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                : 'bg-gradient-to-r from-red-600 to-red-500'
            }`}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Close Drawer Modal ───────────────────────────────────────────────────────

interface CloseDrawerModalProps {
  session: CashSession;
  netMovementsUSD: number;
  netMovementsLBP: number;
  onClose: () => void;
  onConfirm: (
    countUSD: number,
    countLBP: number,
    expectedUSD: number,
    expectedLBP: number,
    varianceUSD: number,
    notes: string,
  ) => Promise<void>;
}

function CloseDrawerModal({
  session,
  netMovementsUSD,
  netMovementsLBP,
  onClose,
  onConfirm,
}: CloseDrawerModalProps) {
  const [countUSD, setCountUSD] = useState('');
  const [countLBP, setCountLBP] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const expectedUSD = session.opening_float_usd + netMovementsUSD;
  const expectedLBP = session.opening_float_lbp + netMovementsLBP;

  const physicalUSD = parseFloat(countUSD) || 0;
  const physicalLBP = parseFloat(countLBP) || 0;
  const varianceUSD = physicalUSD - expectedUSD;

  const hasCount = countUSD !== '' || countLBP !== '';

  const handleConfirm = async () => {
    if (!hasCount) {
      toast.error('Enter the physical cash count before closing');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(physicalUSD, physicalLBP, expectedUSD, expectedLBP, varianceUSD, notes);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close drawer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            Close Drawer
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Expected summary */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-3">Expected in Drawer</p>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Opening Float (USD)</span>
              <span className="font-mono text-white">{fmtUSD(session.opening_float_usd)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Net Movements (USD)</span>
              <span className={`font-mono ${netMovementsUSD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netMovementsUSD >= 0 ? '+' : ''}{fmtUSD(netMovementsUSD)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-2 mt-2">
              <span className="text-white">Expected Total (USD)</span>
              <span className="font-mono text-white">{fmtUSD(expectedUSD)}</span>
            </div>
            {expectedLBP > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-white">Expected Total (LBP)</span>
                <span className="font-mono text-white">{fmtLBP(expectedLBP)}</span>
              </div>
            )}
          </div>

          {/* Physical count inputs */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Physical Count (USD)</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={countUSD}
              onChange={(e) => setCountUSD(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Physical Count (LBP)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={countLBP}
              onChange={(e) => setCountLBP(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>

          {/* Variance preview */}
          {hasCount && (
            <div className={`rounded-xl p-4 border ${
              Math.abs(varianceUSD) < 1
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : varianceUSD > 0
                  ? 'bg-sky-500/10 border-sky-500/30'
                  : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">USD Variance</span>
                <span className={`font-mono font-semibold text-sm ${
                  Math.abs(varianceUSD) < 1
                    ? 'text-emerald-400'
                    : varianceUSD > 0
                      ? 'text-sky-400'
                      : 'text-red-400'
                }`}>
                  {varianceUSD >= 0 ? '+' : ''}{fmtUSD(varianceUSD)}
                  {' '}
                  {Math.abs(varianceUSD) < 1
                    ? '(balanced)'
                    : varianceUSD > 0
                      ? '(over)'
                      : '(short)'}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Discrepancies, comments..."
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={loading || !hasCount}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {loading ? 'Closing...' : 'Close Drawer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant: 'in' | 'out' | 'neutral';
}

function QuickAction({ label, icon, onClick, variant }: QuickActionProps) {
  const colors = {
    in: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    out: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
    neutral: 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${colors[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CashDrawer() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id ?? '';

  const [session, setSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [activeMovementType, setActiveMovementType] = useState<{
    type: CashMovement['movement_type'];
    label: string;
  } | null>(null);

  // ── Computed net movements ─────────────────────────────────────────────────

  const netMovementsUSD = movements.reduce((sum, m) => {
    const sign = isIncoming(m.movement_type) ? 1 : -1;
    return sum + sign * m.amount_usd;
  }, 0);

  const netMovementsLBP = movements.reduce((sum, m) => {
    const sign = isIncoming(m.movement_type) ? 1 : -1;
    return sum + sign * m.amount_lbp;
  }, 0);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      // Load open session
      const { data: sessionData, error: sessionErr } = await supabase
        .from('restaurant_cash_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionErr) throw sessionErr;

      const openSession = sessionData as CashSession | null;
      setSession(openSession);

      // Load today's movements if session is open
      if (openSession) {
        const { data: movData, error: movErr } = await supabase
          .from('restaurant_cash_movements')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('session_id', openSession.id)
          .order('created_at', { ascending: true });

        if (movErr) throw movErr;
        setMovements((movData ?? []) as CashMovement[]);
      } else {
        setMovements([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cash data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Open drawer ────────────────────────────────────────────────────────────

  async function handleOpenDrawer(floatUSD: number, floatLBP: number): Promise<void> {
    const { error: err } = await supabase
      .from('restaurant_cash_sessions')
      .insert({
        tenant_id: tenantId,
        opening_float_usd: floatUSD,
        opening_float_lbp: floatLBP,
        status: 'open',
      });

    if (err) throw err;
    toast.success('Cash drawer opened');
    await loadData();
  }

  // ── Add movement ───────────────────────────────────────────────────────────

  async function handleAddMovement(
    type: CashMovement['movement_type'],
    amountUSD: number,
    amountLBP: number,
    description: string,
  ): Promise<void> {
    if (!session) return;

    const { error: err } = await supabase
      .from('restaurant_cash_movements')
      .insert({
        tenant_id: tenantId,
        session_id: session.id,
        movement_type: type,
        amount_usd: amountUSD,
        amount_lbp: amountLBP,
        description: description || null,
      });

    if (err) throw err;
    toast.success(`${MOVEMENT_LABELS[type]} recorded`);
    await loadData();
  }

  // ── Close drawer ───────────────────────────────────────────────────────────

  async function handleCloseDrawer(
    countUSD: number,
    countLBP: number,
    expectedUSD: number,
    expectedLBP: number,
    varianceUSD: number,
    notes: string,
  ): Promise<void> {
    if (!session) return;

    const { error: err } = await supabase
      .from('restaurant_cash_sessions')
      .update({
        closed_at: new Date().toISOString(),
        status: 'closed',
        closing_count_usd: countUSD,
        closing_count_lbp: countLBP,
        expected_usd: expectedUSD,
        expected_lbp: expectedLBP,
        variance_usd: varianceUSD,
        notes: notes || null,
      })
      .eq('id', session.id)
      .eq('tenant_id', tenantId);

    if (err) throw err;
    toast.success('Drawer closed and reconciled');
    await loadData();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wallet className="w-7 h-7 text-indigo-400" />
              Cash Drawer
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Track opening float, cash in/out, and end-of-shift reconciliation
            </p>
          </div>
          <button
            onClick={() => void loadData()}
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
            {session ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-semibold text-sm">Drawer Open</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Open since {fmtTime(session.opened_at)} ({fmtElapsed(session.opened_at)})
                      </span>
                      <span>
                        Float:{' '}
                        <span className="text-white font-mono">{fmtUSD(session.opening_float_usd)}</span>
                        {session.opening_float_lbp > 0 && (
                          <> + <span className="text-white font-mono">{fmtLBP(session.opening_float_lbp)}</span></>
                        )}
                      </span>
                      <span>
                        Running:{' '}
                        <span className={`font-mono font-medium ${netMovementsUSD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {netMovementsUSD >= 0 ? '+' : ''}{fmtUSD(netMovementsUSD)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    Close Drawer
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">No Active Session</p>
                  <p className="text-white/50 text-sm mt-0.5">
                    Open the drawer at the start of your shift to track cash.
                  </p>
                </div>
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  Open Drawer
                </button>
              </div>
            )}

            {/* ── Cash In / Out Panel ───────────────────────────────────── */}
            {session && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                  Quick Actions
                </h2>
                <div className="flex flex-wrap gap-3">
                  <QuickAction
                    label="Add Cash"
                    icon={<Plus className="w-4 h-4" />}
                    variant="in"
                    onClick={() => setActiveMovementType({ type: 'float_add', label: 'Add Cash' })}
                  />
                  <QuickAction
                    label="Remove Cash"
                    icon={<Minus className="w-4 h-4" />}
                    variant="out"
                    onClick={() => setActiveMovementType({ type: 'float_remove', label: 'Remove Cash' })}
                  />
                  <QuickAction
                    label="Record Expense"
                    icon={<ArrowDownCircle className="w-4 h-4" />}
                    variant="out"
                    onClick={() => setActiveMovementType({ type: 'expense', label: 'Expense' })}
                  />
                  <QuickAction
                    label="Tip Out"
                    icon={<ArrowDownCircle className="w-4 h-4" />}
                    variant="out"
                    onClick={() => setActiveMovementType({ type: 'tip_out', label: 'Tip Out' })}
                  />
                  <QuickAction
                    label="Record Sale"
                    icon={<ArrowUpCircle className="w-4 h-4" />}
                    variant="in"
                    onClick={() => setActiveMovementType({ type: 'sale', label: 'Sale' })}
                  />
                  <QuickAction
                    label="Record Refund"
                    icon={<Minus className="w-4 h-4" />}
                    variant="out"
                    onClick={() => setActiveMovementType({ type: 'refund', label: 'Refund' })}
                  />
                </div>
              </div>
            )}

            {/* ── Today's Movements ─────────────────────────────────────── */}
            {session && (
              <div>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Session Movements
                </h2>

                {movements.length === 0 ? (
                  <div className="bg-white/5 rounded-xl px-5 py-8 text-center text-white/40 text-sm">
                    No movements recorded yet
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/5 text-start">
                          <th className="px-4 py-3 text-white/50 font-medium">Time</th>
                          <th className="px-4 py-3 text-white/50 font-medium">Type</th>
                          <th className="px-4 py-3 text-white/50 font-medium text-end">USD</th>
                          <th className="px-4 py-3 text-white/50 font-medium text-end">LBP</th>
                          <th className="px-4 py-3 text-white/50 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {movements.map((m) => {
                          const incoming = isIncoming(m.movement_type);
                          return (
                            <tr key={m.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 text-white/60 font-mono text-xs">
                                {fmtTime(m.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                                  incoming
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}>
                                  {incoming
                                    ? <ArrowUpCircle className="w-3 h-3" />
                                    : <ArrowDownCircle className="w-3 h-3" />}
                                  {MOVEMENT_LABELS[m.movement_type]}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-mono text-end ${
                                m.amount_usd > 0
                                  ? incoming ? 'text-emerald-400' : 'text-red-400'
                                  : 'text-white/30'
                              }`}>
                                {m.amount_usd > 0
                                  ? `${incoming ? '+' : '-'}${fmtUSD(m.amount_usd)}`
                                  : '—'}
                              </td>
                              <td className={`px-4 py-3 font-mono text-end text-xs ${
                                m.amount_lbp > 0
                                  ? incoming ? 'text-emerald-400' : 'text-red-400'
                                  : 'text-white/30'
                              }`}>
                                {m.amount_lbp > 0
                                  ? `${incoming ? '+' : '-'}${fmtLBP(m.amount_lbp)}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-white/60 text-xs">
                                {m.description ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showOpenModal && (
        <OpenDrawerModal
          onClose={() => setShowOpenModal(false)}
          onOpen={handleOpenDrawer}
        />
      )}
      {showCloseModal && session && (
        <CloseDrawerModal
          session={session}
          netMovementsUSD={netMovementsUSD}
          netMovementsLBP={netMovementsLBP}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseDrawer}
        />
      )}
      {activeMovementType && (
        <MovementModal
          movementType={activeMovementType}
          onClose={() => setActiveMovementType(null)}
          onSave={handleAddMovement}
        />
      )}
    </Layout>
  );
}
