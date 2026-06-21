import { Pill, FileText, Shield, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import InsuranceCoPay from '@/components/pharmacy/InsuranceCoPay';

export default function PharmacyHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const quickLinks = [
    {
      icon: Pill,
      label: t('pharmacy.drugDatabase', 'Drug Database'),
      desc: t('pharmacy.drugDatabaseDesc', 'Search, add drugs, manage lots & FEFO'),
      href: '/pharmacy/drugs',
      gradient: 'from-emerald-600/20 to-teal-600/20',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      icon: FileText,
      label: t('pharmacy.prescriptions', 'Prescriptions'),
      desc: t('pharmacy.prescriptionsDesc', 'Create and fill patient prescriptions'),
      href: '/pharmacy/prescriptions',
      gradient: 'from-sky-600/20 to-indigo-600/20',
      border: 'border-sky-500/30',
      iconColor: 'text-sky-400',
    },
    {
      icon: Shield,
      label: t('pharmacy.narcoticsRegister', 'Narcotics Register'),
      desc: t('pharmacy.narcoticsDesc', 'Law 673/1998 controlled substance log'),
      href: '/pharmacy/narcotics',
      gradient: 'from-red-600/20 to-orange-600/20',
      border: 'border-red-500/30',
      iconColor: 'text-red-400',
    },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <Pill className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t('pharmacy.title', 'Pharmacy')}</h1>
          </div>
          <p className="text-white/50 text-sm ml-13">
            {t('pharmacy.hubDesc', 'Drug database, prescriptions, narcotics register, and insurance claims')}
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <button
              key={link.href}
              onClick={() => { void navigate(link.href); }}
              className={`text-left p-5 rounded-2xl bg-gradient-to-br ${link.gradient} border ${link.border} hover:scale-[1.02] transition-transform`}
            >
              <link.icon className={`w-6 h-6 ${link.iconColor} mb-3`} />
              <div className="text-white font-semibold">{link.label}</div>
              <div className="text-white/50 text-sm mt-1">{link.desc}</div>
            </button>
          ))}
        </div>

        {/* Insurance claims section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold">{t('pharmacy.insuranceClaims', 'Insurance Claims')}</h2>
          </div>
          <InsuranceCoPay />
        </div>
      </div>
    </Layout>
  );
}
