import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { supabase } from '../utils/supabaseClient';

type SubscriptionPlan = 'starter' | 'growth' | 'business';
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  owner_email: string | null;
  user_count: number;
}

interface EditState {
  tenantId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  saving: boolean;
}

const PLAN_BADGE: Record<string, string> = {
  starter: 'bg-slate-700 text-slate-300 border border-slate-600',
  growth: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  business: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'text-emerald-400',
  trialing: 'text-sky-400',
  past_due: 'text-amber-400',
  canceled: 'text-red-400',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const VALID_PLANS: SubscriptionPlan[] = ['starter', 'growth', 'business'];
const VALID_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled'];

function toSafePlan(value: string): SubscriptionPlan {
  return (VALID_PLANS as string[]).includes(value) ? (value as SubscriptionPlan) : 'starter';
}

function toSafeStatus(value: string): SubscriptionStatus {
  return (VALID_STATUSES as string[]).includes(value) ? (value as SubscriptionStatus) : 'active';
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data, error: rpcError } = await supabase.rpc('admin_list_tenants');
      if (rpcError) throw rpcError;
      setTenants((data as TenantRow[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load tenants';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyAdmin = useCallback(async (): Promise<boolean> => {
    const { data } = await supabase.auth.getSession();
    const session = (data as { session: { user: { email: string } } | null }).session;
    if (session?.user?.email !== 'kits.tech.co@gmail.com') {
      void navigate('/dashboard');
      return false;
    }
    return true;
  }, [navigate]);

  useEffect(() => {
    void verifyAdmin().then((isAdmin) => {
      if (isAdmin) void fetchTenants();
    });
  }, [verifyAdmin, fetchTenants]);

  const openEdit = (tenant: TenantRow) => {
    setEditState({
      tenantId: tenant.id,
      plan: toSafePlan(tenant.subscription_plan),
      status: toSafeStatus(tenant.subscription_status),
      saving: false,
    });
  };

  const cancelEdit = () => setEditState(null);

  const handleSavePlan = () => {
    if (!editState) return;
    void (async () => {
      setEditState((prev) => (prev ? { ...prev, saving: true } : null));
      try {
        const { error: rpcError } = await supabase.rpc('admin_set_tenant_plan', {
          p_tenant_id: editState.tenantId,
          p_plan: editState.plan,
          p_status: editState.status,
        });
        if (rpcError) throw rpcError;
        toast.success('Plan updated successfully');
        setEditState(null);
        await fetchTenants();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update plan';
        toast.error(message);
        setEditState((prev) => (prev ? { ...prev, saving: false } : null));
      }
    })();
  };

  const handleRefresh = () => {
    void fetchTenants();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30">
              <Shield className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">KiTS Admin Panel</h1>
              <p className="text-xs text-white/40">Internal subscription management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning banner */}
      <div className="border-b border-amber-500/20 bg-amber-500/10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300">
              <strong className="font-semibold">Restricted area.</strong>{' '}
              This page is for KiTS staff only. Actions here directly affect tenant billing and feature access.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            All Tenants {!loading && tenants.length > 0 && `(${tenants.length})`}
          </h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-white/40">Loading tenants…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-sm font-medium text-red-400">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tenants table */}
        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Slug</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Owner Email</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Users</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-white/30">
                        No tenants found.
                      </td>
                    </tr>
                  )}
                  {tenants.map((tenant) => {
                    const isEditing = editState?.tenantId === tenant.id;
                    return (
                      <tr key={tenant.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{tenant.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/50">{tenant.slug}</td>
                        <td className="px-4 py-3 text-white/70">{tenant.owner_email ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-white/70">{tenant.user_count}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_BADGE[tenant.subscription_plan] ?? PLAN_BADGE['starter']}`}>
                            {tenant.subscription_plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium capitalize ${STATUS_BADGE[tenant.subscription_status] ?? 'text-white/40'}`}>
                            {tenant.subscription_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/50">{formatDate(tenant.created_at)}</td>
                        <td className="px-4 py-3">
                          {isEditing && editState ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex gap-2">
                                <select
                                  value={editState.plan}
                                  onChange={(e) =>
                                    setEditState((prev) =>
                                      prev ? { ...prev, plan: e.target.value as SubscriptionPlan } : null,
                                    )
                                  }
                                  className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-2 py-1.5 text-xs"
                                >
                                  <option value="starter">Starter</option>
                                  <option value="growth">Growth</option>
                                  <option value="business">Business</option>
                                </select>
                                <select
                                  value={editState.status}
                                  onChange={(e) =>
                                    setEditState((prev) =>
                                      prev ? { ...prev, status: e.target.value as SubscriptionStatus } : null,
                                    )
                                  }
                                  className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-2 py-1.5 text-xs"
                                >
                                  <option value="active">Active</option>
                                  <option value="trialing">Trialing</option>
                                  <option value="past_due">Past Due</option>
                                  <option value="canceled">Canceled</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSavePlan}
                                  disabled={editState.saving}
                                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                                >
                                  {editState.saving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={editState.saving}
                                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openEdit(tenant)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              Change Plan
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
