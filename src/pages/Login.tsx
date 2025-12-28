import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Building2, Sparkles, MessageCircle, Instagram, Package, ShoppingCart, Users, TrendingUp, BarChart3, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '../utils/supabaseClient';
import { BRAND, LOGO_PLACEHOLDER_MESSAGE } from '../constants/branding';
import CreateTenantModal from '../components/CreateTenantModal';
import { getCurrentUserTenant } from '../utils/tenantManager';
import { useApp } from '../context/AppContext';

interface LoginProps {
  onLogin?: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        // Sign up with Supabase
        const { error: signupError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: businessName,
              role: 'owner',
              commission: 5
            }
          }
        });

        if (signupError) throw signupError;
        
        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        toast.success('Account created! Please sign in to continue');
        setIsSignup(false);
        setError('');
      } else {
        // Sign in with Supabase
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        toast.success('Welcome back!');
        
        // Use programmatic navigation instead of relying on onLogin prop
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
        
        // Still call onLogin if provided for backward compatibility
        if (onLogin) {
          onLogin();
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const message = err?.message || 'Authentication failed';
      setError(message);
      toast.error('Authentication failed', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Package,
      title: 'Inventory Management',
      description: 'Track products, variants, costs, and stock levels in real-time'
    },
    {
      icon: ShoppingCart,
      title: 'Point of Sale',
      description: 'Fast checkout with barcode scanning, receipts, and payment processing'
    },
    {
      icon: Users,
      title: 'Customer & Employee Management',
      description: 'Manage customer debts, employee roles, and sales commissions'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Daily sales reports, profit tracking, and cost shift analysis'
    },
    {
      icon: BarChart3,
      title: 'Multi-Supplier Tracking',
      description: 'Import inventory from multiple suppliers with automatic cost calculations'
    },
    {
      icon: Shield,
      title: 'Secure & Scalable',
      description: 'Role-based access control and enterprise-grade security'
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none blur-blob top-10 left-10 bg-indigo-500/40" aria-hidden="true" />
      <div className="pointer-events-none blur-blob bottom-12 right-0 bg-orange-400/30" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <section className="flex w-full flex-col justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-10 text-slate-900 lg:w-1/2 lg:px-16 pb-20 lg:pb-10">
          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                {!logoError ? (
                  <img
                    src="/logo.png"
                    alt={`${BRAND.name} logo`}
                    className="h-10 w-10 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <ShoppingCart className="h-8 w-8 text-indigo-600" />
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t('auth.signIn')}</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{BRAND.name}</h1>
              <p className="text-sm text-slate-500">{BRAND.tagline}</p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-xl shadow-slate-900/5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {isSignup ? t('auth.signUp') : t('auth.signIn')}
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {isSignup && (
                  <div>
                    <label className="text-sm font-semibold text-slate-600" htmlFor="business-name-input">Business name</label>
                    <input
                      id="business-name-input"
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-inner shadow-white/60 focus:border-indigo-500 focus:outline-none"
                      placeholder={BRAND.name}
                      required={isSignup}
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-slate-600" htmlFor="email-input">{t('auth.email')}</label>
                  <input
                    id="email-input"
                    type="email"
                    data-testid="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-inner shadow-white/60 focus:border-indigo-500 focus:outline-none"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600" htmlFor="password-input">{t('auth.password')}</label>
                  <input
                    id="password-input"
                    type="password"
                    data-testid="password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-inner shadow-white/60 focus:border-indigo-500 focus:outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-600" data-testid="error-message">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="login-button"
                  disabled={loading}
                  className="tilt-hover w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? t('common.loading') : isSignup ? t('auth.signUp') : t('auth.signIn')}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-indigo-600 hover:bg-slate-50"
                >
                  {isSignup ? t('auth.haveAccount') : t('auth.noAccount')}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Need help onboarding?</p>
              <div className="mt-1 flex items-center justify-center gap-4">
                <a
                  href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition"
                >
                  <MessageCircle className="h-3 w-3" />
                  {BRAND.supportWhatsApp}
                </a>
                <span className="text-slate-400">•</span>
                <a
                  href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition"
                >
                  <Instagram className="h-3 w-3" />
                  {BRAND.supportInstagram}
                </a>
              </div>
              <div className="mt-1">
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="flex items-center justify-center gap-1 text-indigo-600 hover:text-indigo-700 transition"
                >
                  <Mail className="h-3 w-3" />
                  {BRAND.supportEmail}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="relative hidden w-full items-center justify-center overflow-hidden bg-slate-950 px-10 py-14 text-white lg:flex lg:w-1/2 pb-20 lg:pb-14">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/70 via-indigo-700/70 to-slate-900/80" />
          <Sparkles className="absolute right-10 top-10 h-28 w-28 text-white/20" />
          <div className="relative z-10 flex w-full max-w-lg flex-col gap-10">
            <div>
              <p className="stat-chip bg-white/10 text-white/70">Kits Solutions</p>
              <h2 className="mt-5 text-3xl font-semibold">
                Hardware, software, POS, and custom development—under one roof.
              </h2>
              <p className="mt-3 text-sm text-white/70">
                {BRAND.tagline}. Reach us on{' '}
                <a
                  href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-white/90 hover:text-white transition"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
                {' '}or{' '}
                <a
                  href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-white/90 hover:text-white transition"
                >
                  <Instagram className="h-3 w-3" />
                  Instagram
                </a>
                .
              </p>
            </div>

            <div className="space-y-5">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="text-xs text-white/70">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle className="h-4 w-4" />
                <span>On-site support, training, and reliable after-sales service.</span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.35em] text-white/60">
                Kits - Khoder's IT Solutions
              </p>
            </div>
          </div>
        </section>
      </div>
      
      </div>
  );
}