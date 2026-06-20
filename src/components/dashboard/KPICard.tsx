import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useCountUp } from '@/hooks/useCountUp';

interface KPICardProps {
  title: string;
  numericValue: number;
  format: (v: number) => string;
  subtitle: string;
  icon: LucideIcon;
  gradient: readonly [string, string];
  link: string;
  trend?: number;
  testId?: string;
}

export default function KPICard({
  title,
  numericValue,
  format,
  subtitle,
  icon: Icon,
  gradient,
  link,
  trend,
  testId,
}: KPICardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const animated = useCountUp(numericValue);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>): void => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale3d(1.03,1.03,1.03)`;
  }, []);

  const handleMouseLeave = useCallback((): void => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
  }, []);

  return (
    <Link
      ref={cardRef}
      to={link}
      data-testid={testId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-800/60 p-5 transition-all duration-200 ease-out will-change-transform hover:border-white/20 hover:shadow-2xl hover:shadow-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
        style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
          style={{ background: `linear-gradient(135deg, ${gradient[0]}cc, ${gradient[1]}99)` }}
        >
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend >= 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        {title}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white" dir="ltr">
        {format(animated)}
      </p>
      <p className="mt-1 text-xs text-white/50">{subtitle}</p>

      <ArrowUpRight
        aria-hidden="true"
        className="absolute bottom-4 right-4 h-4 w-4 text-white/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/50"
      />
    </Link>
  );
}
