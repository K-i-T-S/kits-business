import { CheckCircle, ChefHat, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { RestaurantOrderItem } from '@/types/restaurant';
import { COURSE_LABELS } from '@/types/restaurant';

interface OrderTicketProps {
  tableNumber: number;
  tableName: string | null;
  orderId: string;
  items: RestaurantOrderItem[];
  openedAt: string;
  onBump: (itemId: string) => void;
  onBumpAll: () => void;
}

function useElapsedSeconds(since: string): number {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(since).getTime()) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(since).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [since]);

  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ageClass(seconds: number): string {
  if (seconds < 300) return 'border-emerald-500/60 bg-emerald-500/5'; // < 5 min — green
  if (seconds < 600) return 'border-amber-500/60 bg-amber-500/5'; // < 10 min — yellow
  return 'border-red-500/60 bg-red-500/5'; // > 10 min — red
}

function ageTextClass(seconds: number): string {
  if (seconds < 300) return 'text-emerald-400';
  if (seconds < 600) return 'text-amber-400';
  return 'text-red-400';
}

export default function OrderTicket({
  tableNumber,
  tableName,
  items,
  openedAt,
  onBump,
  onBumpAll,
}: OrderTicketProps) {
  const { t } = useTranslation();
  const elapsed = useElapsedSeconds(openedAt);
  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'in_progress');

  const groupedByCourse = items.reduce<Record<string, RestaurantOrderItem[]>>((acc, item) => {
    const course = item.course;
    if (!acc[course]) acc[course] = [];
    acc[course].push(item);
    return acc;
  }, {});

  return (
    <div className={`flex flex-col rounded-2xl border-2 ${ageClass(elapsed)} overflow-hidden`}>
      {/* Ticket header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-white/60" />
          <span className="font-bold text-white">
            {t('restaurant.table', 'T')}{tableNumber}
            {tableName && <span className="ml-1 text-sm font-normal text-white/50">{tableName}</span>}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-sm font-bold ${ageTextClass(elapsed)}`}>
          <Clock className="h-3.5 w-3.5" />
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Items by course */}
      <div className="flex-1 p-3 space-y-3">
        {Object.entries(groupedByCourse).map(([course, courseItems]) => (
          <div key={course}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {COURSE_LABELS[course as keyof typeof COURSE_LABELS] ?? course}
            </div>
            <div className="space-y-1.5">
              {courseItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 ${
                    item.status === 'ready' ? 'bg-emerald-500/10 opacity-60' : 'bg-white/5'
                  }`}
                >
                  <span className="flex-1">
                    <span className="text-sm font-medium text-white">
                      {item.quantity}× {item.product_name}
                    </span>
                    {item.modifiers.length > 0 && (
                      <div className="mt-0.5 text-xs text-white/40">
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="mt-0.5 text-xs text-amber-400/80 italic">{item.notes}</div>
                    )}
                  </span>
                  <button
                    onClick={() => onBump(item.id)}
                    disabled={item.status === 'ready' || item.status === 'served'}
                    className={`flex-shrink-0 rounded-lg p-1.5 transition-all ${
                      item.status === 'ready' || item.status === 'served'
                        ? 'text-emerald-400 cursor-default'
                        : 'text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400'
                    }`}
                    title={t('restaurant.bump', 'Mark ready')}
                    aria-label={`Mark ${item.product_name} as ready`}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bump all button */}
      {pendingItems.length > 0 && (
        <div className="border-t border-white/10 p-3">
          <button
            onClick={onBumpAll}
            className="w-full rounded-xl bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/30"
          >
            {t('restaurant.bumpAll', 'All Ready')} ({pendingItems.length})
          </button>
        </div>
      )}
    </div>
  );
}
