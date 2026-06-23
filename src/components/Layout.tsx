import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCircle,
  BarChart3,
  LogOut,
  Sparkles,
  Menu,
  X,
  Search,
  Bell,
  Settings,
  ChevronDown,
  AlertTriangle,
  Lock,
  Sun,
  Moon,
  Pencil,
  TrendingDown,
  Calendar,
  CalendarHeart,
  HelpCircle,
  UtensilsCrossed,
  Pill,
  ShoppingBasket,
  Shirt,
  Cpu,
  Smartphone,
  Clock,
  BookOpen,
  Wrench,
  ScanLine,
  FlaskConical,
  Flame,
  ChefHat,
  BarChart2,
  FileText,
  Building2,
  User,
  DollarSign,
  Mail,
  MessageCircle,
  Instagram,
  Truck,
  Landmark,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import { useApp } from '../context/AppContext';
import { useIndustry } from '../context/IndustryContext';
import { useNotifications } from '../context/NotificationContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../providers/AccessibilityProvider';
import type { Feature } from '../types/subscription';
import { FEATURE_DISPLAY, PLAN_DISPLAY } from '../types/subscription';
import {
  generateCustomerAlerts,
  generateInventoryAlerts,
  generateSalesAlerts,
  generateSystemNotification,
} from '../utils/notificationEngine';
import { supabase } from '../utils/supabaseClient';

