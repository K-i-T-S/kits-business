import { BarChart3, Package, ShoppingCart, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const ACTIONS = [
  {
    titleKey: 'dashboard.newOrder',
    titleFallback: 'New Sale',
    icon: ShoppingCart,
    link: '/pos',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    hoverBg: 'hover:bg-emerald-500/10',
    testId: 'nav-pos',
  },
  {
    titleKey: 'dashboard.addProduct',
    titleFallback: 'Add Product',
    icon: Package,
    link: '/inventory',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    hoverBg: 'hover:bg-indigo-500/10',
    testId: 'nav-inventory',
  },
  {
    titleKey: 'dashboard.viewReports',
    titleFallback: 'View Reports',
    icon: BarChart3,
    link: '/reports',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    hoverBg: 'hover:bg-purple-500/10',
    testId: 'nav-reports',
  },
  {
    titleKey: 'employees.manageTeam',
    titleFallback: 'Manage Team',
    icon: UserCircle,
    link: '/employees',
    gradient: 'linear-gradient(135deg, #64748b, #475569)',
    hoverBg: 'hover:bg-slate-500/10',
    testId: 'nav-employees',
  },
] as const;

export default function QuickActions() {
  const { t } = useTranslation();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        {t('dashboard.quickActions', 'Quick Actions')}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <Link
            key={action.link}
            to={action.link}
            data-testid={action.testId}
            className={`group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-slate-800/40 py-5 text-white transition-all duration-200 hover:scale-[1.03] hover:border-white/20 hover:shadow-lg ${action.hoverBg}`}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-transform duration-200 group-hover:scale-110"
              style={{ background: action.gradient }}
            >
              <action.icon className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold">
              {t(action.titleKey, action.titleFallback)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
