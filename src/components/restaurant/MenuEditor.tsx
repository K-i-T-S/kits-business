import { Coffee, Moon, Sun, AlertTriangle, EyeOff, Eye } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/context/AppContext';

interface TimeSlot {
  key: 'breakfast' | 'lunch' | 'dinner';
  labelKey: string;
  labelFallback: string;
  icon: typeof Sun;
  defaultStart: string;
  defaultEnd: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { key: 'breakfast', labelKey: 'restaurant.menu.breakfast', labelFallback: 'Breakfast', icon: Coffee, defaultStart: '07:00', defaultEnd: '11:30' },
  { key: 'lunch', labelKey: 'restaurant.menu.lunch', labelFallback: 'Lunch', icon: Sun, defaultStart: '12:00', defaultEnd: '16:00' },
  { key: 'dinner', labelKey: 'restaurant.menu.dinner', labelFallback: 'Dinner', icon: Moon, defaultStart: '18:00', defaultEnd: '23:00' },
];

export default function MenuEditor() {
  const { t } = useTranslation();
  const { products } = useApp();

  const [eightySixList, setEightySixList] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Record<string, { start: string; end: string }>>({
    breakfast: { start: '07:00', end: '11:30' },
    lunch: { start: '12:00', end: '16:00' },
    dinner: { start: '18:00', end: '23:00' },
  });

  const toggle86 = (productId: string) => {
    setEightySixList((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Time-based Menu Slots */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/60 uppercase tracking-wider">
          {t('restaurant.menu.timeSlots', 'Menu Time Slots')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIME_SLOTS.map((slot) => {
            const SlotIcon = slot.icon;
            const current = slots[slot.key] ?? { start: slot.defaultStart, end: slot.defaultEnd };
            return (
              <div key={slot.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <SlotIcon className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-white">{t(slot.labelKey, slot.labelFallback)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={current.start}
                    onChange={(e) => setSlots((p) => ({ ...p, [slot.key]: { ...current, start: e.target.value } }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-2 py-1.5 text-xs text-white"
                    aria-label={`${t(slot.labelKey, slot.labelFallback)} start time`}
                  />
                  <span className="text-white/30 text-xs">–</span>
                  <input
                    type="time"
                    value={current.end}
                    onChange={(e) => setSlots((p) => ({ ...p, [slot.key]: { ...current, end: e.target.value } }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-2 py-1.5 text-xs text-white"
                    aria-label={`${t(slot.labelKey, slot.labelFallback)} end time`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 86 List */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            {t('restaurant.menu.eightySix', '86 List — Out of Stock')}
          </h3>
          {eightySixList.size > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {eightySixList.size} {t('restaurant.menu.items86', 'items 86\'d')}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {products.length === 0 && (
            <p className="text-sm text-white/30 py-4 text-center">{t('restaurant.menu.noProducts', 'No products — add products in Inventory first')}</p>
          )}
          {products.map((product) => {
            const is86d = eightySixList.has(product.id ?? '');
            return (
              <div
                key={product.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all ${
                  is86d ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'
                }`}
              >
                <span className={`text-sm ${is86d ? 'text-white/40 line-through' : 'text-white'}`}>
                  {product.name}
                </span>
                <button
                  onClick={() => toggle86(product.id ?? '')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    is86d
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                  }`}
                  aria-pressed={is86d}
                  aria-label={is86d ? `Remove ${product.name} from 86 list` : `Add ${product.name} to 86 list`}
                >
                  {is86d ? (
                    <>
                      <Eye className="h-3 w-3" />
                      {t('restaurant.menu.restore', 'Restore')}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      {t('restaurant.menu.eightySixItem', '86')}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
