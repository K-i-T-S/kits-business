import { motion } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';

import type { QRCartBundleSelection, QRMenuBundle, QRMenuBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

interface QRBundleDetailProps {
  bundle: QRMenuBundle;
  courses: QRMenuBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  lang: 'en' | 'ar';
  onClose: () => void;
  onAddToCart: (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => void;
}

export default function QRBundleDetail({ bundle, courses, courseItems, menuItems, lang, onClose, onAddToCart }: QRBundleDetailProps) {
  const [partySize, setPartySize] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({}); // courseId -> menuItemId

  const name = lang === 'ar' && bundle.name_ar ? bundle.name_ar : bundle.name;
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
  const canConfirm = allSelected && partySize >= 1;
  const totalPrice = bundle.price_per_guest_usd * partySize;

  const handleAdd = () => {
    if (!canConfirm) return;
    const built: QRCartBundleSelection[] = sortedCourses.map((c) => {
      const menuItemId = selections[c.id]!;
      const item = menuItems.find((mi) => mi.id === menuItemId);
      return { bundleCourseId: c.id, menuItemId, itemName: item?.name ?? '' };
    });
    onAddToCart(bundle, partySize, built);
    onClose();
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{ background: 'var(--qr-bg)' }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pb-32 pt-5">
          {/* Header: emoji badge + close, no hero image (bundles have no photo_url) */}
          <div className="mb-4 flex items-start justify-between">
            <span className="text-4xl">🎁</span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'var(--qr-surface-2)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" style={{ color: 'var(--qr-text)' }} />
            </button>
          </div>

          <h2
            className="mb-1 text-2xl font-bold leading-tight"
            style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {name}
          </h2>
          <p className="text-xl font-semibold" style={{ color: 'var(--qr-accent)' }}>
            ${bundle.price_per_guest_usd.toFixed(2)} / guest
          </p>
          {bundle.description && (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--qr-text-muted)' }}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {bundle.description}
            </p>
          )}

          {/* Party size stepper — defaults to 1, not table.seats like the staff
              BundleOrderModal: the QR flow has no reliable table-covers data
              client-side, and defaulting low is the safer failure mode. */}
          <div className="mb-6 mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qr-text-muted)' }}>
              Party Size
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
                aria-label="Decrease party size"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold" style={{ color: 'var(--qr-text)' }}>
                {partySize}
              </span>
              <button
                onClick={() => setPartySize((p) => p + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
                aria-label="Increase party size"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Courses */}
          <div className="space-y-5">
            {sortedCourses.map((course) => {
              const eligible = eligibleItemsFor(course.id);
              const selected = selections[course.id];
              return (
                <div key={course.id}>
                  <p className="mb-3 font-semibold" style={{ color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    {course.label}
                  </p>
                  {eligible.length === 0 ? (
                    <p className="text-sm italic" style={{ color: 'var(--qr-text-muted)' }}>
                      Not available right now
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {eligible.map((item) => {
                        const isSelected = selected === item.id;
                        const itemName = lang === 'ar' && item.name_ar ? item.name_ar : item.name;
                        return (
                          <button
                            key={item.id}
                            onClick={() => selectItem(course.id, item.id)}
                            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                            style={{
                              background: isSelected ? 'rgba(var(--qr-accent-rgb), 0.15)' : 'var(--qr-surface)',
                              border: `1px solid ${isSelected ? 'var(--qr-accent)' : 'var(--qr-border)'}`,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition-all"
                                style={{
                                  background: isSelected ? 'var(--qr-accent)' : 'transparent',
                                  border: `2px solid ${isSelected ? 'var(--qr-accent)' : 'var(--qr-border)'}`,
                                  color: 'var(--qr-bg)',
                                }}
                              >
                                {isSelected && '✓'}
                              </div>
                              <span className="text-sm" style={{ color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                {itemName}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="border-t px-5 py-4" style={{ background: 'var(--qr-surface)', borderColor: 'var(--qr-border)' }}>
        <button
          onClick={handleAdd}
          disabled={!canConfirm}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            background: canConfirm ? 'var(--qr-accent)' : 'var(--qr-surface-2)',
            color: canConfirm ? 'var(--qr-bg)' : 'var(--qr-text-muted)',
            boxShadow: canConfirm ? '0 4px 20px rgba(var(--qr-accent-rgb), 0.35)' : 'none',
          }}
        >
          <span>Add to Order</span>
          <span>${totalPrice.toFixed(2)}</span>
        </button>
        {!allSelected && (
          <p className="mt-2 text-center text-xs" style={{ color: '#f87171' }}>
            Please complete all course selections
          </p>
        )}
      </div>
    </motion.div>
  );
}
