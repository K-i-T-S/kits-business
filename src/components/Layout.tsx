import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCircle,
  BarChart3,
  LogOut,
  Sparkles,
  Stars,
  PhoneCall,
  Menu,
  X,
  Shield,
  Mail,
  MessageCircle,
  Instagram,
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useApp } from '../context/AppContext';
import { BRAND, LOGO_PLACEHOLDER_MESSAGE } from '../constants/branding';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentEmployee, isModalOpen } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [logoError, setLogoError] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'POS', href: '/pos', icon: ShoppingCart },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Employees', href: '/employees', icon: UserCircle },
    { name: 'Reports', href: '/reports', icon: BarChart3 }
  ];

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) => location.pathname === href;

  const supportActions = [
    {
      label: 'WhatsApp Support',
      description: BRAND.supportWhatsApp,
      icon: PhoneCall,
    },
    {
      label: 'Instagram',
      description: BRAND.supportInstagram,
      icon: Shield,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 md:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-white/5 bg-slate-900/70 backdrop-blur-2xl transition-transform duration-300 md:static md:translate-x-0 md:flex-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full p-5 space-y-6">
          <Link to="/dashboard" className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/30 via-indigo-500/10 to-transparent p-4 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                {!logoError ? (
                  <img
                    src="/logo.png"
                    alt={`${BRAND.name} logo`}
                    className="h-10 w-10 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span className="text-2xl font-semibold uppercase tracking-wide">
                    {BRAND.shortName.slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.35em] text-white/60">Kits Solutions</div>
                <h1 className="text-xl font-semibold">{BRAND.name}</h1>
                <p className="text-xs text-white/60">{BRAND.tagline}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              {LOGO_PLACEHOLDER_MESSAGE}
            </div>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-lg shadow-indigo-500/20'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 ${
                      active ? 'text-indigo-600' : 'text-white/70 group-hover:text-white'
                    }`}
                  />
                  <span>{item.name}</span>
                  {active && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600">
                      <Stars className="h-4 w-4" />
                      Live
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-4 text-xs text-white/70">
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
              <Mail className="mt-0.5 h-4 w-4 text-white" />
              <div>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="font-semibold text-white hover:text-white/80 transition"
                >
                  Email Support
                </a>
                <p className="text-white/70">{BRAND.supportEmail}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
              <MessageCircle className="mt-0.5 h-4 w-4 text-white" />
              <div>
                <a
                  href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white hover:text-white/80 transition"
                >
                  WhatsApp
                </a>
                <p className="text-white/70">{BRAND.supportWhatsApp}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
              <Instagram className="mt-0.5 h-4 w-4 text-white" />
              <div>
                <a
                  href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white hover:text-white/80 transition"
                >
                  Instagram
                </a>
                <p className="text-white/70">{BRAND.supportInstagram}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
              Secure Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      {/* Main content */}
      <div className="md:flex-1">
        <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(circle at 15% 20%, rgba(44,61,227,0.08), transparent 42%), radial-gradient(circle at 80% 0%, rgba(249,115,22,0.07), transparent 45%)',
            }}
          />
          <div className="relative flex min-h-screen flex-col">
            <header
              className={`sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-xl transition-all duration-300 ease-in-out ${
                scrollY > 12 ? 'shadow-lg shadow-slate-900/5' : ''
              } ${isModalOpen ? '-translate-y-full' : 'translate-y-0'}`}
            >
              <div className="flex items-center justify-between px-4 py-3 sm:px-8">
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 md:hidden"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                    aria-label="Toggle navigation"
                  >
                    {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                  <div>
                    <p className="stat-chip hidden md:inline-flex bg-slate-900/5 text-[10px] text-slate-500">
                      Kits business terminal
                    </p>
                    <div className="text-xs text-slate-500">
                      Powered for {currentEmployee?.name ?? 'your team'}
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                      {BRAND.name}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Operations</span>
                    <span className="text-sm font-medium text-slate-700">
                      {new Date().toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500">
                    {BRAND.supportEmail}
                  </div>
                </div>
              </div>
            </header>

            <main className="relative z-10 app-shell space-y-10">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}