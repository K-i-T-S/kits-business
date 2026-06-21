import { ArrowLeft, DollarSign, Users, Percent, SlidersHorizontal, Save } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { supabase } from '@/utils/supabaseClient';
import { useApp } from '@/context/AppContext';

type AlgorithmId = 'waiter_full' | 'waiter_pool' | 'communal' | 'role_split';

interface RoleSplit {
  waiter: number;
  chef: number;
  cashier: number;
  busboy: number;
  manager: number;
  host: number;
}

interface TipsConfig {
  algorithm: AlgorithmId;
  waiterSharePct: number;
  roleSplit: RoleSplit;
}

interface TipRecord {
  id: string;
  date: string;
  totalTips: number;
  algorithm: AlgorithmId;
  breakdown: Array<{ name: string; amount: number }>;
}

const DEFAULT_CONFIG: TipsConfig = {
  algorithm: 'waiter_full',
  waiterSharePct: 70,
  roleSplit: { waiter: 50, chef: 20, cashier: 15, busboy: 10, manager: 0, host: 5 },
};

const ROLE_LABELS: Record<keyof RoleSplit, string> = {
  waiter: 'Waiter',
  chef: 'Chef',
  cashier: 'Cashier',
  busboy: 'Busboy',
  manager: 'Manager',
  host: 'Host',
};

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TipsManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant, employees } = useApp();
  const tenantId = currentTenant?.id ?? 'default';

  const storageKey = `tips_config_${tenantId}`;
  const recordsKey = `tips_records_${tenantId}`;

  const [config, setConfig] = useState<TipsConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as TipsConfig) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [todayTips, setTodayTips] = useState(0);
  const [loadingTips, setLoadingTips] = useState(false);
  const [records, setRecords] = useState<TipRecord[]>(() => {
    try {
      const saved = localStorage.getItem(recordsKey);
      return saved ? (JSON.parse(saved) as TipRecord[]) : [];
    } catch {
      return [];
    }
  });

  const saveConfig = () => {
    localStorage.setItem(storageKey, JSON.stringify(config));
    toast.success('Tips configuration saved');
  };

  const roleSplitTotal = Object.values(config.roleSplit).reduce((s, v) => s + v, 0);

  const loadTodayTips = useCallback(async () => {
    setLoadingTips(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0] ?? '';
      const { data } = await supabase
        .from('restaurant_order_items')
        .select('unit_price, quantity')
        .gte('sent_at', `${todayISO}T00:00:00`);
      const revenue = (data ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
      setTodayTips(revenue * 0.1);
    } catch {
      setTodayTips(0);
    } finally {
      setLoadingTips(false);
    }
  }, []);

  useEffect(() => { void loadTodayTips(); }, [loadTodayTips]);

  const breakdown = (() => {
    if (todayTips === 0) return [];
    const { algorithm, waiterSharePct, roleSplit } = config;
    const waiters = employees.filter(e => e.role === 'cashier');
    const allStaff = employees.slice(0, 8);

    if (algorithm === 'waiter_full') {
      if (waiters.length === 0) return [{ name: 'All waiters (share equally)', amount: todayTips }];
      const perWaiter = todayTips / waiters.length;
      return waiters.map(w => ({ name: w.name, amount: perWaiter }));
    }

    if (algorithm === 'waiter_pool') {
      const waiterShare = todayTips * (waiterSharePct / 100);
      const poolShare = todayTips - waiterShare;
      const perWaiter = waiters.length > 0 ? waiterShare / waiters.length : waiterShare;
      const perPool = allStaff.length > 0 ? poolShare / allStaff.length : poolShare;
      const result: Array<{ name: string; amount: number }> = [];
      waiters.forEach(w => result.push({ name: `${w.name} (waiter share)`, amount: perWaiter + perPool }));
      const nonWaiters = allStaff.filter(e => !waiters.some(w => w.id === e.id));
      nonWaiters.forEach(s => result.push({ name: `${s.name} (pool)`, amount: perPool }));
      return result;
    }

    if (algorithm === 'communal') {
      if (allStaff.length === 0) return [{ name: 'All staff (equal)', amount: todayTips }];
      const per = todayTips / allStaff.length;
      return allStaff.map(s => ({ name: s.name, amount: per }));
    }

    if (algorithm === 'role_split') {
      return (Object.entries(roleSplit) as Array<[keyof RoleSplit, number]>)
        .filter(([, pct]) => pct > 0)
        .map(([role, pct]) => ({
          name: `${ROLE_LABELS[role]} (${pct}%)`,
          amount: todayTips * (pct / 100),
        }));
    }

    return [];
  })();

  const recordTips = () => {
    if (todayTips === 0) {
      toast.error('No tips to record today');
      return;
    }
    const rec: TipRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-GB'),
      totalTips: todayTips,
      algorithm: config.algorithm,
      breakdown,
    };
    const updated = [rec, ...records].slice(0, 30);
    setRecords(updated);
    localStorage.setItem(recordsKey, JSON.stringify(updated));
    toast.success('Tips recorded for today');
  };

  const algorithms: Array<{ id: AlgorithmId; title: string; desc: string; icon: React.FC<{ className?: string }> }> = [
    {
      id: 'waiter_full',
      title: 'Waiter Keeps Full Tip',
      desc: 'Each waiter keeps 100% of tips from their served tables. No sharing.',
      icon: DollarSign,
    },
    {
      id: 'waiter_pool',
      title: 'Waiter % + Pool Rest',
      desc: `Waiter keeps ${config.waiterSharePct}% of their tips, rest goes to a shared staff pool.`,
      icon: Percent,
    },
    {
      id: 'communal',
      title: 'Full Communal Pool',
      desc: 'All tips pooled and split equally among all staff who worked the shift.',
      icon: Users,
    },
    {
      id: 'role_split',
      title: 'Role-Based Fixed Split',
      desc: 'Manager sets a fixed % allocation per role. Must total 100%.',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label={t('common.back', 'Back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 shadow-lg shadow-amber-500/10">
            <DollarSign className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('restaurant.tips.title', 'Tips Management')}</h1>
            <p className="text-xs text-white/35">{t('restaurant.tips.subtitle', 'Configure how tips are distributed among staff')}</p>
          </div>
          <button
            onClick={saveConfig}
            className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
          >
            <Save className="h-4 w-4" />
            {t('common.save', 'Save')}
          </button>
        </div>

        {/* Algorithm Cards */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
            {t('restaurant.tips.algorithm', 'Distribution Algorithm')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {algorithms.map(({ id, title, desc, icon: Icon }) => {
              const active = config.algorithm === id;
              return (
                <button
                  key={id}
                  onClick={() => setConfig(c => ({ ...c, algorithm: id }))}
                  className={`rounded-2xl border p-4 text-left transition-all shadow-2xl ${
                    active
                      ? 'border-amber-500/30 bg-amber-500/10 shadow-amber-500/10'
                      : 'backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      active
                        ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/15 text-amber-300'
                        : 'bg-gradient-to-br from-white/10 to-white/5 text-white/40'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-sm font-semibold ${active ? 'text-amber-200' : 'text-white/70'}`}>{title}</span>
                    {active && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{desc}</p>
                </button>
              );
            })}
          </div>

          {/* Waiter % config */}
          {config.algorithm === 'waiter_pool' && (
            <div className="mt-4 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
              <label className="block text-sm font-semibold text-white">
                Waiter's Share:{' '}
                <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent font-bold">
                  {config.waiterSharePct}%
                </span>
                <span className="ml-2 text-white/35 text-xs">(pool gets {100 - config.waiterSharePct}%)</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={config.waiterSharePct}
                onChange={e => setConfig(c => ({ ...c, waiterSharePct: Number(e.target.value) }))}
                className="w-full accent-amber-400"
              />
            </div>
          )}

          {/* Role split config */}
          {config.algorithm === 'role_split' && (
            <div className="mt-4 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Role Allocation</p>
                <span className={`text-sm font-bold ${roleSplitTotal === 100 ? 'text-green-400' : 'text-red-400'}`}>
                  Total: {roleSplitTotal}% {roleSplitTotal !== 100 && '⚠ must equal 100'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(config.roleSplit) as Array<keyof RoleSplit>).map(role => (
                  <div key={role}>
                    <label className="mb-1 block text-xs text-white/50">{ROLE_LABELS[role]}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={config.roleSplit[role]}
                        onChange={e => setConfig(c => ({
                          ...c,
                          roleSplit: { ...c.roleSplit, [role]: Number(e.target.value) },
                        }))}
                        className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                      />
                      <span className="text-white/40 text-sm">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Today's Tip Pool */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
            {t('restaurant.tips.todayPool', "Today's Tip Pool")}
          </h2>
          <div className="backdrop-blur-md bg-gradient-to-br from-amber-500/10 via-white/5 to-white/3 border border-amber-500/20 rounded-2xl shadow-2xl shadow-amber-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/60 mb-1">Estimated Tips (10% of revenue)</p>
                {loadingTips ? (
                  <div className="h-9 w-28 animate-pulse rounded-xl bg-white/10 mt-1" />
                ) : (
                  <p className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                    ${todayTips.toFixed(2)}
                  </p>
                )}
              </div>
              <button
                onClick={recordTips}
                disabled={todayTips === 0}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 disabled:opacity-40 hover:shadow-amber-500/30 transition-all"
              >
                Record Tips
              </button>
            </div>

            {breakdown.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/60">Breakdown</p>
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/65">{b.name}</span>
                    <span className="text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                      ${b.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {todayTips === 0 && !loadingTips && (
              <p className="text-xs text-white/25 text-center py-2">No orders recorded today yet</p>
            )}
          </div>
        </section>

        {/* Recent Records */}
        {records.length > 0 && (
          <section>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
              Recent Records
            </h2>
            <div className="space-y-2">
              {records.slice(0, 5).map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{r.date}</p>
                    <p className="text-xs text-white/40 capitalize">{capFirst(r.algorithm.replace(/_/g, ' '))}</p>
                  </div>
                  <p className="text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                    ${r.totalTips.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
