import { ShoppingBasket, AlertTriangle, BarChart3, Scale, Tag, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import TillReconciliationComponent from '@/components/supermarket/TillReconciliation';

export default function SupermarketHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const quickLinks = [
    {
      icon: BarChart3,
      label: t('supermarket.departments', 'Departments'),
      desc: t('supermarket.departmentsDesc', 'P&L per department, product assignments, shrinkage targets'),
      href: '/supermarket/departments',
      gradient: 'from-green-600/20 to-lime-600/20',
      border: 'border-green-500/30',
      iconColor: 'text-green-400',
    },
    {
      icon: AlertTriangle,
      label: t('supermarket.shelfLife', 'Shelf Life Tracker'),
      desc: t('supermarket.shelfLifeDesc', 'Lot expiry, FIFO/FEFO enforcement, pull & destroy'),
      href: '/supermarket/shelf-life',
      gradient: 'from-amber-600/20 to-orange-600/20',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      icon: Scale,
      label: t('supermarket.pluCodes', 'PLU Codes'),
      desc: t('supermarket.pluCodesDesc', 'Weight items, price-per-kg, produce codes'),
      href: '/supermarket/departments',
      gradient: 'from-sky-600/20 to-blue-600/20',
      border: 'border-sky-500/30',
      iconColor: 'text-sky-400',
    },
    {
      icon: Tag,
      label: t('supermarket.bulkPricing', 'Bulk Pricing'),
      desc: t('supermarket.bulkPricingDesc', 'Buy-X-get-Y, quantity breaks, case prices'),
      href: '/supermarket/departments',
      gradient: 'from-purple-600/20 to-violet-600/20',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-green-500/15 border border-green-500/30 rounded-xl flex items-center justify-center">
              <ShoppingBasket className="w-5 h-5 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t('supermarket.title', 'Supermarket')}</h1>
          </div>
          <p className="text-white/50 text-sm ml-13">
            {t('supermarket.hubDesc', 'Departments, shelf life tracking, PLU codes, bulk pricing, and till reconciliation')}
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(link => (
            <button
              key={link.href + link.label}
              onClick={() => { void navigate(link.href); }}
              className={`text-left p-5 rounded-2xl bg-gradient-to-br ${link.gradient} border ${link.border} hover:scale-[1.02] transition-transform`}
            >
              <link.icon className={`w-6 h-6 ${link.iconColor} mb-3`} />
              <div className="text-white font-semibold">{link.label}</div>
              <div className="text-white/50 text-sm mt-1">{link.desc}</div>
            </button>
          ))}
        </div>

        {/* Till Reconciliation section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold">{t('supermarket.tillReconciliation', 'End-of-Day Till Reconciliation')}</h2>
          </div>
          <TillReconciliationComponent />
        </div>
      </div>
    </Layout>
  );
}
