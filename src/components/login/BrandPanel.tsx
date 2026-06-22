import {
  BarChart3,
  Instagram,
  Mail,
  MessageCircle,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { type MouseEvent, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { BRAND } from '@/constants/branding';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  color: string;
  bg: string;
}

const FEATURES: Feature[] = [
  {
    icon: ShoppingCart,
    titleKey: 'login.feature1Title',
    titleFallback: 'Lightning-Fast POS',
    descKey: 'login.feature1Desc',
    descFallback:
      'Process sales in seconds with barcode scanning, split payments, and WhatsApp receipts',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/20',
  },
  {
    icon: BarChart3,
    titleKey: 'login.feature2Title',
    titleFallback: 'Real-Time Analytics',
    descKey: 'login.feature2Desc',
    descFallback:
      'Daily P&L, margin analysis, and AI-powered forecasting — built for Lebanese SMBs',
    color: 'text-sky-400',
    bg: 'bg-sky-500/20',
  },
  {
    icon: Users,
    titleKey: 'login.feature3Title',
    titleFallback: 'Customer & Team Management',
    descKey: 'login.feature3Desc',
    descFallback:
      'CRM, loyalty points, employee attendance, and payroll with NSSF calculations',
    color: 'text-violet-400',
    bg: 'bg-violet-500/20',
  },
  {
    icon: Zap,
    titleKey: 'login.feature4Title',
    titleFallback: 'Native LBP / USD',
    descKey: 'login.feature4Desc',
    descFallback:
      "Dual-currency with 6 repricing algorithms — the only platform built for Lebanon's economy",
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
  },
];

const STATS = [
  { value: '500+', labelKey: 'login.statBusinesses', labelFallback: 'Lebanese Businesses' },
  { value: '$2M+', labelKey: 'login.statVolume', labelFallback: 'Monthly Volume' },
  { value: '99.9%', labelKey: 'login.statUptime', labelFallback: 'Uptime' },
];

export default function BrandPanel(): React.ReactElement {
  const { t } = useTranslation();
  const [activeFeature, setActiveFeature] = useState(0);
  const [featureAnimKey, setFeatureAnimKey] = useState(0);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
      setFeatureAnimKey((prev) => prev + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleLogoMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = logoRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(500px) rotateX(${y * -18}deg) rotateY(${x * 18}deg) scale(1.05)`;
    el.style.boxShadow = '0 20px 40px rgba(99,102,241,0.35)';
  };

  const handleLogoMouseLeave = () => {
    const el = logoRef.current;
    if (!el) return;
    el.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)';
    el.style.boxShadow = '';
  };

  const current = FEATURES.find((_, i) => i === activeFeature) ?? FEATURES[0];

  return (
    <div
      className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-slate-950 px-12 py-14 text-white"
      aria-hidden="false"
    >
      {/* Aurora background */}
      <div aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col gap-8">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          <div
            ref={logoRef}
            className="logo-3d-card flex h-14 w-14 cursor-default select-none items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg"
            onMouseMove={handleLogoMouseMove}
            onMouseLeave={handleLogoMouseLeave}
          >
            <img
              src="/logo.png"
              alt={`${BRAND.name} logo`}
              className="h-9 w-9 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{BRAND.shortName}</span>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                Business Terminal
              </span>
            </div>
            <p className="text-xs text-white/50">{BRAND.tagline}</p>
          </div>
        </div>

        {/* Hero copy + Feature cycling */}
        <div className="flex flex-1 flex-col justify-center gap-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight text-white">
              {t('login.heroTitle', 'The all-in-one platform built for Lebanon')}
            </h2>
            <p className="mt-3 max-w-sm text-base text-white/60">
              {t(
                'login.heroSubtitle',
                'POS · Inventory · CRM · Payroll · Analytics — under $79/month with self-serve onboarding.',
              )}
            </p>
          </div>

          {/* Animated feature card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            {current !== undefined && (
              <div key={featureAnimKey} className="feature-in flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${current.bg}`}
                >
                  <current.icon className={`h-6 w-6 ${current.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">
                    {t(current.titleKey, current.titleFallback)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {t(current.descKey, current.descFallback)}
                  </p>
                </div>
              </div>
            )}

            {/* Navigation dots */}
            <div className="mt-5 flex gap-1.5">
              {FEATURES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveFeature(i);
                    setFeatureAnimKey((prev) => prev + 1);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeFeature
                      ? 'w-6 bg-indigo-400'
                      : 'w-1.5 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Feature ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Social proof stats */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map((stat) => (
              <div
                key={stat.value}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
              >
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="mt-0.5 text-xs text-white/50">
                  {t(stat.labelKey, stat.labelFallback)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact strip */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2.5 text-xs font-medium text-white/60">
            {t('login.needHelp', 'Need help? Reach us at:')}
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <a
              href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/50 transition-colors hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
              {BRAND.supportWhatsApp}
            </a>
            <a
              href={`https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/50 transition-colors hover:text-white"
            >
              <Instagram className="h-3.5 w-3.5 text-pink-400" aria-hidden="true" />
              {BRAND.supportInstagram}
            </a>
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="flex items-center gap-1.5 text-white/50 transition-colors hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              {BRAND.supportEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
