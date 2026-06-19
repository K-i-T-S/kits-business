import { Building2, CheckCircle, Loader2, AlertCircle, LogIn } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import { supabase } from '../utils/supabaseClient';

type PageState = 'loading' | 'need_login' | 'accepting' | 'success' | 'error';

interface InvitationInfo {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  name: string;
  role: string;
  email: string;
}

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationId = searchParams.get('invitation_id');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [tenantName, setTenantName] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!invitationId) {
      setErrorMessage('No invitation ID found in the link. Please check your invitation email and try again.');
      setPageState('error');
      return;
    }
    void checkAuthAndInvitation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId]);

  const checkAuthAndInvitation = async () => {
    setPageState('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Fetch invitation details (public enough to read without auth for display)
      const { data: inviteData, error: inviteErr } = await supabase
        .from('pending_invitations')
        .select('id, tenant_id, name, role, email, status')
        .eq('id', invitationId!)
        .single();

      if (inviteErr || !inviteData) {
        setErrorMessage('Invitation not found. It may have already been accepted or the link is invalid.');
        setPageState('error');
        return;
      }

      const inv = inviteData as InvitationInfo & { status: string };

      if (inv.status === 'accepted') {
        setErrorMessage('This invitation has already been accepted.');
        setPageState('error');
        return;
      }

      // Try to fetch tenant name
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', inv.tenant_id)
        .single();

      const resolvedTenantName = (tenantData as { name?: string } | null)?.name ?? 'your team';
      setTenantName(resolvedTenantName);
      setInvitation({ ...inv, tenant_name: resolvedTenantName });

      if (!session) {
        // Pre-fill email from invitation
        setLoginEmail(inv.email);
        setPageState('need_login');
        return;
      }

      // User is logged in — accept immediately
      await acceptInvitation(inv.id, resolvedTenantName);
    } catch (err) {
      console.error('AcceptInvite error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setPageState('error');
    }
  };

  const acceptInvitation = async (id: string, resolvedTenantName: string) => {
    setPageState('accepting');
    try {
      const { data, error } = await supabase.rpc('accept_pending_invitation', {
        p_invitation_id: id,
      });

      if (error) throw error;

      const result = data as { success?: boolean; tenant_id?: string } | null;
      if (!result?.success) {
        throw new Error('Invitation acceptance returned an unexpected response.');
      }

      setTenantName(resolvedTenantName);
      setPageState('success');
      toast.success(`Welcome to ${resolvedTenantName}!`);
    } catch (err) {
      console.error('accept_pending_invitation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to accept the invitation.');
      setPageState('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInErr) {
        setLoginError(signInErr.message);
        return;
      }

      // Now accept the invitation
      if (invitation) {
        await acceptInvitation(invitation.id, invitation.tenant_name ?? tenantName);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md"
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '1.5rem',
          boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(28px)',
          padding: '2rem',
        }}
      >
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-indigo-400" />
          <span className="text-white/60 text-sm font-medium">{BRAND.shortName}</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (pageState === 'loading' || pageState === 'accepting') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <p className="text-white/60 text-sm text-center">
            {pageState === 'accepting' ? 'Accepting your invitation…' : 'Loading invitation…'}
          </p>
        </div>
      </Card>
    );
  }

  if (pageState === 'success') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">You're in!</h1>
            <p className="text-white/60">
              You've joined <span className="text-indigo-300 font-semibold">{tenantName}</span>.
              {invitation?.role && (
                <> Your role is <span className="text-white/80 capitalize">{invitation.role}</span>.</>
              )}
            </p>
          </div>
          <button
            onClick={() => { void navigate('/tenant-selection'); }}
            className="mt-4 w-full px-6 py-3 btn-brand text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </Card>
    );
  }

  if (pageState === 'error') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Error</h1>
            <p className="text-white/60 text-sm">{errorMessage}</p>
          </div>
          <button
            onClick={() => { void navigate('/login'); }}
            className="mt-2 w-full px-6 py-3 bg-white/10 border border-white/20 text-white/80 rounded-xl font-medium hover:bg-white/20 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </Card>
    );
  }

  // pageState === 'need_login'
  return (
    <Card>
      <div className="mb-6 text-center">
        <div className="h-14 w-14 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
          <LogIn className="h-7 w-7 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Accept Your Invitation</h1>
        <p className="text-white/60 text-sm">
          Sign in to join{' '}
          <span className="text-indigo-300 font-semibold">{tenantName || 'your team'}</span>
          {invitation?.role && (
            <> as <span className="text-white/80 capitalize">{invitation.role}</span></>
          )}.
        </p>
      </div>

      {loginError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loginError}
        </div>
      )}

      <form onSubmit={(e) => { void handleLogin(e); }} className="space-y-4">
        <div>
          <label htmlFor="accept-email" className="block text-sm font-medium text-white/70 mb-2">
            Email
          </label>
          <input
            id="accept-email"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>

        <div>
          <label htmlFor="accept-password" className="block text-sm font-medium text-white/70 mb-2">
            Password
          </label>
          <input
            id="accept-password"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Your password"
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loginLoading}
          className="w-full px-6 py-3 btn-brand text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loginLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign In & Accept Invitation'
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-white/40">
        Don't have an account yet?{' '}
        <a
          href={`/login?invitation_id=${invitationId ?? ''}`}
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Sign up here
        </a>
      </p>
    </Card>
  );
}
