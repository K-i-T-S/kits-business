import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '@/constants/branding';
import { supabase } from '@/utils/supabaseClient';

interface LoginFormProps {
  onLogin?: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignup) {
        const { error: signupError, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: businessName, role: 'owner' } },
        });
        if (signupError) throw signupError;
        if (data.session) {
          toast.success(t('login.accountCreated', 'Account created! Setting up your workspace…'));
          void navigate('/tenant-selection');
          onLogin?.();
        } else {
          toast.success(t('login.checkEmail', 'Check your email for the confirmation link, then sign in.'));
          setIsSignup(false);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        toast.success(t('login.welcomeBack', 'Welcome back!'));
        void navigate('/tenant-selection');
        onLogin?.();
      }
    } catch (err: unknown) {
      let message = t('login.authFailed', 'Authentication failed. Please try again.');
      if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        const raw =
          (e.message as string) ||
          (e.error_description as string) ||
          (e.error as string) ||
          '';
        if (raw && !raw.match(/^\s*\{.*\}\s*$/)) message = raw;
      }
      setError(message);
      toast.error(isSignup ? t('login.signupFailed', 'Sign up failed') : t('login.signinFailed', 'Sign in failed'), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!email) {
      setError(t('login.enterEmailFirst', 'Enter your email address first, then click Forgot password.'));
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      toast.success(t('login.resetSent', 'Password reset email sent — check your inbox.'));
    } catch {
      setError(t('login.resetFailed', 'Failed to send reset email. Please try again.'));
    }
  };

  const toggleMode = (): void => {
    setIsSignup((prev) => !prev);
    setError('');
  };

  return (
    <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-16">
      <div className="mx-auto w-full max-w-md">
        {/* Brand mark — visible on mobile only (desktop shows BrandPanel) */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            {!logoError ? (
              <img
                src="/logo.png"
                alt={`${BRAND.name} logo`}
                className="h-7 w-7 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-sm font-bold text-white">K</span>
            )}
          </div>
          <div>
            <span className="text-base font-bold text-white">{BRAND.shortName}</span>
            <p className="text-[11px] text-white/50">{t('login.businessTerminal', 'Business Terminal')}</p>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {isSignup
              ? t('login.createAccount', 'Create your account')
              : t('login.welcomeBackTitle', 'Welcome back')}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {isSignup
              ? t('login.startFreeTrial', 'Start your free trial — no credit card required')
              : t('login.signInToContinue', 'Sign in to continue to your dashboard')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {/* Business name — slides in for signup */}
          {isSignup && (
            <div className="login-message-animated">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60" htmlFor="business-name-input">
                {t('login.businessName', 'Business Name')}
              </label>
              <input
                id="business-name-input"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-500/70 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/20"
                placeholder={t('login.businessNamePlaceholder', 'e.g. My Store, Café Milano')}
                required={isSignup}
                autoFocus
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60" htmlFor="email-input">
              {t('auth.email', 'Email')}
            </label>
            <input
              id="email-input"
              type="email"
              data-testid="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-500/70 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          {/* Password with show/hide */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60" htmlFor="password-input">
                {t('auth.password', 'Password')}
              </label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => { void handleForgotPassword(); }}
                  className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  {t('login.forgotPassword', 'Forgot password?')}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                data-testid="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 pr-11 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-500/70 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••••••"
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={isSignup ? 8 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-white/40 transition-colors hover:text-white/80"
                aria-label={showPassword ? t('login.hidePassword', 'Hide password') : t('login.showPassword', 'Show password')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isSignup && password.length > 0 && (
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      password.length >= level * 2
                        ? level <= 1
                          ? 'bg-red-500'
                          : level <= 2
                            ? 'bg-amber-500'
                            : level <= 3
                              ? 'bg-yellow-400'
                              : 'bg-emerald-500'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="login-message-animated flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3" data-testid="error-message">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" aria-hidden="true" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-testid="login-button"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-sky-400 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading', 'Loading…')}
              </span>
            ) : isSignup ? (
              t('auth.signUp', 'Create Account')
            ) : (
              t('auth.signIn', 'Sign In')
            )}
          </button>

          {/* Toggle */}
          <button
            type="button"
            onClick={toggleMode}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            {isSignup
              ? t('auth.haveAccount', 'Already have an account? Sign in')
              : t('auth.noAccount', "Don't have an account? Sign up")}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-white/30">
          {t('login.footerNote', 'By continuing, you agree to our Terms of Service and Privacy Policy.')}
        </p>
      </div>
    </div>
  );
}
