import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  Edit2,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { BranchMetrics, RestaurantBranch } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

function foodCostStatus(pct: number | null): { color: string; icon: string; label: string } {
  if (pct === null) return { color: 'text-slate-400', icon: '—', label: 'N/A' };
  if (pct <= 30) return { color: 'text-emerald-400', icon: '✓', label: `${pct.toFixed(1)}%` };
  if (pct <= 35) return { color: 'text-amber-400', icon: '⚠', label: `${pct.toFixed(1)}%` };
  return { color: 'text-red-400', icon: '✗', label: `${pct.toFixed(1)}%` };
}

function ratingStars(rating: number | null): string {
  if (rating === null) return '—';
  return `⭐${rating.toFixed(1)}`;
}

// ── Branch Form Modal ─────────────────────────────────────────────────────────

interface BranchFormModalProps {
  branch: Partial<RestaurantBranch> | null;
  onClose: () => void;
  onSave: (data: Partial<RestaurantBranch>) => Promise<void>;
}

function BranchFormModal({ branch, onClose, onSave }: BranchFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<RestaurantBranch>>(branch ?? {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error(t('restaurant.branches.nameRequired', 'Branch name is required'));
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {branch?.id
              ? t('restaurant.branches.editBranch', 'Edit Branch')
              : t('restaurant.branches.addBranch', 'Add Branch')}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/60">
              {t('restaurant.branches.branchName', 'Branch Name')} *
            </label>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
              placeholder={t('restaurant.branches.namePlaceholder', 'e.g. Hamra Branch')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/60">
              {t('restaurant.branches.branchNameAr', 'Arabic Name')}
            </label>
            <input
              dir="rtl"
              value={form.name_ar ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
              placeholder="مثال: فرع الحمرا"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/60">
              {t('restaurant.branches.address', 'Address')}
            </label>
            <input
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
              placeholder={t('restaurant.branches.addressPlaceholder', 'Street, Area, City')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-white/60">
                {t('restaurant.branches.phone', 'Phone')}
              </label>
              <input
                value={form.phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                placeholder="+961 1 XXX XXX"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/60">WhatsApp</label>
              <input
                value={form.whatsapp ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                placeholder="+961 7X XXX XXX"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-white/60">
              {t('restaurant.branches.active', 'Active')}
            </label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_active: !(f.is_active ?? true) }))}
              className={`relative h-6 w-10 rounded-full transition-colors ${
                (form.is_active ?? true) ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  (form.is_active ?? true) ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving
              ? t('common.saving', 'Saving...')
              : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Branch Comparison Card ────────────────────────────────────────────────────

interface BranchCardProps {
  branch: RestaurantBranch;
  metrics: BranchMetrics | undefined;
  isTop: boolean;
  onViewDetails: (id: string) => void;
  onEdit: (branch: RestaurantBranch) => void;
}

function BranchCard({ branch, metrics, isTop, onViewDetails, onEdit }: BranchCardProps) {
  const { t } = useTranslation();
  const fc = foodCostStatus(metrics?.food_cost_pct ?? null);

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all backdrop-blur-md shadow-2xl ${
        isTop
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-yellow-500/5 shadow-amber-500/15'
          : 'border-white/10 bg-gradient-to-br from-white/8 to-white/3 hover:border-white/20'
      }`}
    >
      {isTop && (
        <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
          <Trophy className="h-3 w-3" />
          {t('restaurant.branches.topPerformer', 'Top Performer')}
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-white">{branch.name}</h3>
          {branch.name_ar && <p className="text-sm text-white/40" dir="rtl">{branch.name_ar}</p>}
          {branch.address && (
            <p className="mt-0.5 text-xs text-white/40">{branch.address}</p>
          )}
        </div>
        <button
          onClick={() => onEdit(branch)}
          className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white/60"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{t('restaurant.branches.revenue', 'Revenue')}</span>
          <span className="text-sm font-semibold text-white">
            ${(metrics?.total_revenue_usd ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{t('restaurant.branches.covers', 'Covers')}</span>
          <span className="text-sm text-white/80">{metrics?.total_covers ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{t('restaurant.branches.avgTicket', 'Avg ticket')}</span>
          <span className="text-sm text-white/80">
            ${(metrics?.avg_ticket_usd ?? 0).toFixed(1)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{t('restaurant.branches.foodCost', 'Food cost')}</span>
          <span className={`text-sm font-medium ${fc.color}`}>
            {fc.icon} {fc.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{t('restaurant.branches.rating', 'Rating')}</span>
          <span className="text-sm text-amber-400">
            {ratingStars(metrics?.customer_rating_avg ?? null)}
          </span>
        </div>
      </div>

      {/* Contact strip */}
      {(branch.phone ?? branch.whatsapp) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {branch.phone && (
            <a
              href={`tel:${branch.phone}`}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            >
              <Phone className="h-3 w-3" />
              {branch.phone}
            </a>
          )}
        </div>
      )}

      <button
        onClick={() => onViewDetails(branch.id)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-all"
      >
        {t('restaurant.branches.viewDetails', 'View Details')}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Revenue Bar Chart for last 7 days (demo data) ────────────────────────────

function RevenueComparisonChart({ branches, metricsMap }: {
  branches: RestaurantBranch[];
  metricsMap: Record<string, BranchMetrics>;
}) {
  const { t } = useTranslation();

  const data = branches.map((b) => ({
    name: b.name,
    revenue: metricsMap[b.id]?.total_revenue_usd ?? 0,
    delivery: metricsMap[b.id]?.delivery_revenue_usd ?? 0,
    argile: metricsMap[b.id]?.argile_revenue_usd ?? 0,
  }));

  const COLORS = ['#6366f1', '#38bdf8', '#34d399'];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
        {t('restaurant.branches.revenueByBranch', 'Revenue by Branch (Today)')}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: 'white' }}
            formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
          />
          <Bar dataKey="revenue" name={t('restaurant.branches.dineIn', 'Dine-in')} radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Food Cost Comparison ──────────────────────────────────────────────────────

function FoodCostChart({ branches, metricsMap }: {
  branches: RestaurantBranch[];
  metricsMap: Record<string, BranchMetrics>;
}) {
  const { t } = useTranslation();

  const data = branches
    .map((b) => ({
      name: b.name,
      pct: metricsMap[b.id]?.food_cost_pct ?? 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  const getColor = (pct: number) => {
    if (pct <= 30) return '#34d399';
    if (pct <= 35) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
        {t('restaurant.branches.foodCostByBranch', 'Food Cost % by Branch')}
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 50]} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} width={90} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            formatter={(value: number) => [`${value}%`, t('restaurant.branches.foodCost', 'Food Cost')]}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={getColor(d.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-white/40">
        {t('restaurant.branches.foodCostBenchmark', 'Target: ≤30% (green), 30-35% (amber), >35% needs attention')}
      </p>
    </div>
  );
}

// ── Service Time Chart ────────────────────────────────────────────────────────

function ServiceTimeChart({ branches, metricsMap }: {
  branches: RestaurantBranch[];
  metricsMap: Record<string, BranchMetrics>;
}) {
  const { t } = useTranslation();

  const data = branches.map((b) => ({
    name: b.name,
    minutes: metricsMap[b.id]?.avg_service_minutes ?? 0,
  }));

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
        {t('restaurant.branches.avgServiceTime', 'Avg Service Time (min)')}
      </h3>
      <p className="mb-4 text-xs text-white/40">
        {t('restaurant.branches.lowerIsBetter', 'Lower is better')}
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} unit=" min" />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            formatter={(value: number) => [`${value} min`, t('restaurant.branches.serviceTime', 'Service Time')]}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="#818cf8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Rating Chart ──────────────────────────────────────────────────────────────

function RatingChart({ branches, metricsMap }: {
  branches: RestaurantBranch[];
  metricsMap: Record<string, BranchMetrics>;
}) {
  const { t } = useTranslation();

  const data = branches.map((b) => ({
    name: b.name,
    rating: metricsMap[b.id]?.customer_rating_avg ?? 0,
  }));

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
        {t('restaurant.branches.customerRating', 'Customer Rating by Branch')}
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
          <YAxis domain={[0, 5]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            formatter={(value: number) => [`⭐ ${value.toFixed(1)}`, t('restaurant.branches.rating', 'Rating')]}
          />
          <Bar dataKey="rating" radius={[4, 4, 0, 0]} fill="#fbbf24" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MultiBranchHub() {
  const { t } = useTranslation();
  const { employees, currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, BranchMetrics>>({});
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<RestaurantBranch | null>(null);
  const [addingBranch, setAddingBranch] = useState(false);

  const loadBranches = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_branches')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setBranches(data as RestaurantBranch[]);

        // Load today's metrics for each branch
        const today = new Date().toISOString().slice(0, 10);
        const { data: mData } = await supabase
          .from('restaurant_branch_metrics')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('metric_date', today);

        if (mData) {
          const map: Record<string, BranchMetrics> = {};
          for (const m of mData as BranchMetrics[]) {
            map[m.branch_id] = m;
          }
          setMetricsMap(map);
        }
      }
    } catch {
      setBranches([]);
      setMetricsMap({});
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const activeBranches = branches.filter((b) => b.is_active);

  // Determine top performer by revenue
  const topBranchId = activeBranches.reduce(
    (best, b) => {
      const rev = metricsMap[b.id]?.total_revenue_usd ?? 0;
      const bestRev = metricsMap[best]?.total_revenue_usd ?? 0;
      return rev > bestRev ? b.id : best;
    },
    activeBranches[0]?.id ?? '',
  );

  const displayedBranches =
    selectedBranch === 'all'
      ? activeBranches
      : activeBranches.filter((b) => b.id === selectedBranch);

  // Aggregate totals
  const totalRevenue = activeBranches.reduce(
    (sum, b) => sum + (metricsMap[b.id]?.total_revenue_usd ?? 0),
    0,
  );
  const totalCovers = activeBranches.reduce(
    (sum, b) => sum + (metricsMap[b.id]?.total_covers ?? 0),
    0,
  );
  const totalOrders = activeBranches.reduce(
    (sum, b) => sum + (metricsMap[b.id]?.total_orders ?? 0),
    0,
  );
  const avgRating =
    activeBranches.reduce((sum, b) => sum + (metricsMap[b.id]?.customer_rating_avg ?? 0), 0) /
    (activeBranches.length || 1);

  const handleSaveBranch = async (data: Partial<RestaurantBranch>) => {
    if (!tenantId) return;
    if (editingBranch?.id) {
      const { error } = await supabase
        .from('restaurant_branches')
        .update(data)
        .eq('id', editingBranch.id);
      if (error) throw new Error(error.message);
      toast.success(t('restaurant.branches.branchUpdated', 'Branch updated'));
    } else {
      const { error } = await supabase
        .from('restaurant_branches')
        .insert({ ...data, tenant_id: tenantId });
      if (error) throw new Error(error.message);
      toast.success(t('restaurant.branches.branchAdded', 'Branch added'));
    }
    await loadBranches();
  };

  const getManagerName = (employeeId: string | null) => {
    if (!employeeId) return null;
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? emp.name : null;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-white/60">{t('common.loading', 'Loading...')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen p-4 md:p-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/10">
              <Building2 className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {t('restaurant.branches.title', 'Multi-Branch Command Center')}
              </h1>
              <p className="text-sm text-white/50">
                {t('restaurant.branches.subtitle', 'Real-time view across all your restaurant locations')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadBranches()}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              {t('common.refresh', 'Refresh')}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/20 transition-all"
            >
              <Settings className="h-4 w-4" />
              {t('restaurant.branches.branchSettings', 'Branch Settings')}
            </button>
          </div>
        </div>

        {/* ── Aggregate KPI Strip ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: t('restaurant.branches.totalRevenue', 'Total Revenue'),
              value: `$${totalRevenue.toLocaleString()}`,
              icon: TrendingUp,
              iconClass: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
            },
            {
              label: t('restaurant.branches.totalCovers', 'Total Covers'),
              value: totalCovers.toLocaleString(),
              icon: Users,
              iconClass: 'from-sky-500/20 to-sky-500/5 text-sky-400',
            },
            {
              label: t('restaurant.branches.totalOrders', 'Total Orders'),
              value: totalOrders.toLocaleString(),
              icon: CheckCircle,
              iconClass: 'from-amber-500/20 to-yellow-500/5 text-amber-400',
            },
            {
              label: t('restaurant.branches.avgRating', 'Avg Rating'),
              value: `⭐ ${avgRating.toFixed(1)}`,
              icon: Star,
              iconClass: 'from-amber-500/20 to-yellow-500/5 text-amber-400',
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4"
            >
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.iconClass}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">{kpi.value}</p>
              <p className="text-xs text-white/50 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ── Branch Selector Tabs ── */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedBranch('all')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              selectedBranch === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-lg shadow-amber-500/20'
                : 'border border-white/20 text-white/60 hover:bg-white/5'
            }`}
          >
            {t('restaurant.branches.allBranches', 'All Branches')}
          </button>
          {activeBranches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                selectedBranch === b.id
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-lg shadow-amber-500/20'
                  : 'border border-white/20 text-white/60 hover:bg-white/5'
              }`}
            >
              {b.name}
              {b.id === topBranchId && (
                <Trophy className="ml-1.5 inline h-3 w-3 text-amber-400" />
              )}
            </button>
          ))}
        </div>

        {/* ── Branch Comparison Cards ── */}
        {activeBranches.length === 0 ? (
          <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 py-16 text-center">
            <Building2 className="mb-4 h-10 w-10 text-white/20" />
            <p className="text-lg font-semibold text-white/40">
              {t('restaurant.branches.noBranches', 'No branches configured')}
            </p>
            <p className="mt-1 text-sm text-white/25">
              {t('restaurant.branches.noBranchesHint', 'Add your first branch location to get started')}
            </p>
            <button
              onClick={() => { setEditingBranch(null); setSettingsOpen(true); }}
              className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              {t('restaurant.branches.addFirstBranch', '+ Add Branch')}
            </button>
          </div>
        ) : (
          <div
            className={`mb-8 grid gap-4 ${
              displayedBranches.length === 1
                ? 'max-w-sm'
                : displayedBranches.length === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayedBranches.map((b) => (
              <BranchCard
                key={b.id}
                branch={b}
                metrics={metricsMap[b.id]}
                isTop={b.id === topBranchId && selectedBranch === 'all'}
                onViewDetails={(id) => setSelectedBranch(id)}
                onEdit={setEditingBranch}
              />
            ))}
          </div>
        )}

        {/* ── Charts (only in "All Branches" mode) ── */}
        {selectedBranch === 'all' && activeBranches.length > 1 && (
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <RevenueComparisonChart branches={activeBranches} metricsMap={metricsMap} />
            <FoodCostChart branches={activeBranches} metricsMap={metricsMap} />
            <ServiceTimeChart branches={activeBranches} metricsMap={metricsMap} />
            <RatingChart branches={activeBranches} metricsMap={metricsMap} />
          </div>
        )}

        {/* ── Cross-Branch Leaderboard ── */}
        {selectedBranch === 'all' && (
          <div className="mb-8 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
              {t('restaurant.branches.leaderboard', 'Cross-Branch Leaderboard')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Top Revenue Branch */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">
                    {t('restaurant.branches.topRevenue', 'Highest Revenue')}
                  </span>
                </div>
                <p className="text-lg font-bold text-white">
                  {activeBranches.find((b) => b.id === topBranchId)?.name ?? '—'}
                </p>
                <p className="text-sm text-white/60">
                  ${(metricsMap[topBranchId]?.total_revenue_usd ?? 0).toLocaleString()}
                </p>
              </div>

              {/* Best Food Cost Branch */}
              {(() => {
                const bestFCBranch = activeBranches.reduce(
                  (best, b) => {
                    const fc = metricsMap[b.id]?.food_cost_pct ?? 999;
                    const bestFc = metricsMap[best]?.food_cost_pct ?? 999;
                    return fc < bestFc ? b.id : best;
                  },
                  activeBranches[0]?.id ?? '',
                );
                return (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">
                        {t('restaurant.branches.bestFoodCost', 'Best Food Cost')}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {activeBranches.find((b) => b.id === bestFCBranch)?.name ?? '—'}
                    </p>
                    <p className="text-sm text-white/60">
                      {(metricsMap[bestFCBranch]?.food_cost_pct ?? 0).toFixed(1)}% food cost
                    </p>
                  </div>
                );
              })()}

              {/* Best Rating Branch */}
              {(() => {
                const bestRatingBranch = activeBranches.reduce(
                  (best, b) => {
                    const r = metricsMap[b.id]?.customer_rating_avg ?? 0;
                    const bestR = metricsMap[best]?.customer_rating_avg ?? 0;
                    return r > bestR ? b.id : best;
                  },
                  activeBranches[0]?.id ?? '',
                );
                return (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4 text-sky-400" />
                      <span className="text-sm font-medium text-sky-400">
                        {t('restaurant.branches.topRated', 'Top Rated')}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {activeBranches.find((b) => b.id === bestRatingBranch)?.name ?? '—'}
                    </p>
                    <p className="text-sm text-white/60">
                      ⭐ {(metricsMap[bestRatingBranch]?.customer_rating_avg ?? 0).toFixed(1)} avg rating
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Branches Needing Attention ── */}
        {selectedBranch === 'all' && (() => {
          const warnings = activeBranches.filter(
            (b) => (metricsMap[b.id]?.food_cost_pct ?? 0) > 35,
          );
          const slowService = activeBranches.filter(
            (b) => (metricsMap[b.id]?.avg_service_minutes ?? 0) > 55,
          );
          const lowRating = activeBranches.filter(
            (b) => (metricsMap[b.id]?.customer_rating_avg ?? 5) < 4.0,
          );
          const allAlerts = [
            ...warnings.map((b) => ({ branch: b, type: 'food_cost' as const })),
            ...slowService.map((b) => ({ branch: b, type: 'service' as const })),
            ...lowRating.map((b) => ({ branch: b, type: 'rating' as const })),
          ];

          if (allAlerts.length === 0) return null;

          return (
            <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h3 className="font-semibold text-red-400">
                  {t('restaurant.branches.needsAttention', 'Needs Attention')}
                </h3>
              </div>
              <div className="space-y-2">
                {allAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                    <span className="font-medium text-white">{alert.branch.name}</span>
                    <span className="text-sm text-red-300">
                      {alert.type === 'food_cost' &&
                        `Food cost ${(metricsMap[alert.branch.id]?.food_cost_pct ?? 0).toFixed(1)}% — above 35% target`}
                      {alert.type === 'service' &&
                        `Avg service ${(metricsMap[alert.branch.id]?.avg_service_minutes ?? 0).toFixed(0)} min — too slow`}
                      {alert.type === 'rating' &&
                        `Rating ⭐${(metricsMap[alert.branch.id]?.customer_rating_avg ?? 0).toFixed(1)} — below 4.0`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Settings Panel ── */}
        {settingsOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                  {t('restaurant.branches.branchSettings', 'Branch Settings')}
                </h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-white">{b.name}</p>
                      <p className="text-xs text-white/40">{b.address ?? '—'}</p>
                      {b.manager_employee_id && (
                        <p className="text-xs text-white/40">
                          {t('restaurant.branches.manager', 'Manager')}: {getManagerName(b.manager_employee_id) ?? '—'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          b.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {b.is_active
                          ? t('restaurant.branches.active', 'Active')
                          : t('restaurant.branches.inactive', 'Inactive')}
                      </span>
                      <button
                        onClick={() => { setEditingBranch(b); setSettingsOpen(false); }}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setAddingBranch(true); setSettingsOpen(false); }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm text-white/60 hover:border-indigo-500/50 hover:text-indigo-400"
              >
                <Plus className="h-4 w-4" />
                {t('restaurant.branches.addBranch', 'Add Branch')}
              </button>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setAddingBranch(true); setSettingsOpen(false); }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  {t('restaurant.branches.newBranch', 'New Branch')}
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Branch Form Modals ── */}
        {(editingBranch ?? addingBranch) && (
          <BranchFormModal
            branch={editingBranch ?? {}}
            onClose={() => { setEditingBranch(null); setAddingBranch(false); }}
            onSave={handleSaveBranch}
          />
        )}
      </div>
    </Layout>
  );
}
