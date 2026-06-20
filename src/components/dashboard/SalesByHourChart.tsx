import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import type { Sale } from '@/context/AppContext';

interface SalesByHourChartProps {
  sales: Sale[];
}

interface HourData {
  hour: string;
  count: number;
  isCurrent: boolean;
}

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

export default function SalesByHourChart({ sales }: SalesByHourChartProps) {
  const { t } = useTranslation();
  const currentHour = new Date().getHours();

  const data = useMemo<HourData[]>(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.date).toDateString() === today);
    return Array.from({ length: 24 }, (_, h) => ({
      hour: hourLabel(h),
      count: todaySales.filter((s) => new Date(s.date).getHours() === h).length,
      isCurrent: h === currentHour,
    }));
  }, [sales, currentHour]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {t('dashboard.salesActivity', 'Sales Activity')}
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-white">
          {t('dashboard.salesByHour', 'Sales by Hour')}
        </h3>
      </div>
      <div dir="ltr">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: 12,
              }}
              formatter={(value) => [value as number, t('pos.transactions', 'Transactions')]}
              labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={18}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.isCurrent
                      ? '#6366f1'
                      : entry.count > 0
                        ? '#6366f155'
                        : 'rgba(255,255,255,0.06)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
