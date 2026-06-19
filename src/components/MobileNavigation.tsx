import {
  Home,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Truck,
  AlertTriangle,
  UserCircle,
  LogOut,
  PhoneCall,
  Mail,
  MessageCircle,
  Shield,
  Activity,
  Zap,
  MapPin,
  Key,
  Lock,
  Building2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import { useSubscription } from '../context/SubscriptionContext';
import type { Feature } from '../types/subscription';
import { FEATURE_DISPLAY, PLAN_DISPLAY } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  feature?: Feature
  badge?: number
  description?: string
  subItems?: Array<{
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    path: string
    description?: string
  }>
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    description: 'Overview and quick actions',
  },
  {
    id: 'pos',
    label: 'POS',
    icon: ShoppingCart,
    path: '/pos',
    feature: 'pos',
    description: 'Point of Sale system',
    badge: 0,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    path: '/inventory',
    feature: 'inventory_management',
    description: 'Manage products and stock',
    subItems: [
      {
        id: 'products',
        label: 'Products',
        icon: Package,
        path: '/inventory',
        description: 'Product catalog and management',
      },
      {
        id: 'batch-tracking',
        label: 'Batch Tracking',
        icon: Layers,
        path: '/inventory/batch-tracking',
        description: 'Track product batches and expiry',
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        icon: Users,
        path: '/inventory/suppliers',
        description: 'Supplier management and relationships',
      },
      {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        icon: ShoppingCart,
        path: '/inventory/purchase-orders',
        description: 'Manage purchase orders and receiving',
      },
      {
        id: 'stock-transfers',
        label: 'Stock Transfers',
        icon: Truck,
        path: '/inventory/stock-transfers',
        description: 'Transfer stock between locations',
      },
      {
        id: 'reorder-points',
        label: 'Reorder Points',
        icon: AlertTriangle,
        path: '/inventory/reorder-points',
        description: 'Automated reorder management',
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    path: '/customers',
    description: 'Customer management',
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: UserCircle,
    path: '/employees',
    description: 'Employee management',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: Activity,
    path: '/monitoring',
    feature: 'monitoring',
    description: 'System monitoring and alerts',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: '/reports',
    feature: 'basic_reports',
    description: 'Reports and insights',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    icon: Shield,
    path: '/enterprise',
    feature: 'enterprise_dashboard',
    description: 'Advanced enterprise features',
    subItems: [
      {
        id: 'enterprise-dashboard',
        label: 'Enterprise Dashboard',
        icon: Shield,
        path: '/enterprise',
        description: 'Enterprise overview and analytics',
      },
      {
        id: 'roles-permissions',
        label: 'Roles & Permissions',
        icon: Shield,
        path: '/enterprise/roles',
        description: 'User roles and permissions management',
      },
      {
        id: 'workflows',
        label: 'Workflow Automation',
        icon: Zap,
        path: '/enterprise/workflows',
        description: 'Automated workflows and processes',
      },
      {
        id: 'locations',
        label: 'Multi-Location',
        icon: MapPin,
        path: '/enterprise/locations',
        description: 'Multi-location inventory management',
      },
      {
        id: 'api-webhooks',
        label: 'API & Webhooks',
        icon: Key,
        path: '/enterprise/api',
        description: 'API management and webhook integrations',
      },
    ],
  },
  {
    id: 'profile-settings',
    label: 'Profile Settings',
    icon: Settings,
    path: '/profile-settings',
    description: 'Personal preferences and account',
  },
  {
    id: 'system-settings',
    label: 'System Settings',
    icon: Building2,
    path: '/system-settings',
    description: 'Business configuration',
  },
];

export function MobileNavigation() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();

  // Handle body scroll lock when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSupportAction = (type: string) => {
    switch (type) {
      case 'whatsapp':
        window.open(`https://wa.me/${BRAND.supportWhatsApp?.replace(/[^0-9]/g, '')}`, '_blank');
        break;
      case 'instagram':
        window.open(BRAND.supportInstagram, '_blank');
        break;
      case 'email':
        window.open(`mailto:${BRAND.supportEmail}`, '_blank');
        break;
    }
  };

  const handleNavClick = (path: string) => {
    setIsAnimating(true);
    setTimeout(() => {
      navigate(path);
      setIsDrawerOpen(false);
      setIsAnimating(false);
    }, 150);
  };

  const handleLockedNavClick = (featureId: Feature) => {
    const featureInfo = FEATURE_DISPLAY[featureId];
    const planInfo = PLAN_DISPLAY[featureInfo.requiredPlan];
    toast.info(`Upgrade to ${planInfo.name} (${planInfo.price}) to unlock ${featureInfo.name}`);
  };

  const isActive = (path: string) => {
    return location.pathname === path ||
           (path !== '/' && location.pathname.startsWith(path));
  };

  const handleDrawerToggle = () => {
    if (isDrawerOpen) {
      setIsAnimating(true);
      setTimeout(() => setIsDrawerOpen(false), 150);
    } else {
      setIsDrawerOpen(true);
    }
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const isItemExpanded = (itemId: string) => {
    return expandedItems.has(itemId) ||
           (itemId === 'inventory' && location.pathname.startsWith('/inventory')) ||
           (itemId === 'enterprise' && location.pathname.startsWith('/enterprise'));
  };

  const isLocked = (item: NavItem) => item.feature !== undefined && !hasFeature(item.feature);

  return (
    <>
      {/* Mobile Menu Button - Hidden when drawer is open but maintains space */}
      <div className="md:hidden fixed top-4 start-4 z-[60] w-12 h-12">
        <button
          onClick={handleDrawerToggle}
          className={`w-full h-full p-3 bg-slate-900/95 backdrop-blur-lg rounded-2xl border border-slate-700/50 shadow-xl hover:bg-slate-800/95 active:scale-95 transition-all duration-200 group ${
            isDrawerOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 pointer-events-auto scale-100'
          }`}
          aria-label="Open navigation menu"
          aria-expanded={isDrawerOpen}
        >
          <Menu className="h-5 w-5 text-slate-300 group-hover:text-white transition-colors" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`md:hidden fixed inset-0 z-[50] transition-all duration-300 ease-out ${
          isDrawerOpen ? 'bg-black/60 backdrop-blur-sm' : 'pointer-events-none opacity-0'
        }`}
        onClick={handleDrawerToggle}
        aria-hidden={!isDrawerOpen}
      />

      {/* Mobile Drawer */}
      <aside className={`md:hidden fixed top-0 start-0 h-full w-80 max-w-[85vw] z-[55] transform transition-all duration-300 ease-out ${
        isDrawerOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
      } ${isAnimating ? 'scale-[0.98]' : 'scale-100'}`}>
        <div className="h-full bg-slate-900/98 backdrop-blur-xl border-e border-slate-800/30 shadow-2xl overflow-y-auto">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/30 bg-gradient-to-r from-slate-900/50 to-slate-800/50 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">BT</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Business Terminal</h2>
                <p className="text-xs text-slate-400">Professional Management</p>
              </div>
            </div>
            <button
              onClick={handleDrawerToggle}
              className="p-2.5 rounded-xl hover:bg-gray-800/50 active:scale-95 transition-all duration-200 group"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const expanded = isItemExpanded(item.id);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const locked = isLocked(item);

              if (locked && item.feature) {
                const featureInfo = FEATURE_DISPLAY[item.feature];
                const planInfo = PLAN_DISPLAY[featureInfo.requiredPlan];
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => handleLockedNavClick(item.feature!)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 text-slate-600 opacity-50 hover:opacity-70"
                      aria-label={`${item.label} — requires ${planInfo.name} plan`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-start">
                        <div className="font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs opacity-70 mt-0.5">{item.description}</div>
                        )}
                      </div>
                      <Lock className="h-3 w-3 text-amber-400/70" aria-hidden="true" />
                    </button>
                  </div>
                );
              }

              return (
                <div key={item.id}>
                  <button
                    onClick={() => hasSubItems ? toggleExpanded(item.id) : handleNavClick(item.path)}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600/20 to-indigo-700/20 text-indigo-400 border border-indigo-600/30 shadow-lg'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 active:scale-[0.98]'
                    }`}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="relative">
                      <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-indigo-400' : ''}`} />
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-start">
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs opacity-70 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    {hasSubItems ? (
                      <ChevronDown className={`h-4 w-4 transition-all duration-200 ${
                        expanded ? 'rotate-180' : ''
                      }`} />
                    ) : (
                      <ChevronRight className={`h-4 w-4 transition-all duration-200 ${
                        active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                      }`} />
                    )}
                  </button>

                  {/* Sub-items */}
                  {hasSubItems && expanded && (
                    <div className="ms-4 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {item.subItems!.map((subItem, subIndex) => {
                        const SubIcon = subItem.icon;
                        const subActive = isActive(subItem.path);

                        return (
                          <button
                            key={subItem.id}
                            onClick={() => handleNavClick(subItem.path)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                              subActive
                                ? 'bg-indigo-600/10 text-indigo-400 border-s-2 border-indigo-400'
                                : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-300'
                            }`}
                            style={{
                              animationDelay: `${(index * 50) + (subIndex * 30)}ms`,
                            }}
                          >
                            <SubIcon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${subActive ? 'text-indigo-400' : ''}`} />
                            <div className="flex-1 text-start">
                              <div className="text-sm font-medium">{subItem.label}</div>
                              {subItem.description && (
                                <div className="text-xs opacity-60 mt-0.5">{subItem.description}</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Drawer Footer */}
          <div className="mt-auto p-6 border-t border-slate-800/30 bg-gradient-to-t from-slate-900/50 to-transparent">
            {/* Support Links */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <button
                onClick={() => handleSupportAction('whatsapp')}
                className="flex items-center gap-3 p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 transition-all hover:bg-green-500/20 hover:border-green-500/50"
              >
                <PhoneCall className="h-4 w-4" />
                <div className="text-start">
                  <div className="text-sm font-medium">WhatsApp Support</div>
                  <div className="text-xs opacity-70">Chat with support team</div>
                </div>
              </button>

              <button
                onClick={() => handleSupportAction('instagram')}
                className="flex items-center gap-3 p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/50"
              >
                <MessageCircle className="h-4 w-4" />
                <div className="text-start">
                  <div className="text-sm font-medium">Instagram</div>
                  <div className="text-xs opacity-70">Follow us for updates</div>
                </div>
              </button>

              <button
                onClick={() => handleSupportAction('email')}
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-500/50"
              >
                <Mail className="h-4 w-4" />
                <div className="text-start">
                  <div className="text-sm font-medium">Email Support</div>
                  <div className="text-xs opacity-70">Send us a message</div>
                </div>
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              Secure Logout
            </button>

            {/* Version Info */}
            <div className="flex items-center justify-between mb-3 mt-4">
              <div className="text-xs text-slate-500">Version 1.0.0</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-500">Online</span>
              </div>
            </div>
            <div className="text-xs text-slate-600 text-center">
              © 2024 Business Terminal
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation — first 5 items only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/98 backdrop-blur-xl border-t border-slate-800/30 z-50 mobile-bottom-safe" style={{ height: 'auto', minHeight: 'max(60px, env(safe-area-inset-bottom) + 60px)' }}>
        <div className="flex justify-around items-center py-3 pb-safe-area">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const locked = isLocked(item);

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (locked && item.feature) {
                    handleLockedNavClick(item.feature);
                  } else {
                    handleNavClick(item.path);
                  }
                }}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] relative group ${
                  locked
                    ? 'text-slate-600 opacity-50'
                    : active
                      ? 'text-indigo-400'
                      : 'text-slate-500 hover:text-slate-300 active:scale-95'
                }`}
                aria-label={item.label}
                aria-current={active && !locked ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${active && !locked ? 'text-indigo-400' : ''}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                  {locked && (
                    <Lock className="absolute -top-1 -right-1 h-3 w-3 text-amber-400/70" />
                  )}
                </div>
                <span className={`text-xs font-medium transition-all duration-200 ${
                  active && !locked ? 'text-indigo-400 font-semibold' : ''
                }`}>
                  {item.label}
                </span>
                {active && !locked && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
