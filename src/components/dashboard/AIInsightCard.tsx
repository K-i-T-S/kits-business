import { AlertTriangle, Info, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Product, Sale } from '@/context/AppContext';

interface AIInsightCardProps {
  sales: Sale[];
  products: Product[];
}

type InsightType = 'positive' | 'warning' | 'info' | 'negative';

interface Insight {
  type: InsightType;
  text: string;
}

function computeInsights(sales: Sale[], products: Product[]): Insight[] {
  const insights: Insight[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const todaySales = sales.filter((s) => new Date(s.date).toDateString() === today);
  const yesterdaySales = sales.filter((s) => new Date(s.date).toDateString() === yesterdayStr);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + s.total, 0);

  if (yesterdayRevenue > 0 && todayRevenue > 0) {
    const pct = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    if (pct >= 10) {
      insights.push({
        type: 'positive',
        text: `Revenue is ${pct.toFixed(0)}% above yesterday's pace at this hour.`,
      });
    } else if (pct <= -10) {
      insights.push({
        type: 'negative',
        text: `Revenue is ${Math.abs(pct).toFixed(0)}% below yesterday's pace.`,
      });
    }
  }

  const lowStockCount = products.reduce(
    (count, p) =>
      count + p.variants.filter((v) => v.stock > 0 && v.stock <= v.reorderLevel).length,
    0,
  );
  if (lowStockCount > 0) {
    insights.push({
      type: 'warning',
      text: `${lowStockCount} product variant${lowStockCount > 1 ? 's are' : ' is'} below the reorder threshold and may run out soon.`,
    });
  }

  const outOfStockCount = products.reduce(
    (count, p) => count + p.variants.filter((v) => v.stock === 0).length,
    0,
  );
  if (outOfStockCount > 0) {
    insights.push({
      type: 'negative',
      text: `${outOfStockCount} variant${outOfStockCount > 1 ? 's are' : ' is'} completely out of stock — customers cannot purchase them.`,
    });
  }

  if (todaySales.length > 0) {
    const avg = todayRevenue / todaySales.length;
    insights.push({
      type: 'info',
      text: `Average transaction value today: $${avg.toFixed(2)} across ${todaySales.length} sale${todaySales.length !== 1 ? 's' : ''}.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      text: 'No activity yet today. Business insights will appear here as transactions are recorded.',
    });
  }

  return insights.slice(0, 4);
}

const INSIGHT_ICONS: Record<InsightType, typeof TrendingUp> = {
  positive: TrendingUp,
  negative: TrendingDown,
  warning: AlertTriangle,
  info: Info,
};

const INSIGHT_STYLES: Record<InsightType, string> = {
  positive: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  negative: 'border-red-500/20 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
};

export default function AIInsightCard({ sales, products }: AIInsightCardProps) {
  const { t } = useTranslation();
  const insights = useMemo(() => computeInsights(sales, products), [sales, products]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20">
          <Sparkles className="h-4 w-4 text-indigo-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {t('dashboard.aiPowered', 'AI Powered')}
          </p>
          <h3 className="text-base font-bold text-white">
            {t('dashboard.businessInsights', 'Business Insights')}
          </h3>
        </div>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => {
          const Icon = INSIGHT_ICONS[insight.type];
          return (
            <div
              key={i}
              className={`flex gap-2.5 rounded-xl border p-3 ${INSIGHT_STYLES[insight.type]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm leading-relaxed">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
