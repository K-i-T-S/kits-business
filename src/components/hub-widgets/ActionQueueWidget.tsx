import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { RESTAURANT_COLORS } from '@/constants/restaurantColors';

export interface ActionQueueItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  urgent?: boolean;
  actionLabel: string;
  onAction: () => void | Promise<void>;
}

interface ActionQueueWidgetProps {
  title: string;
  icon: ReactNode;
  accent: string;
  items: ActionQueueItem[];
  emptyLabel: string;
  loading?: boolean;
}

/**
 * Track 2, Phase B prototype (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * a ranked, one-tap-resolve list — the shared primitive proposed for every
 * "office role" hub (Owner/Manager/Supervisor/Accountant/Stockkeeper/
 * Receptionist). Being pressure-tested here: does reusing this same
 * component for genuinely different roles still produce screens that
 * *feel* different, or does it read as one screen with swapped data?
 * Presentational only — data fetching lives in each hub's container.
 */
export function ActionQueueWidget({ title, icon, accent, items, emptyLabel, loading }: ActionQueueWidgetProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleAction = async (item: ActionQueueItem) => {
    setResolvingId(item.id);
    try {
      await item.onAction();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ background: RESTAURANT_COLORS.surface, borderColor: RESTAURANT_COLORS.border }}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ color: accent }}>{icon}</span>
        <h3 className="text-sm font-semibold" style={{ color: RESTAURANT_COLORS.textPrimary }}>{title}</h3>
        {items.length > 0 && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: accent + '22', color: accent }}
          >
            {items.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: RESTAURANT_COLORS.textMuted }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-6 w-6" style={{ color: '#10b981' }} />
          <p className="text-xs" style={{ color: RESTAURANT_COLORS.textMuted }}>{emptyLabel}</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: item.urgent ? '#ef444444' : RESTAURANT_COLORS.border,
                background: item.urgent ? 'rgba(239,68,68,0.06)' : RESTAURANT_COLORS.glass,
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: RESTAURANT_COLORS.textPrimary }}>
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="truncate text-xs" style={{ color: RESTAURANT_COLORS.textTertiary }}>{item.subtitle}</p>
                )}
              </div>
              {item.meta && (
                <span className="shrink-0 text-xs font-medium" style={{ color: RESTAURANT_COLORS.textTertiary }}>
                  {item.meta}
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleAction(item)}
                disabled={resolvingId === item.id}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
                style={{ background: accent + '22', color: accent }}
              >
                {resolvingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.actionLabel}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
