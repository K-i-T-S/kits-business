import { Building2, Plus, ArrowRight, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import OnboardingWizard from '../components/OnboardingWizard';
import { supabase } from '../utils/supabaseClient';
import { createTenant } from '../utils/tenantManager';

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: string;
}

interface AuthUser {
  id: string;
  email?: string;
}

export default function TenantSelection() {
  const navigate = useNavigate();
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingTenantId, setOnboardingTenantId] = useState('');
  const [onboardingTenantName, setOnboardingTenantName] = useState('');

  useEffect(() => {
    checkAuthAndLoadTenants();
  }, []);

  const checkAuthAndLoadTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      setCurrentUser({ id: session.user.id, email: session.user.email });
      await loadUserTenants(session.user.id);

      // Check for pending invitations for this user and redirect to accept flow
      const { data: pendingInvites } = await supabase
        .from('pending_invitations')
        .select('id, tenant_id, name, role')
        .eq('email', session.user.email?.toLowerCase() ?? '')
        .eq('status', 'pending')
        .limit(1);

      if (pendingInvites && pendingInvites.length > 0) {
        const invite = pendingInvites[0] as { id: string; tenant_id: string; name: string; role: string };
        navigate(`/accept-invite?invitation_id=${invite.id}`);
        return;
      }
    } catch {
      toast.error('Failed to load account data');
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadUserTenants = async (userId: string): Promise<Tenant[]> => {
    try {
      const { data: tenants, error: queryError } = await supabase
        .from('tenant_user_details')
        .select('*')
        .eq('user_id', userId)
        .eq('user_active', true)
        .eq('tenant_active', true);

      if (queryError) throw queryError;
      const tenantList = (tenants ?? []) as Tenant[];
      setUserTenants(tenantList);
      return tenantList;
    } catch (err) {
      console.error('Error loading tenants:', err);
      return [];
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (tenantName.trim().length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
      setError('Slug may only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const newTenant = await createTenant(tenantName.trim(), tenantSlug, currentUser.id);
      toast.success('Business created!');

      // Fire-and-forget welcome email — never block the user flow
      const tid = (newTenant as { id?: string } | null)?.id ?? tenantSlug;
      supabase.functions.invoke('welcome-email', {
        body: { tenantId: tid, tenantName: tenantName.trim(), userEmail: currentUser.email ?? '' },
      }).catch(() => { /* non-critical — silently ignore email failures */ });

      // Always show onboarding for newly created tenants
      setOnboardingTenantId(tid);
      setOnboardingTenantName(tenantName.trim());
      setShowOnboarding(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create business.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTenant = async (tenant: Tenant) => {
    // Check if onboarding is needed
    try {
      const { data } = await supabase
        .from('tenants')
        .select('id, onboarding_completed, name')
        .eq('id', tenant.tenant_id)
        .single();
      if (data && data.onboarding_completed === false) {
        setOnboardingTenantId(data.id as string);
        setOnboardingTenantName((data.name as string) || tenant.tenant_name);
        setShowOnboarding(true);
        return;
      }
    } catch {
      // If we can't check, just navigate
    }
    navigate('/dashboard');
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTenantName(name);
    setTenantSlug(generateSlug(name));
  };

  if (showOnboarding) {
    return (
      <OnboardingWizard
        tenantId={onboardingTenantId}
        tenantName={onboardingTenantName}
        onComplete={() => navigate('/dashboard')}
      />
    );
  }

  if (loadingTenants) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <p className="text-sm">Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 pb-20 lg:pb-0">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-12 w-12 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Choose Your Business</h1>
          <p className="text-white/50">Select an existing business or create a new one</p>
        </div>

        {/* Existing Tenants */}
        {userTenants.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Your Businesses</h2>
            <div className="grid gap-4">
              {userTenants.map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-indigo-500/60 transition-colors cursor-pointer group"
                  onClick={() => handleSelectTenant(tenant)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {tenant.tenant_name}
                      </h3>
                      <p className="text-white/40 text-sm">{tenant.tenant_slug}</p>
                      <p className="text-indigo-400 text-sm mt-1 capitalize">{tenant.user_role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50 group-hover:text-indigo-300 transition-colors font-medium">Enter</span>
                      <ArrowRight className="h-5 w-5 text-white/40 group-hover:text-indigo-300 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Tenant */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-3 text-white/70 hover:text-indigo-300 transition-colors py-4"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Create New Business</span>
            </button>
          ) : (
            <form onSubmit={handleCreateTenant} className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Create New Business</h3>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={handleNameChange}
                  placeholder="My Business"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Business Slug
                </label>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="my-business"
                  pattern="[a-z0-9-]+"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  required
                />
                <p className="mt-1 text-xs text-white/40">Lowercase letters, numbers, and hyphens only</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Creating…' : 'Create Business'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowCreateForm(false);
                    setTenantName('');
                    setTenantSlug('');
                    setError('');
                  }}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl hover:bg-white/10 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
            className="text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
