import { Award, ChevronDown, ChevronUp, Minus, Plus, Star, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useApp } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';
import { supabase } from '../utils/supabaseClient';

import FeatureGate from './FeatureGate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerPoints {
  id: string;
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold';
}

interface PointTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'adjusted' | 'expired';
  points: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

function computeTier(lifetimePoints: number): 'bronze' | 'silver' | 'gold' {
  if (lifetimePoints >= 2000) return 'gold';
  if (lifetimePoints >= 500) return 'silver';
  return 'bronze';
}

const TIER_STYLES: Record<'bronze' | 'silver' | 'gold', {
  label: string;
  badge: string;
  icon: string;
  bar: string;
  next: number | null;
}> = {
  bronze: {
    label: 'Bronze',
    badge: 'bg-amber-700/30 border-amber-600/40 text-amber-300',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
    next: 500,
  },
  silver: {
    label: 'Silver',
    badge: 'bg-slate-500/30 border-slate-400/40 text-slate-200',
    icon: 'text-slate-300',
    bar: 'bg-slate-400',
    next: 2000,
  },
  gold: {
    label: 'Gold',
    badge: 'bg-yellow-500/30 border-yellow-400/40 text-yellow-200',
    icon: 'text-yellow-400',
    bar: 'bg-yellow-400',
    next: null,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface LoyaltyPanelProps {
  customerId: string;
  customerName: string;
}

export default function LoyaltyPanel({ customerId, customerName }: LoyaltyPanelProps) {
  return (
    <FeatureGate feature="crm">
      <LoyaltyPanelInner customerId={customerId} customerName={customerName} />
    </FeatureGate>
  );
}

function LoyaltyPanelInner({ customerId, customerName }: LoyaltyPanelProps) {
  const { currentTenant } = useApp();
  const { canPerform } = useSubscription();
  const canAdjust = canPerform('manage_customers');

  const [pointsRow, setPointsRow] = useState<CustomerPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const redeemRate = currentTenant?.loyalty_points_redeem_rate ?? 0.01;

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchLoyalty = async () => {
    setLoadingPoints(true);
    try {
      const [pointsRes, txRes] = await Promise.all([
        supabase
          .from('customer_points')
          .select('id, points_balance, lifetime_points, tier')
          .eq('customer_id', customerId)
          .maybeSingle(),
        supabase
          .from('point_transactions')
          .select('id, type, points, balance_after, description, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (pointsRes.error) console.warn('[LoyaltyPanel] points fetch:', pointsRes.error.message);
      if (txRes.error) console.warn('[LoyaltyPanel] tx fetch:', txRes.error.message);

      setPointsRow(pointsRes.data as CustomerPoints | null);
      setTransactions((txRes.data ?? []) as PointTransaction[]);
    } finally {
      setLoadingPoints(false);
    }
  };

  useEffect(() => {
    void fetchLoyalty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const balance = pointsRow?.points_balance ?? 0;
  const lifetime = pointsRow?.lifetime_points ?? 0;
  const tier = computeTier(lifetime);
  const tierStyle = TIER_STYLES[tier];
  const pointsValue = (balance * redeemRate).toFixed(2);

  // Progress to next tier
  const prevThreshold = tier === 'silver' ? 500 : tier === 'gold' ? 2000 : 0;
  const nextThreshold = tierStyle.next;
  const progressPct = nextThreshold
    ? Math.min(100, Math.round(((lifetime - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;

  if (loadingPoints) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/50">
        Loading loyalty data…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Balance card ─── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${tierStyle.icon}`} />
            <p className="text-sm font-semibold text-white">Loyalty Points</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierStyle.badge}`}>
            <Trophy className="h-3 w-3" />
            {tierStyle.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-2xl font-bold text-white">{balance.toLocaleString()}</p>
            <p className="text-xs text-white/50 mt-0.5">Current balance</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-2xl font-bold text-white">{lifetime.toLocaleString()}</p>
            <p className="text-xs text-white/50 mt-0.5">Lifetime earned</p>
          </div>
        </div>

        <p className="text-xs text-white/60 text-center">
          {balance.toLocaleString()} points = <span className="text-white font-medium">${pointsValue}</span> value
        </p>

        {/* Tier progress */}
        {nextThreshold !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{tierStyle.label}</span>
              <span>{TIER_STYLES[tier === 'bronze' ? 'silver' : 'gold'].label} at {nextThreshold.toLocaleString()} pts</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${tierStyle.bar}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-white/40 text-right">{progressPct}%</p>
          </div>
        )}

        {/* Adjust button — owner/manager only */}
        {canAdjust && (
          <button
            onClick={() => setShowAdjustModal(true)}
            className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors"
          >
            Adjust Points
          </button>
        )}
      </div>

      {/* ── Transaction history ─── */}
      {transactions.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Points History</p>
          </div>
          <div className="divide-y divide-white/5">
            {transactions.map((tx) => {
              const isPositive = tx.type === 'earned' || (tx.type === 'adjusted' && tx.points > 0);
              const isNegative = tx.type === 'redeemed' || tx.type === 'expired' || (tx.type === 'adjusted' && tx.points < 0);
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                      isPositive ? 'bg-emerald-500/20' : isNegative ? 'bg-rose-500/20' : 'bg-white/10'
                    }`}>
                      {isPositive
                        ? <Plus className="h-3.5 w-3.5 text-emerald-400" />
                        : isNegative
                          ? <Minus className="h-3.5 w-3.5 text-rose-400" />
                          : <Award className="h-3.5 w-3.5 text-white/60" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white capitalize">{tx.type}</p>
                      {tx.description && (
                        <p className="text-xs text-white/50 truncate">{tx.description}</p>
                      )}
                      <p className="text-xs text-white/40">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-white/80'}`}>
                      {isPositive ? '+' : isNegative ? '-' : ''}{Math.abs(tx.points).toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40">{tx.balance_after.toLocaleString()} bal</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <Star className="mx-auto h-8 w-8 text-white/20 mb-2" />
          <p className="text-sm text-white/50">No transactions yet</p>
          <p className="text-xs text-white/30 mt-1">Points are earned automatically on each purchase</p>
        </div>
      )}

      {/* ── Adjust modal ─── */}
      {showAdjustModal && (
        <AdjustPointsModal
          customerId={customerId}
          customerName={customerName}
          currentBalance={balance}
          tenantId={currentTenant?.id ?? ''}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={() => {
            setShowAdjustModal(false);
            void fetchLoyalty();
          }}
        />
      )}
    </div>
  );
}

// ── Adjust Points Modal ───────────────────────────────────────────────────────

interface AdjustModalProps {
  customerId: string;
  customerName: string;
  currentBalance: number;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustPointsModal({ customerId, customerName, currentBalance, tenantId, onClose, onSuccess }: AdjustModalProps) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedDelta = parseInt(delta, 10);
  const isValid = !isNaN(parsedDelta) && parsedDelta !== 0;
  const newBalance = isValid ? Math.max(0, currentBalance + parsedDelta) : currentBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !tenantId) return;
    setLoading(true);
    setError(null);

    try {
      // Upsert customer_points row
      const { data: existing, error: fetchErr } = await supabase
        .from('customer_points')
        .select('id, points_balance, lifetime_points')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const prevBalance = existing?.points_balance ?? 0;
      const prevLifetime = existing?.lifetime_points ?? 0;
      const balanceAfter = Math.max(0, prevBalance + parsedDelta);
      const newLifetime = parsedDelta > 0 ? prevLifetime + parsedDelta : prevLifetime;

      const tier = balanceAfter >= 2000 ? 'gold' : balanceAfter >= 500 ? 'silver' : 'bronze';

      if (existing) {
        const { error: updateErr } = await supabase
          .from('customer_points')
          .update({
            points_balance: balanceAfter,
            lifetime_points: newLifetime,
            tier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('customer_points')
          .insert({
            tenant_id: tenantId,
            customer_id: customerId,
            points_balance: balanceAfter,
            lifetime_points: Math.max(0, parsedDelta),
            tier,
          });
        if (insertErr) throw insertErr;
      }

      // Log the transaction
      const { error: txErr } = await supabase
        .from('point_transactions')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          type: 'adjusted',
          points: parsedDelta,
          balance_after: balanceAfter,
          description: reason.trim() || 'Manual adjustment',
        });
      if (txErr) throw txErr;

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust points');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm space-y-5 p-6"
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '1.5rem',
          boxShadow: '0 35px 85px rgba(2,3,12,0.6)',
        }}
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Loyalty</p>
          <h3 className="text-lg font-bold text-white mt-0.5">Adjust Points</h3>
          <p className="text-sm text-white/60 mt-1">{customerName} — current balance: {currentBalance.toLocaleString()} pts</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Points change <span className="text-white/40">(negative to subtract)</span>
            </label>
            <div className="relative">
              {parsedDelta > 0 && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">
                  <ChevronUp className="h-4 w-4" />
                </span>
              )}
              {parsedDelta < 0 && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400">
                  <ChevronDown className="h-4 w-4" />
                </span>
              )}
              <input
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="e.g. 50 or -20"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 pl-9 text-sm text-white placeholder-white/40 focus:border-indigo-500/50 focus:outline-none"
                autoFocus
              />
            </div>
            {isValid && (
              <p className="text-xs text-white/50 mt-1">
                New balance: <span className={newBalance < currentBalance ? 'text-rose-400' : 'text-emerald-400'}>{newBalance.toLocaleString()} pts</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1.5">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Goodwill credit, error correction…"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
