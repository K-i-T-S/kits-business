import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import type { Sale } from '@/context/AppContext';

interface RevenueChartProps {
  sales: Sale[];
}

interface DayData {
  date: string;
  revenue: number;
}

export default function RevenueChart({ sales }: RevenueChartProps) {
  const { t } = useTranslation();

  const data = useMemo<DayData[]>(() => {
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateStr = d.toDateString();
      const revenue = sales
        .filter((s) => new Date(s.date).toDateString() === dateStr)
        .reduce((sum, s) => sum + s.total, 0);
      return { date: label, revenue };
    });
  }, [sales]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {t('dashboard.revenueChart', 'Revenue Chart')}
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-white">
          {t('dashboard.last30Days', 'Last 30 Days')}
        </h3>
      </div>
      <div dir="ltr">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: 12,
              }}
              formatter={(value) => [`$${(value as number).toFixed(2)}`, t('dashboard.revenue', 'Revenue')]}
              labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
