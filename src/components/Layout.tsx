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
  Search,
  Bell,
  Settings,
  ChevronDown,
  Activity,
  Calendar,
  HelpCircle,
  Layers,
  Truck,
  TrendingUp,
  AlertTriangle,
  Zap,
  MapPin,
  Key,
  Lock,
  Building2,
  Sun,
  Moon,
  Pencil,
  TrendingDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import { useApp } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../providers/AccessibilityProvider';
import type { Feature } from '../types/subscription';
import { FEATURE_DISPLAY, PLAN_DISPLAY } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

import BrandIdentityModal from './BrandIdentityModal';
import GlobalSearch from './GlobalSearch';
import { LanguageSwitcher } from './LanguageSwitcher';
import NavItem from './NavItem';
import NotificationItem from './NotificationItem';
import StoreSwitcher from './StoreSwitcher';
import SupportCard from './SupportCard';
import TenantInfo from './TenantInfo';
import TenantSwitcher from './TenantSwitcher';
import UserProfileModal from './UserProfileModal';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentEmployee, isModalOpen, currentTenant } = useApp();
  const { hasFeature } = useSubscription();
  const { theme, toggleTheme } = useTheme();
  const { announce, setAriaAttribute, setRole } = useAccessibility();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const isOwnerOrAdmin = currentTenant?.userRole === 'owner' || currentTenant?.userRole === 'admin';

  const handleLogout = async () => {
    try {
      announce('Logging out...', 'polite');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      announce('Logout failed. Please try again.', 'assertive');
    }
  };

  const isActive = useCallback((href: string) => location.pathname === href, [location.pathname]);

  const navigation = useMemo(() => [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, feature: undefined },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: Package,
      feature: 'inventory_management' as Feature,
      subItems: [
        { name: 'Products', href: '/inventory', icon: Package },
        { name: 'Batch Tracking', href: '/inventory/batch-tracking', icon: Layers },
        { name: 'Suppliers', href: '/inventory/suppliers', icon: Users },
        { name: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ShoppingCart },
        { name: 'Stock Transfers', href: '/inventory/stock-transfers', icon: Truck },
        { name: 'Reorder Points', href: '/inventory/reorder-points', icon: AlertTriangle },
      ],
    },
    { name: 'POS', href: '/pos', icon: ShoppingCart, feature: 'pos' as Feature },
    { name: 'Customers', href: '/customers', icon: Users, feature: undefined },
    { name: 'Employees', href: '/employees', icon: UserCircle, feature: undefined },
    { name: 'Monitoring', href: '/monitoring', icon: Activity, feature: 'monitoring' as Feature },
    { name: 'Reports', href: '/reports', icon: BarChart3, feature: 'basic_reports' as Feature },
    { name: 'Finance', href: '/finance', icon: TrendingDown, feature: undefined },
    {
      name: 'Enterprise',
      href: '/enterprise',
      icon: Shield,
      feature: 'enterprise_dashboard' as Feature,
      subItems: [
        { name: 'Enterprise Dashboard', href: '/enterprise', icon: Shield },
        { name: 'Roles & Permissions', href: '/enterprise/roles', icon: Shield },
        { name: 'Workflow Automation', href: '/enterprise/workflows', icon: Zap },
        { name: 'Multi-Location', href: '/enterprise/locations', icon: MapPin },
        { name: 'API & Webhooks', href: '/enterprise/api', icon: Key },
      ],
    },
    { name: 'Profile Settings', href: '/profile-settings', icon: Settings, feature: undefined },
    { name: 'System Settings', href: '/system-settings', icon: Building2, feature: undefined },
  ], []);

  const supportActions = useMemo(() => [
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
  ], [BRAND.supportWhatsApp, BRAND.supportInstagram]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-100 md:flex">
      {/* Skip Links - Completely hidden until focused */}
      <a
        href="#main-content"
        className="skip-link"
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '0',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
          background: 'transparent',
          color: 'transparent',
          textDecoration: 'none',
          fontSize: '0',
          lineHeight: '0',
        }}
        onClick={(e) => {
          e.preventDefault();
          const target = document.getElementById('main-content');
          if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="skip-link"
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '0',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
          background: 'transparent',
          color: 'transparent',
          textDecoration: 'none',
          fontSize: '0',
          lineHeight: '0',
        }}
        onClick={(e) => {
          e.preventDefault();
          const target = document.getElementById('navigation');
          if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        Skip to navigation
      </a>
      <a
        href="#search"
        className="skip-link"
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '0',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
          background: 'transparent',
          color: 'transparent',
          textDecoration: 'none',
          fontSize: '0',
          lineHeight: '0',
        }}
        onClick={(e) => {
          e.preventDefault();
          const target = document.querySelector('[role="search"]');
          if (target) {
            (target as HTMLElement).focus();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        Skip to search
      </a>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-30 w-80 transform border-e border-white/10 bg-slate-900/98 backdrop-blur-xl transition-all duration-300 ease-out md:static md:translate-x-0 md:flex-none shadow-2xl ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full md:translate-x-0 rtl:md:translate-x-0'
        }`}
        role="navigation"
        aria-label="Main navigation"
        id="navigation"
        data-testid={`${mobileNavOpen ? 'mobile-navigation' : 'sidebar'}`}
      >
        <div className="flex flex-col h-full p-6 space-y-6">
          {/* Mobile Close Button */}
          <div className="flex justify-end md:hidden">
            <button
              onClick={() => setMobileNavOpen(false)}
              data-testid="mobile-menu-button"
              className="rounded-lg border border-white/20 bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Branding Section */}
          <div className="relative group sidebar-brand">
            {/* Main brand card */}
            <button
              onClick={() => isOwnerOrAdmin ? setBrandModalOpen(true) : undefined}
              className={`w-full text-left flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--brand-primary)]/30 via-[var(--brand-secondary)]/15 to-transparent p-4 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-white/20 ${isOwnerOrAdmin ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
              aria-label={isOwnerOrAdmin ? 'Customise brand identity' : 'Brand'}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                  {currentTenant?.brand_logo_url ? (
                    <img
                      src={currentTenant.brand_logo_url}
                      alt={`${currentTenant.name} logo`}
                      className="h-10 w-10 object-contain rounded-lg"
                    />
                  ) : !logoError ? (
                    <img
                      src="/logo.png"
                      alt={`${BRAND.name} logo`}
                      className="h-10 w-10 object-contain transition-opacity hover:opacity-90"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span className="text-2xl font-bold uppercase tracking-wide">
                      {(currentTenant?.name ?? BRAND.shortName).slice(0, 2)}
                    </span>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse status-indicator" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/50 font-medium">Your Business</div>
                  <h1 className="text-lg font-bold text-white truncate">{currentTenant?.name ?? BRAND.name}</h1>
                  <p className="text-xs text-white/50 mt-0.5 truncate">
                    {currentTenant?.brand_tagline ?? BRAND.tagline}
                  </p>
                </div>
                {/* Edit hint — only owners/admins see this */}
                {isOwnerOrAdmin && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Pencil className="h-4 w-4 text-white/40" />
                  </div>
                )}
              </div>
            </button>

            {/* Always-visible "Powered by KiTS" watermark */}
            <div className="mt-1.5 rounded-xl border border-white/5 bg-white/3 px-3 py-2 flex items-center gap-2">
              {!logoError ? (
                <img src="/logo.png" alt="KiTS" className="h-3.5 w-3.5 object-contain opacity-50 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Sparkles className="h-3 w-3 text-indigo-400 flex-shrink-0" aria-hidden="true" />
              )}
              <span className="text-xs text-white/35 truncate">
                Powered by <span className="text-white/55 font-medium">KiTS</span> · Khoder's IT Solutions
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 overflow-y-auto" role="navigation" aria-label="Main menu">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider nav-section-title">Main Menu</h3>
            </div>
            {navigation.map((item) => {
              const locked = item.feature ? !hasFeature(item.feature) : false;
              if (locked && item.feature) {
                const featureInfo = FEATURE_DISPLAY[item.feature];
                const planInfo = PLAN_DISPLAY[featureInfo.requiredPlan];
                return (
                  <button
                    key={item.name}
                    onClick={() => toast.info(`Upgrade to ${planInfo.name} (${planInfo.price}) to unlock ${featureInfo.name}`)}
                    className="group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-white/30 opacity-50 transition-all duration-200 hover:opacity-70"
                    aria-label={`${item.name} — requires ${planInfo.name} plan`}
                  >
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/30">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-start">{item.name}</span>
                    <Lock className="h-3 w-3 text-amber-400/70" aria-hidden="true" />
                  </button>
                );
              }
              return (
                <NavItem
                  key={item.name}
                  item={item}
                  isActive={isActive(item.href)}
                />
              );
            })}
          </nav>

          {/* Support Section */}
          <div className="space-y-4">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider nav-section-title">Support</h3>
            </div>

            <div className="grid grid-cols-1 gap-3" role="complementary" aria-label="Support options">
              <SupportCard type="email" />
              <SupportCard type="whatsapp" />
              <SupportCard type="instagram" />
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/20 logout-button"
              aria-label="Sign out of your account"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden="true" />
              Secure Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <button
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
        />
      )}

      {/* Main content */}
      <div className="md:flex-1">
        <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
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
              className={`sticky top-0 z-50 border-b border-white/10 bg-slate-900/95 backdrop-blur-2xl text-white transition-all duration-300 ease-in-out ${
                scrollY > 12 ? 'shadow-2xl shadow-slate-900/50 border-white/20' : 'shadow-lg shadow-slate-900/20'
              } ${isModalOpen ? '-translate-y-full' : 'translate-y-0'}`}
              role="banner"
            >
              <div className="flex items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
                {/* Left Section - Logo & Mobile Menu */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Mobile Menu Toggle */}
                  <button
                    onClick={() => setMobileNavOpen(!mobileNavOpen)}
                    data-testid="mobile-menu-toggle"
                    className="md:hidden rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 header-button flex-shrink-0"
                    aria-label="Toggle navigation menu"
                    aria-expanded={mobileNavOpen}
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  <div className="md:hidden w-12 h-12">
                    {/* Empty space to maintain logo positioning */}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-lg header-logo">
                        {!logoError ? (
                          <img
                            src="/logo.png"
                            alt={`${BRAND.name} logo`}
                            className="h-7 w-7 object-contain transition-opacity hover:opacity-90"
                            onError={() => setLogoError(true)}
                          />
                        ) : (
                          <span className="text-lg font-bold uppercase tracking-wide text-white">
                            {BRAND.shortName.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse status-indicator" aria-hidden="true"></div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-white">{BRAND.name}</h1>
                        <span className="text-xs text-indigo-400 font-medium">PRO</span>
                      </div>
                      <p className="text-xs text-white/60 font-medium">{BRAND.tagline}</p>
                    </div>
                  </div>
                </div>

                {/* Center Section - Search trigger (Desktop) */}
                <div className="hidden md:flex flex-1 max-w-md mx-6" role="search">
                  <button
                    onClick={() => setSearchOpen(true)}
                    aria-label={t('common.search', 'Search')}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors text-sm w-48 lg:w-64 header-search"
                  >
                    <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-start">Search&hellip;</span>
                    <kbd className="ms-auto text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/30 font-mono hidden lg:inline">
                      ⌘K
                    </kbd>
                  </button>
                </div>

                {/* Right Section - Actions & Profile */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Tenant Switcher */}
                  <div className="hidden lg:block">
                    <TenantSwitcher />
                  </div>

                  {/* Store Switcher */}
                  <div className="hidden md:block">
                    <StoreSwitcher />
                  </div>

                  {/* Tenant Info */}
                  <div className="hidden sm:block">
                    <TenantInfo />
                  </div>

                  {/* Search Button (Mobile) */}
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 md:hidden header-button flex-shrink-0"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Open search"
                  >
                    <Search className="h-5 w-5" />
                  </button>

                  {/* Theme Toggle */}
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 header-button flex-shrink-0"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>

                  {/* Notifications */}
                  <div className="relative flex-shrink-0">
                    <button
                      className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 relative header-button"
                      onClick={() => setNotificationsOpen(!notificationsOpen)}
                      aria-label="View notifications"
                      aria-expanded={notificationsOpen}
                    >
                      <Bell className="h-5 w-5" />
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse notification-badge" aria-label="New notifications"></span>
                    </button>

                    {notificationsOpen && (
                      <div
                        className="absolute right-0 mt-2 w-80 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 dropdown-menu"
                        role="region"
                        aria-label="Notifications"
                      >
                        <div className="p-4 border-b border-white/10">
                          <h3 className="font-semibold text-white">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto" role="list">
                          <NotificationItem
                            type="order"
                            title="New order received"
                            description="Order #1234 - $250.00"
                            time="2 minutes ago"
                          />
                          <NotificationItem
                            type="stock"
                            title="Low stock alert"
                            description="5 items need restocking"
                            time="1 hour ago"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Language Switcher */}
                  <div className="hidden sm:block">
                    <LanguageSwitcher className="border-white/20 bg-white/10 text-white hover:bg-white/20" />
                  </div>

                  {/* User Profile */}
                  <div className="relative">
                    <button
                      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 header-button"
                      onClick={() => setProfileModalOpen(true)}
                      aria-label="User profile menu"
                      aria-expanded={profileOpen}
                      aria-haspopup="true"
                    >
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {currentEmployee?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {profileOpen && (
                      <div
                        className="absolute right-0 mt-2 w-64 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 dropdown-menu"
                        role="menu"
                        aria-label="User menu"
                      >
                        <div className="p-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {currentEmployee?.name?.slice(0, 2).toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{currentEmployee?.name || 'User'}</p>
                              <p className="text-xs text-white/60">{currentEmployee?.role || 'Staff'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="py-2" role="none">
                          <Link
                            to="/profile-settings"
                            className="w-full px-4 py-2 text-start text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                            role="menuitem"
                          >
                            <UserCircle className="h-4 w-4" aria-hidden="true" />
                            {t('common.profile', 'Profile Settings')}
                          </Link>
                          <Link
                            to="/system-settings"
                            className="w-full px-4 py-2 text-start text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                            role="menuitem"
                          >
                            <Settings className="h-4 w-4" aria-hidden="true" />
                            {t('common.systemSettings', 'System Settings')}
                          </Link>
                          <Link
                            to="/activity-log"
                            className="w-full px-4 py-2 text-start text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                            role="menuitem"
                          >
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            {t('common.activity', 'Activity Log')}
                          </Link>
                          <Link
                            to="/help-support"
                            className="w-full px-4 py-2 text-start text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                            role="menuitem"
                          >
                            <HelpCircle className="h-4 w-4" aria-hidden="true" />
                            {t('common.help', 'Help & Support')}
                          </Link>
                        </div>
                        <div className="border-t border-white/10 p-2">
                          <button
                            onClick={handleLogout}
                            className="w-full px-3 py-2 text-start text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors rounded-lg flex items-center gap-3"
                            role="menuitem"
                          >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            {t('auth.signOut', 'Sign Out')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </header>

            <main className="relative z-10 app-shell space-y-10 mobile-content" role="main" id="main-content">{children}</main>
          </div>
        </div>

        {/* User Profile Modal */}
        <UserProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
        />

        {/* Global Search Command Palette */}
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />

        {/* Brand Identity Modal */}
        <BrandIdentityModal
          open={brandModalOpen}
          onClose={() => setBrandModalOpen(false)}
        />
      </div>
    </div>
  );
}