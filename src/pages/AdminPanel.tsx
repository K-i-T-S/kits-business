import { AlertTriangle, RefreshCw, Shield, Database, CreditCard, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { supabase } from '../utils/supabaseClient';

type SubscriptionPlan = 'starter' | 'growth' | 'business';
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
type ProvisionStatus = 'na' | 'pending' | 'provisioning' | 'provisioned' | 'failed';
type ActiveTab = 'subscriptions' | 'provisioning';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  owner_email: string | null;
  user_count: number;
  business_type: string | null;
  preferred_region: string | null;
  db_provision_status: string;
  standalone_supabase_url: string | null;
  db_provisioned_at: string | null;
}

interface EditState {
  tenantId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  saving: boolean;
}

interface ProvisionFormState {
  tenantId: string;
  supabaseUrl: string;
  anonKey: string;
  notes: string;
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

const PROVISION_BADGE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  na: { label: 'Shared DB', className: 'text-white/40', icon: Database },
  pending: { label: 'Awaiting Setup', className: 'text-amber-400', icon: Clock },
  provisioning: { label: 'Provisioning…', className: 'text-sky-400', icon: RefreshCw },
  provisioned: { label: 'Provisioned', className: 'text-emerald-400', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'text-red-400', icon: XCircle },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VALID_PLANS: SubscriptionPlan[] = ['starter', 'growth', 'business'];
const VALID_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled'];

function toSafePlan(value: string): SubscriptionPlan {
  return (VALID_PLANS as string[]).includes(value) ? (value as SubscriptionPlan) : 'starter';
}
function toSafeStatus(value: string): SubscriptionStatus {
  return (VALID_STATUSES as string[]).includes(value) ? (value as SubscriptionStatus) : 'active';
}
function toSafeProvision(value: string): ProvisionStatus {
  const valid: ProvisionStatus[] = ['na', 'pending', 'provisioning', 'provisioned', 'failed'];
  return valid.includes(value as ProvisionStatus) ? (value as ProvisionStatus) : 'na';
}

const DEFAULT_PROVISION_BADGE = { label: 'Shared DB', className: 'text-white/40', icon: Database };

function getProvisionBadge(status: string): { label: string; className: string; icon: typeof Database } {
  return PROVISION_BADGE[toSafeProvision(status)] ?? DEFAULT_PROVISION_BADGE;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [provisionForm, setProvisionForm] = useState<ProvisionFormState | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('subscriptions');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data, error: rpcError } = await supabase.rpc('admin_list_tenants');
      if (rpcError) throw rpcError;
      setTenants((data as TenantRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
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

  // ── Subscription tab ──────────────────────────────────────────────────────
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
        toast.error(err instanceof Error ? err.message : 'Failed to update plan');
        setEditState((prev) => (prev ? { ...prev, saving: false } : null));
      }
    })();
  };

  // ── Provisioning tab ──────────────────────────────────────────────────────
  const openProvisionForm = (tenant: TenantRow) => {
    setProvisionForm({
      tenantId: tenant.id,
      supabaseUrl: '',
      anonKey: '',
      notes: '',
      saving: false,
    });
  };

  const cancelProvision = () => setProvisionForm(null);

  const handleSaveProvision = () => {
    if (!provisionForm) return;
    if (!provisionForm.supabaseUrl.trim() || !provisionForm.anonKey.trim()) {
      toast.error('Supabase URL and Anon Key are required');
      return;
    }
    void (async () => {
      setProvisionForm((prev) => (prev ? { ...prev, saving: true } : null));
      try {
        const { error: rpcError } = await supabase.rpc('admin_provision_client', {
          p_tenant_id: provisionForm.tenantId,
          p_supabase_url: provisionForm.supabaseUrl.trim(),
          p_anon_key: provisionForm.anonKey.trim(),
          p_notes: provisionForm.notes.trim() || null,
        });
        if (rpcError) throw rpcError;
        toast.success('Client database provisioned!');
        setProvisionForm(null);
        await fetchTenants();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to save provisioning');
        setProvisionForm((prev) => (prev ? { ...prev, saving: false } : null));
      }
    })();
  };

  const pendingTenants = tenants.filter(t => t.db_provision_status === 'pending');
  const provisionedTenants = tenants.filter(t => t.db_provision_status === 'provisioned');
  const otherTenants = tenants.filter(t => !['pending', 'provisioned'].includes(t.db_provision_status));

  const selectClass = 'flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-2 py-1.5 text-xs';
  const inputClass = 'w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-xs placeholder-white/30 focus:outline-none focus:border-indigo-500';

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
              <p className="text-xs text-white/40">Internal subscription & database management</p>
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
              This page is for KiTS staff only. Actions here directly affect client billing, feature access, and database configuration.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-1 py-2">
            {([
              { id: 'subscriptions', label: 'Subscription Management', icon: CreditCard },
              { id: 'provisioning', label: `Database Provisioning${pendingTenants.length > 0 ? ` (${pendingTenants.length} pending)` : ''}`, icon: Database },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            {activeTab === 'subscriptions'
              ? `All Tenants${!loading && tenants.length > 0 ? ` (${tenants.length})` : ''}`
              : `Database Provisioning`
            }
          </h2>
          <button
            onClick={() => { void fetchTenants(); }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-white/40">Loading…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-sm font-medium text-red-400">{error}</p>
            <button onClick={() => { void fetchTenants(); }} className="mt-3 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30 transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* ── Subscriptions tab ─────────────────────────────────────────── */}
        {!loading && !error && activeTab === 'subscriptions' && (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {['Business', 'Slug', 'Owner Email', 'Users', 'Plan', 'Status', 'DB', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tenants.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-white/30">No tenants found.</td></tr>
                  )}
                  {tenants.map((tenant) => {
                    const isEditing = editState?.tenantId === tenant.id;
                    const provInfo = getProvisionBadge(tenant.db_provision_status);
                    const ProvIcon = provInfo.icon;
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
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-medium ${provInfo.className}`}>
                            <ProvIcon className="h-3 w-3" />
                            {provInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/50">{formatDate(tenant.created_at)}</td>
                        <td className="px-4 py-3">
                          {isEditing && editState ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex gap-2">
                                <select value={editState.plan} onChange={(e) => setEditState((p) => p ? { ...p, plan: e.target.value as SubscriptionPlan } : null)} className={selectClass}>
                                  <option value="starter">Starter</option>
                                  <option value="growth">Growth</option>
                                  <option value="business">Business</option>
                                </select>
                                <select value={editState.status} onChange={(e) => setEditState((p) => p ? { ...p, status: e.target.value as SubscriptionStatus } : null)} className={selectClass}>
                                  <option value="active">Active</option>
                                  <option value="trialing">Trialing</option>
                                  <option value="past_due">Past Due</option>
                                  <option value="canceled">Canceled</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={handleSavePlan} disabled={editState.saving} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{editState.saving ? 'Saving…' : 'Save'}</button>
                                <button onClick={cancelEdit} disabled={editState.saving} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">{''}</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => openEdit(tenant)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors">
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

        {/* ── Provisioning tab ──────────────────────────────────────────── */}
        {!loading && !error && activeTab === 'provisioning' && (
          <div className="space-y-8">

            {/* Workflow legend */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Provisioning Workflow</h3>
              <ol className="space-y-2 text-xs text-white/50 list-decimal list-inside">
                <li>Client completes onboarding → status becomes <span className="text-amber-400 font-medium">Awaiting Setup</span></li>
                <li>KiTS employee manually creates a Supabase account at <span className="font-mono text-white/70">supabase.com</span> using client's email</li>
                <li>Creates a project in the new account, copies the Project URL and Anon Key</li>
                <li>Enters credentials here → clicks "Mark Provisioned" → status becomes <span className="text-emerald-400 font-medium">Provisioned</span></li>
                <li>Client's project is automatically added to the keep-alive ping list</li>
              </ol>
            </div>

            {/* Pending queue */}
            <section>
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Awaiting Database Setup ({pendingTenants.length})
              </h3>
              {pendingTenants.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/30">
                  No clients awaiting database setup.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTenants.map(tenant => (
                    <div key={tenant.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{tenant.name}</p>
                          <p className="text-xs text-white/50 mt-1">{tenant.owner_email} · {tenant.business_type ?? 'Unknown type'} · {tenant.preferred_region ?? 'eu-central-1'}</p>
                          <p className="text-xs text-white/30 mt-0.5">Completed onboarding: {formatDate(tenant.created_at)}</p>
                        </div>
                        {provisionForm?.tenantId !== tenant.id && (
                          <button onClick={() => openProvisionForm(tenant)} className="flex-shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                            Enter Credentials
                          </button>
                        )}
                      </div>

                      {provisionForm?.tenantId === tenant.id && (
                        <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                          <p className="text-xs text-white/60 font-medium">Enter the new Supabase project credentials:</p>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Project URL (https://xxxxx.supabase.co)</label>
                            <input
                              type="url"
                              value={provisionForm.supabaseUrl}
                              onChange={e => setProvisionForm(p => p ? { ...p, supabaseUrl: e.target.value } : null)}
                              className={inputClass}
                              placeholder="https://abcdefghijklm.supabase.co"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Anon Key (public — safe to store)</label>
                            <input
                              type="text"
                              value={provisionForm.anonKey}
                              onChange={e => setProvisionForm(p => p ? { ...p, anonKey: e.target.value } : null)}
                              className={inputClass}
                              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Notes (optional)</label>
                            <input
                              type="text"
                              value={provisionForm.notes}
                              onChange={e => setProvisionForm(p => p ? { ...p, notes: e.target.value } : null)}
                              className={inputClass}
                              placeholder="Migration notes, issues, etc."
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={handleSaveProvision} disabled={provisionForm.saving} className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
                              {provisionForm.saving ? 'Saving…' : 'Mark Provisioned'}
                            </button>
                            <button onClick={cancelProvision} disabled={provisionForm.saving} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 hover:bg-white/10">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Provisioned */}
            <section>
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Provisioned ({provisionedTenants.length})
              </h3>
              {provisionedTenants.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/30">
                  No provisioned clients yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {['Business', 'Owner', 'Type', 'Region', 'Supabase URL', 'Provisioned'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {provisionedTenants.map(t => (
                        <tr key={t.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                          <td className="px-4 py-3 text-white/60 text-xs">{t.owner_email ?? '—'}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">{t.business_type ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-white/50">{t.preferred_region ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-400 truncate max-w-xs">{t.standalone_supabase_url ?? '—'}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">{t.db_provisioned_at ? formatDate(t.db_provisioned_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Other (na / failed) */}
            {otherTenants.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Shared DB / Other ({otherTenants.length})
                </h3>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {['Business', 'Owner', 'DB Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {otherTenants.map(t => {
                        const pInfo = getProvisionBadge(t.db_provision_status);
                        const Icon = pInfo.icon;
                        return (
                          <tr key={t.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                            <td className="px-4 py-3 text-white/60 text-xs">{t.owner_email ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`flex items-center gap-1 text-xs font-medium ${pInfo.className}`}>
                                <Icon className="h-3 w-3" />
                                {pInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
