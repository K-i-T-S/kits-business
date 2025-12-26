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
  Search,
  Bell,
  Settings,
  ChevronDown,
  Activity,
  Calendar,
  HelpCircle,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-100 md:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-white/10 bg-slate-900/95 backdrop-blur-2xl transition-transform duration-300 ease-out md:static md:translate-x-0 md:flex-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full p-5 space-y-6">
          {/* Branding Section */}
          <Link to="/dashboard" className="group">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent p-4 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-white/20 sidebar-brand">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 transition-transform group-hover:scale-110">
                  {!logoError ? (
                    <img
                      src="/logo.png"
                      alt={`${BRAND.name} logo`}
                      className="h-10 w-10 object-contain transition-opacity hover:opacity-90"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span className="text-2xl font-bold uppercase tracking-wide">
                      {BRAND.shortName.slice(0, 2)}
                    </span>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse status-indicator"></div>
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-[0.35em] text-white/60 font-medium">Kits Solutions</div>
                  <h1 className="text-xl font-bold text-white">{BRAND.name}</h1>
                  <p className="text-xs text-white/60 mt-1">{BRAND.tagline}</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  {LOGO_PLACEHOLDER_MESSAGE}
                </div>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 overflow-y-auto">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider nav-section-title">Main Menu</h3>
            </div>
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 sidebar-nav-item ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow-lg border border-indigo-500/30 active'
                      : 'text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                  } border border-transparent`}
                >
                  <div className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all sidebar-nav-icon ${
                    active 
                      ? 'bg-indigo-500/20 text-indigo-300' 
                      : 'bg-white/5 text-white/70 group-hover:bg-white/10 group-hover:text-white'
                  }`}>
                    <item.icon className="h-4 w-4" />
                    {active && (
                      <div className="absolute -inset-1 rounded-lg bg-indigo-500/20 animate-pulse"></div>
                    )}
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-indigo-300">
                      <Stars className="h-3 w-3" />
                      Active
                    </div>
                  )}
                  {!active && (
                    <ChevronDown className="h-4 w-4 text-white/40 rotate-[-90deg] group-hover:rotate-0 transition-transform duration-200 nav-chevron" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Support Section */}
          <div className="space-y-4">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider nav-section-title">Support</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-lg support-card"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-400 transition-transform group-hover:scale-110">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white transition-colors group-hover:text-blue-400">Email Support</p>
                  <p className="text-xs text-white/60 truncate">{BRAND.supportEmail}</p>
                </div>
              </a>
              
              <a
                href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-lg support-card"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-400 transition-transform group-hover:scale-110">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white transition-colors group-hover:text-green-400">WhatsApp</p>
                  <p className="text-xs text-white/60 truncate">{BRAND.supportWhatsApp}</p>
                </div>
              </a>
              
              <a
                href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-lg support-card"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-600/20 text-pink-400 transition-transform group-hover:scale-110">
                  <Instagram className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white transition-colors group-hover:text-pink-400">Instagram</p>
                  <p className="text-xs text-white/60 truncate">{BRAND.supportInstagram}</p>
                </div>
              </a>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/20 logout-button"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:rotate-12" />
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
            >
              <div className="flex items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
                {/* Left Section - Logo & Mobile Menu */}
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 md:hidden"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                    aria-label="Toggle navigation"
                  >
                    {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                  
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
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse status-indicator"></div>
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

                {/* Center Section - Search Bar (Desktop) */}
                <div className="hidden md:flex flex-1 max-w-md mx-6">
                  <div className="relative w-full header-search">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-white/40" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                      placeholder="Search products, customers, orders..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <X className="h-4 w-4 text-white/40 hover:text-white/60" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Section - Actions & Profile */}
                <div className="flex items-center gap-2">
                  {/* Search Button (Mobile) */}
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 md:hidden header-button"
                    onClick={() => setSearchOpen(!searchOpen)}
                    aria-label="Search"
                  >
                    <Search className="h-5 w-5" />
                  </button>

                  {/* Notifications */}
                  <div className="relative">
                    <button
                      className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 relative header-button"
                      onClick={() => setNotificationsOpen(!notificationsOpen)}
                      aria-label="Notifications"
                    >
                      <Bell className="h-5 w-5" />
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse notification-badge"></span>
                    </button>
                    
                    {notificationsOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 dropdown-menu">
                        <div className="p-4 border-b border-white/10">
                          <h3 className="font-semibold text-white">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          <div className="p-4 hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <Activity className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-white font-medium">New order received</p>
                                <p className="text-xs text-white/60 mt-1">Order #1234 - $250.00</p>
                                <p className="text-xs text-indigo-400 mt-2">2 minutes ago</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <Package className="h-4 w-4 text-green-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-white font-medium">Low stock alert</p>
                                <p className="text-xs text-white/60 mt-1">5 items need restocking</p>
                                <p className="text-xs text-indigo-400 mt-2">1 hour ago</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Profile */}
                  <div className="relative">
                    <button
                      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 header-button"
                      onClick={() => setProfileOpen(!profileOpen)}
                      aria-label="User profile"
                    >
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {currentEmployee?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    
                    {profileOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 dropdown-menu">
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
                        <div className="py-2">
                          <Link
                            to="/profile-settings"
                            className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <UserCircle className="h-4 w-4" />
                            Profile Settings
                          </Link>
                          <Link
                            to="/system-settings"
                            className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <Settings className="h-4 w-4" />
                            System Settings
                          </Link>
                          <Link
                            to="/activity-log"
                            className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <Calendar className="h-4 w-4" />
                            Activity Log
                          </Link>
                          <Link
                            to="/help-support"
                            className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <HelpCircle className="h-4 w-4" />
                            Help & Support
                          </Link>
                        </div>
                        <div className="border-t border-white/10 p-2">
                          <button
                            onClick={handleLogout}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors rounded-lg flex items-center gap-3"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Mobile Search Bar */}
              {searchOpen && (
                <div className="md:hidden px-4 pb-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-white/40" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products, customers, orders..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </header>

            <main className="relative z-10 app-shell space-y-10">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}