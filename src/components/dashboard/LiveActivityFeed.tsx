import { Clock, DollarSign } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { Sale } from '@/context/AppContext';

interface LiveActivityFeedProps {
  sales: Sale[];
}

export default function LiveActivityFeed({ sales }: LiveActivityFeedProps) {
  const { t } = useTranslation();
  const today = new Date().toDateString();

  const recentSales = useMemo(
    () =>
      [...sales]
        .filter((s) => new Date(s.date).toDateString() === today)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [sales, today],
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {t('dashboard.liveFeed', 'Live Feed')}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-white">
            {t('dashboard.recentSales', 'Recent Sales')}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
          <span className="text-xs font-medium text-green-400">{t('dashboard.live', 'Live')}</span>
        </div>
      </div>

      {recentSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <DollarSign className="h-8 w-8 text-white/20" aria-hidden="true" />
          <p className="mt-3 text-sm text-white/40">
            {t('dashboard.noSalesToday', 'No sales recorded yet today.')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentSales.map((sale, i) => (
            <div
              key={sale.id}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
                  <DollarSign className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {t('dashboard.saleId', 'Sale')} #{sale.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-white/40">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {new Date(sale.date).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    <span className="capitalize">{sale.paymentMethod}</span>
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-white" dir="ltr">
                ${sale.total.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      {recentSales.length > 0 && (
        <Link
          to="/reports"
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
        >
          {t('dashboard.viewAllSales', 'View All Sales')}
        </Link>
      )}
    </div>
  );
}
