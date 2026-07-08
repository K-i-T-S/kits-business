import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { RestaurantBundle, RestaurantBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface BundleOrderModalProps {
  bundle: RestaurantBundle;
  courses: RestaurantBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  defaultPartySize: number;
  tableOrderId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BundleOrderModal({
  bundle,
  courses,
  courseItems,
  menuItems,
  defaultPartySize,
  tableOrderId,
  onClose,
  onConfirm,
}: BundleOrderModalProps) {
  const { t } = useTranslation();
  const [partySize, setPartySize] = useState(Math.max(1, defaultPartySize));
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const sortedCourses = [...courses].sort((a, b) => a.sort_order - b.sort_order);

  const eligibleItemsFor = (courseId: string): RestaurantMenuItem[] =>
    courseItems
      .filter((ci) => ci.bundle_course_id === courseId)
      .map((ci) => menuItems.find((mi) => mi.id === ci.menu_item_id))
      .filter((mi): mi is RestaurantMenuItem => mi !== undefined && mi.is_active);

  const selectItem = (courseId: string, menuItemId: string) => {
    setSelections((prev) => ({ ...prev, [courseId]: menuItemId }));
  };

  const allSelected = sortedCourses.length > 0 && sortedCourses.every((c) => selections[c.id] !== undefined);
  const canConfirm = allSelected && partySize >= 1 && !submitting;
  const totalPrice = bundle.price_per_guest_usd * partySize;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const p_course_selections = sortedCourses.map((c) => ({
        bundle_course_id: c.id,
        menu_item_id: selections[c.id],
      }));
      const { error } = await supabase.rpc('add_bundle_to_order', {
        p_table_order_id: tableOrderId,
        p_bundle_id: bundle.id,
        p_party_size: partySize,
        p_course_selections,
      });
      if (error) throw new Error(error.message);
      toast.success(t('restaurant.bundle.added', 'Bundle added — sent to running order'));
      onConfirm();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('restaurant.bundle.addFailed', 'Failed to add bundle'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-slate-900 p-5 pb-safe max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">🎁 {bundle.name}</h3>
            {bundle.name_ar && <p className="text-sm text-white/40" dir="rtl">{bundle.name_ar}</p>}
            <p className="mt-0.5 text-lg font-black text-emerald-400">
              ${bundle.price_per_guest_usd.toFixed(2)} {t('restaurant.bundle.perGuest', 'per guest')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/40 hover:bg-white/10 transition-all"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Party size stepper */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/40">
            {t('restaurant.bundle.partySize', 'Party Size')}
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPartySize((p) => Math.max(1, p - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white active:scale-95 transition-all"
              aria-label="Decrease party size"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-12 text-center text-2xl font-black text-white">{partySize}</span>
            <button
              onClick={() => setPartySize((p) => p + 1)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all"
              aria-label="Increase party size"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Course sections */}
        <div className="mb-5 space-y-5">
          {sortedCourses.map((course) => {
            const eligible = eligibleItemsFor(course.id);
            const selected = selections[course.id];
            return (
              <div key={course.id}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">
                  {course.label}
                </p>
                {eligible.length === 0 ? (
                  <p className="text-xs italic text-white/30">
                    {t('restaurant.bundle.noItemsAvailable', 'Not available right now')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {eligible.map((item) => {
                      const isSelected = selected === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItem(course.id, item.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-600/30 text-white'
                              : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => { void handleConfirm(); }}
          disabled={!canConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-4 text-sm font-bold text-white active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          {t('restaurant.bundle.addToOrder', 'Add Bundle to Order')} · ${totalPrice.toFixed(2)}
        </button>
        {!allSelected && (
          <p className="mt-2 text-center text-xs text-red-400">
            {t('restaurant.modifier.pleaseSelect', 'Please complete all required selections')}
          </p>
        )}
      </div>
    </div>
  );
}
