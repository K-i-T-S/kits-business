import { TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { RESTAURANT_COLORS } from '@/constants/restaurantColors';

interface GlanceKpiWidgetProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent: string;
  trend?: { direction: 'up' | 'down'; label: string; good?: boolean };
}

/**
 * Track 2, Phase B prototype (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * the "glance" half of the shared ActionQueue/GlanceKPI widget pair being
 * pressure-tested for whether it can deliver genuinely different-feeling
 * office-role hubs (Accountant vs Stockkeeper) before committing to it as
 * Phase B's architecture. Presentational only — data fetching lives in
 * each hub's container component.
 */
export function GlanceKpiWidget({ label, value, icon, accent, trend }: GlanceKpiWidgetProps) {
  return (
    <motion.div
      className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{ background: RESTAURANT_COLORS.surface, borderColor: RESTAURANT_COLORS.border }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, borderColor: accent + '66' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: RESTAURANT_COLORS.textMuted }}>{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: RESTAURANT_COLORS.textPrimary }}>{value}</p>
      {trend && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: trend.good === false ? '#ef4444' : trend.good ? '#10b981' : RESTAURANT_COLORS.textTertiary }}
        >
          {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend.label}
        </div>
      )}
    </motion.div>
  );
}
