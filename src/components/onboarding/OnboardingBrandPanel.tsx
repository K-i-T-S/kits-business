import { Building2, Package, Users, CheckCircle, Check } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';

import { BRAND } from '@/constants/branding';
import type { Industry } from '@/types/industry';

import { STEP2_COPY, STEP_NARRATIVE } from './stepCopy';

interface OnboardingBrandPanelProps {
  step: number;
  businessName: string;
  industry: Industry | '';
}

export default function OnboardingBrandPanel({
  step,
  businessName,
  industry,
}: OnboardingBrandPanelProps): React.ReactElement {
  const logoRef = useRef<HTMLDivElement>(null);
  const step2Copy = STEP2_COPY[industry];
  const narrative = STEP_NARRATIVE[step] ?? STEP_NARRATIVE[1] ?? { title: '', subtitle: '' };

  const steps = [
    { n: 1, label: 'Business Profile', icon: Building2 },
    { n: 2, label: step2Copy.stepperLabel, icon: Package },
    { n: 3, label: 'Invite Team', icon: Users },
    { n: 4, label: 'Done', icon: CheckCircle },
  ];

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

  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-slate-950 px-12 py-14 text-white">
      {/* Aurora background — same visual language as the Login page */}
      <div aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
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

        {/* Narrative + progress stepper */}
        <div className="flex flex-1 flex-col justify-center gap-8">
          <div key={step} className="feature-in">
            <h2 className="text-4xl font-bold leading-tight text-white">{narrative.title}</h2>
            <p className="mt-3 max-w-sm text-base text-white/60">{narrative.subtitle}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex flex-col">
              {steps.map((s, i) => {
                const done = s.n < step;
                const active = s.n === step;
                const Icon = s.icon;
                return (
                  <div key={s.n} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                          done
                            ? 'border-indigo-500/40 bg-indigo-500/20'
                            : active
                              ? 'border-indigo-400 bg-indigo-500/30'
                              : 'border-white/10 bg-white/5'
                        }`}
                      >
                        {done ? (
                          <Check className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                        ) : (
                          <Icon className={`h-4 w-4 ${active ? 'text-indigo-300' : 'text-white/30'}`} aria-hidden="true" />
                        )}
                        {active && (
                          <span
                            className="absolute inset-0 animate-pulse rounded-xl border-2 border-indigo-400/60"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`h-6 w-px ${done ? 'bg-indigo-500/40' : 'bg-white/10'}`} />
                      )}
                    </div>
                    <span
                      className={`pb-6 text-sm font-medium transition-colors ${
                        active ? 'text-white' : done ? 'text-white/60' : 'text-white/30'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live brand preview — updates as the founder types their business name in Step 1 */}
          {businessName.trim() && (
            <div className="feature-in flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div
                className="h-8 w-8 flex-shrink-0 rounded-full"
                style={{ background: 'var(--brand-primary)' }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{businessName}</p>
                <p className="text-xs text-white/40">Powered by KiTS</p>
              </div>
            </div>
          )}
        </div>

        {/* Reassurance footer */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">
            Takes about 2 minutes · Skip any step and finish later from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