import BrandIdentityModal from './BrandIdentityModal';
import GlobalSearch from './GlobalSearch';
import { LanguageSwitcher } from './LanguageSwitcher';
import NotificationCenter from './NotificationCenter';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import StoreSwitcher from './StoreSwitcher';
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
  const { currentEmployee, isModalOpen, currentTenant, products, sales, customers } = useApp();
  const { unreadCount, addNotification } = useNotifications();
  const { hasFeature } = useSubscription();
  const { theme, toggleTheme } = useTheme();
  const { industry } = useIndustry();
  const { announce } = useAccessibility();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const isOwnerOrAdmin = currentTenant?.userRole === 'owner' || currentTenant?.userRole === 'admin';

  const handleLogout = async () => {
    try {
      announce('Logging out...', 'polite');
      await supabase.auth.signOut();
      void navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      announce('Logout failed. Please try again.', 'assertive');
    }
  };

  const isActive = useCallback((href: string) => location.pathname === href, [location.pathname]);

  const VERTICAL_NAV_ITEMS: Record<string, Array<{ name: string; icon: typeof LayoutDashboard; href?: string }>> = useMemo(() => ({
    restaurant: [
      { name: t('nav.vertical.tables', 'Table Management'), icon: UtensilsCrossed, href: '/restaurant/tables' },
      { name: t('nav.vertical.kds', 'Kitchen Display'), icon: Cpu, href: '/restaurant/kds' },
      { name: t('nav.vertical.reservations', 'Reservations'), icon: Clock, href: '/restaurant/reservations' },
      { name: t('nav.vertical.menuManagement', 'Menu Management'), icon: BookOpen, href: '/restaurant/menu' },
      { name: t('nav.vertical.waiter', 'Waiter Interface'), icon: User, href: '/restaurant/waiter' },
      { name: t('nav.vertical.argile', 'Argile Station'), icon: Flame, href: '/restaurant/argile' },
      { name: t('nav.vertical.recipes', 'Recipes & Cost'), icon: ChefHat, href: '/restaurant/recipes' },
      { name: t('nav.vertical.analytics', 'Analytics'), icon: BarChart2, href: '/restaurant/analytics' },
      { name: t('nav.vertical.shifts', 'Shifts'), icon: Calendar, href: '/restaurant/shifts' },
      { name: t('nav.vertical.cashDrawer', 'Cash Drawer'), icon: Landmark, href: '/restaurant/cash' },
      { name: t('nav.vertical.eod', 'EOD Report'), icon: FileText, href: '/restaurant/eod' },
      { name: t('nav.vertical.tips', 'Tips Management'), icon: DollarSign, href: '/restaurant/tips' },
      { name: t('nav.vertical.branches', 'Branches'), icon: Building2, href: '/restaurant/branches' },
      { name: t('nav.vertical.restaurantSettings', 'Settings'), icon: Settings, href: '/restaurant/settings' },
    ],
    pharmacy: [
      { name: t('nav.vertical.drugDatabase', 'Drug Database'), icon: Pill, href: '/pharmacy/drugs' },
      { name: t('nav.vertical.prescriptions', 'Prescriptions'), icon: FlaskConical, href: '/pharmacy/prescriptions' },
      { name: t('nav.vertical.narcoticsRegister', 'Narcotics Register'), icon: ScanLine, href: '/pharmacy/narcotics' },
    ],
    supermarket: [
      { name: t('nav.vertical.departments', 'Departments'), icon: ShoppingBasket },
      { name: t('nav.vertical.shelfLife', 'Shelf Life'), icon: AlertTriangle },
    ],
    fashion: [
      { name: t('nav.vertical.collections', 'Collections'), icon: Shirt },
      { name: t('nav.vertical.alterations', 'Alterations'), icon: Wrench },
    ],
    electronics: [
      { name: t('nav.vertical.repairOrders', 'Repair Orders'), icon: Wrench },
      { name: t('nav.vertical.serialNumbers', 'Serial Numbers'), icon: ScanLine },
    ],
    mobile: [
      { name: t('nav.vertical.imei', 'IMEI Tracker'), icon: Smartphone },
      { name: t('nav.vertical.repairOrders', 'Repair Orders'), icon: Wrench },
    ],
    retail: [],
  }), [t]);

  const PLATFORM_ITEMS = useMemo(() => [
    { name: t('nav.dashboard', 'Dashboard'), short: 'Home', href: '/dashboard', icon: LayoutDashboard, feature: undefined as Feature | undefined },
    { name: t('nav.pos', 'POS / Sales'), short: 'POS', href: '/pos', icon: ShoppingCart, feature: 'pos' as Feature },
    { name: t('nav.inventory', 'Inventory'), short: 'Stock', href: '/inventory', icon: Package, feature: 'inventory_management' as Feature },
    { name: t('nav.customers', 'Customers'), short: 'CRM', href: '/customers', icon: Users, feature: undefined as Feature | undefined },
    { name: t('nav.employees', 'Employees'), short: 'Team', href: '/employees', icon: UserCircle, feature: undefined as Feature | undefined },
    { name: t('nav.finance', 'Finance'), short: 'Finance', href: '/finance', icon: TrendingDown, feature: undefined as Feature | undefined },
    { name: t('nav.reports', 'Reports'), short: 'Reports', href: '/reports', icon: BarChart3, feature: 'basic_reports' as Feature },
    { name: t('nav.settings', 'Settings'), short: 'Settings', href: '/system-settings', icon: Settings, feature: undefined as Feature | undefined },
  ], [t]);

  const RESTAURANT_NAV_GROUPS = useMemo(() => [
    {
      label: 'Front of House',
      items: [
        { name: t('nav.vertical.tables', 'Tables'), icon: UtensilsCrossed, href: '/restaurant/tables' },
        { name: t('nav.vertical.menuManagement', 'Menu'), icon: BookOpen, href: '/restaurant/menu' },
        { name: t('nav.vertical.waiter', 'Waiter'), icon: User, href: '/restaurant/waiter' },
        { name: t('nav.vertical.reservations', 'Reservations'), icon: Clock, href: '/restaurant/reservations' },
        { name: t('nav.vertical.events', 'Events'), icon: CalendarHeart, href: '/restaurant/events' },
      ],
    },
    {
      label: 'Back of House',
      items: [
        { name: t('nav.vertical.kds', 'Kitchen Display'), icon: Cpu, href: '/restaurant/kds' },
        { name: t('nav.vertical.argile', 'Argile Station'), icon: Flame, href: '/restaurant/argile' },
      ],
    },
    {
      label: 'Management',
      items: [
        { name: t('nav.vertical.analytics', 'Analytics'), icon: BarChart2, href: '/restaurant/analytics' },
        { name: t('nav.vertical.shifts', 'Shifts'), icon: Calendar, href: '/restaurant/shifts' },
        { name: t('nav.vertical.cashDrawer', 'Cash Drawer'), icon: Landmark, href: '/restaurant/cash' },
        { name: t('nav.vertical.tips', 'Tips'), icon: DollarSign, href: '/restaurant/tips' },
        { name: t('nav.vertical.eod', 'EOD Report'), icon: FileText, href: '/restaurant/eod' },
      ],
    },
    {
      label: 'Setup',
      items: [
        { name: t('nav.vertical.recipes', 'Recipes & Cost'), icon: ChefHat, href: '/restaurant/recipes' },
        { name: t('nav.vertical.branches', 'Branches'), icon: Building2, href: '/restaurant/branches' },
        { name: t('nav.vertical.delivery', 'Delivery'), icon: Truck, href: '/restaurant/delivery' },
        { name: t('nav.vertical.restaurantSettings', 'Settings'), icon: Settings, href: '/restaurant/settings' },
      ],
    },
  ], [t]);

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

  useEffect(() => {
    const alerts = [
      ...generateInventoryAlerts(products),
      ...generateSalesAlerts(sales),
      ...generateCustomerAlerts(customers),
      generateSystemNotification(),
    ];
    alerts.forEach(addNotification);
  }, [products, sales, customers, addNotification]);

  return (
    <div className="relative min-h-dvh md:h-dvh md:overflow-hidden bg-slate-900 text-slate-100 md:flex">
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
          <nav className="flex-1 overflow-y-auto" role="navigation" aria-label="Main menu">

            {/* ── Platform compact icon grid ── */}
            <div className="mb-3">
              <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">Platform</p>
              <div className="grid grid-cols-4 gap-1">
                {PLATFORM_ITEMS.map((item) => {
                  const locked = item.feature ? !hasFeature(item.feature) : false;
                  const active = isActive(item.href);
                  if (locked && item.feature) {
                    const featureInfo = FEATURE_DISPLAY[item.feature];
                    const planInfo = PLAN_DISPLAY[featureInfo.requiredPlan];
                    return (
                      <button
                        key={item.href}
                        title={`${item.name} — requires ${planInfo.name}`}
                        onClick={() => toast.info(`Upgrade to ${planInfo.name} to unlock ${featureInfo.name}`)}
                        className="relative flex flex-col items-center gap-1 rounded-xl p-2.5 text-white/25 opacity-50 hover:opacity-60 transition-opacity"
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="text-[9px] font-medium leading-none">{item.short}</span>
                        <Lock className="absolute top-1 right-1 h-2.5 w-2.5 text-amber-400/60" aria-hidden="true" />
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={item.name}
                      aria-current={active ? 'page' : undefined}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2.5 transition-all ${
                        active
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-[9px] font-medium leading-none">{item.short}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ── Restaurant Pro — 4 grouped sections ── */}
            {industry === 'restaurant' && (
              <div className="mt-1">
                <div className="mb-2 flex items-center gap-1.5 border-t border-white/8 pt-3">
                  <UtensilsCrossed className="h-3 w-3 text-amber-400/80" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-400/80">Restaurant Pro</span>
                </div>
                {/* Hub — 3D floor plan landing page */}
                <div className="mb-2.5">
                  <Link
                    to="/restaurant"
                    aria-current={isActive('/restaurant') ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all ${
                      isActive('/restaurant')
                        ? 'bg-amber-500/15 border border-amber-500/25 text-amber-200'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                    }`}
                  >
                    <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${
                      isActive('/restaurant') ? 'bg-amber-500/25 text-amber-300' : 'bg-white/5 text-white/35'
                    }`}>
                      <LayoutDashboard className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium">Hub</span>
                  </Link>
                </div>
                {RESTAURANT_NAV_GROUPS.map((group) => (
                  <div key={group.label} className="mb-2.5">
                    <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-white/20">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all ${
                              active
                                ? 'bg-amber-500/15 border border-amber-500/25 text-amber-200'
                                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                            }`}
                          >
                            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${
                              active ? 'bg-amber-500/25 text-amber-300' : 'bg-white/5 text-white/35'
                            }`}>
                              <item.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-medium">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Other vertical nav items (pharmacy, supermarket, etc.) ── */}
            {industry && industry !== 'restaurant' && VERTICAL_NAV_ITEMS[industry] && VERTICAL_NAV_ITEMS[industry].length > 0 && (
              <div className="mt-1 border-t border-white/8 pt-3">
                <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-400/70">
                  {industry.charAt(0).toUpperCase() + industry.slice(1)} Pro
                </p>
                <div className="space-y-0.5">
                  {VERTICAL_NAV_ITEMS[industry].map((item) => {
                    const active = item.href ? isActive(item.href) : false;
                    if (item.href) {
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all ${
                            active
                              ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-300'
                              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                          }`}
                        >
                          <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                            active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-indigo-400/50'
                          }`}>
                            <item.icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium">{item.name}</span>
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={item.name}
                        onClick={() => toast.info(t('nav.vertical.comingSoon', 'Coming in the next sprint — stay tuned!'))}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-all"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-indigo-400/40">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-start text-xs font-medium">{item.name}</span>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-indigo-500/10 text-indigo-400/60">
                          {t('common.soon', 'Soon')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* ── Bottom bar: compact support links + logout ── */}
          <div className="border-t border-white/8 pt-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/20 font-semibold mr-1">Help</span>
              <a
                href={`mailto:${BRAND.supportEmail}`}
                title={`Email: ${BRAND.supportEmail}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/35 hover:bg-blue-500/20 hover:text-blue-400 transition-all"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
              <a
                href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp: ${BRAND.supportWhatsApp}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/35 hover:bg-green-500/20 hover:text-green-400 transition-all"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
              <a
                href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Instagram: ${BRAND.supportInstagram}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/35 hover:bg-pink-500/20 hover:text-pink-400 transition-all"
              >
                <Instagram className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => { void handleLogout(); }}
                data-testid="logout-button"
                aria-label="Sign out of your account"
                className="logout-button ml-auto flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Logout
              </button>
            </div>
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
      <div className="flex-1 min-h-0 md:h-full md:overflow-y-auto overflow-y-auto">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(circle at 15% 20%, rgba(44,61,227,0.08), transparent 42%), radial-gradient(circle at 80% 0%, rgba(249,115,22,0.07), transparent 45%)',
            }}
          />
          <div className="relative flex min-h-full flex-col">
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
                      aria-label={t('notifications.title', 'Notifications')}
                      aria-expanded={notificationsOpen}
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center notification-badge"
                          aria-label={`${unreadCount} unread notifications`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
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
                            onClick={() => { void handleLogout(); }}
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

        {/* Notification Center */}
        <NotificationCenter
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />

        {/* Brand Identity Modal */}
        <BrandIdentityModal
          open={brandModalOpen}
          onClose={() => setBrandModalOpen(false)}
        />

        {/* PWA: offline status banner + install prompt */}
        <OfflineIndicator />
        <PWAInstallPrompt />
      </div>
    </div>
  );
}