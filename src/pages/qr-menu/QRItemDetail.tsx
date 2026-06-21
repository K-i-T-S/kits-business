import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';

import type { QRMenuData, RestaurantMenuItem } from '@/types/restaurant';

interface QRItemDetailProps {
  item: RestaurantMenuItem;
  menuData: QRMenuData;
  lang: 'en' | 'ar';
  onClose: () => void;
  onAddToCart: (
    item: RestaurantMenuItem,
    quantity: number,
    selectedModifiers: Record<string, string[]>,
    notes: string,
    priceDelta: number,
  ) => void;
}

const ALLERGEN_EMOJIS: Record<string, string> = {
  nuts: '🥜 Nuts',
  gluten: '🌾 Gluten',
  dairy: '🥛 Dairy',
  eggs: '🥚 Eggs',
  shellfish: '🦐 Shellfish',
  fish: '🐟 Fish',
  soy: '🫘 Soy',
  sesame: '🌾 Sesame',
};

export default function QRItemDetail({ item, menuData, lang, onClose, onAddToCart }: QRItemDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll({ container: scrollRef });
  const heroY = useTransform(scrollY, [0, 200], [0, -60]);

  const name = lang === 'ar' && item.name_ar ? item.name_ar : item.name;
  const description = lang === 'ar' && item.description_ar ? item.description_ar : item.description;

  // Get modifier groups linked to this item
  const linkedGroupIds = menuData.item_modifier_links
    .filter((l) => l.menu_item_id === item.id)
    .map((l) => l.modifier_group_id);
  const linkedGroups = menuData.modifier_groups.filter((g) => linkedGroupIds.includes(g.id));

  const toggleModifier = (groupId: string, modifierId: string, maxSelections: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(modifierId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== modifierId) };
      }
      if (maxSelections === 1) {
        return { ...prev, [groupId]: [modifierId] };
      }
      if (current.length < maxSelections) {
        return { ...prev, [groupId]: [...current, modifierId] };
      }
      return prev;
    });
  };

  const modifierPriceDelta = Object.entries(selectedModifiers).reduce((total, [, modIds]) => {
    return total + modIds.reduce((sum, modId) => {
      const mod = menuData.modifiers.find((m) => m.id === modId);
      return sum + (mod?.price_delta ?? 0);
    }, 0);
  }, 0);

  const unitPrice = item.base_price_usd + modifierPriceDelta;
  const totalPrice = unitPrice * quantity;

  const requiredGroups = linkedGroups.filter((g) => g.is_required);
  const allRequiredSelected = requiredGroups.every(
    (g) => (selectedModifiers[g.id]?.length ?? 0) > 0,
  );

  const handleAdd = () => {
    if (!allRequiredSelected) return;
    onAddToCart(item, quantity, selectedModifiers, notes, modifierPriceDelta);
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
      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero image with parallax */}
        <div ref={heroRef} className="relative h-64 w-full overflow-hidden sm:h-80">
          {item.photo_url ? (
            <motion.img
              src={item.photo_url}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ y: heroY }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-6xl"
              style={{ background: 'var(--qr-surface-2)' }}
            >
              🍽️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--qr-bg)] via-transparent to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            aria-label="Close"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* 86'd overlay */}
          {item.is_eighty_sixd && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="rounded-xl bg-amber-500/20 px-6 py-3 text-center">
                <p className="text-lg font-bold text-amber-400">Not Available Tonight</p>
                <p className="text-xs text-amber-400/70">Please choose another item</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-32">
          {/* Title + badges */}
          <div className="mt-1 mb-4">
            <div className="mb-2 flex flex-wrap gap-2">
              {item.is_chef_pick && (
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(var(--qr-accent-rgb),0.15)', color: 'var(--qr-accent)' }}>
                  👨‍🍳 Chef&apos;s Pick
                </span>
              )}
              {item.is_featured && (
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(var(--qr-accent-rgb),0.15)', color: 'var(--qr-accent)' }}>
                  ⭐ Featured
                </span>
              )}
              {item.calories && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text-muted)' }}>
                  🔥 {item.calories} cal
                </span>
              )}
            </div>

            <h2
              className="mb-1 text-2xl font-bold leading-tight"
              style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {name}
            </h2>

            <p className="text-xl font-semibold" style={{ color: 'var(--qr-accent)' }}>
              ${item.base_price_usd.toFixed(2)}
              {item.base_price_lbp && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--qr-text-muted)' }}>
                  / LBP {item.base_price_lbp.toLocaleString()}
                </span>
              )}
            </p>
          </div>

          {/* Description */}
          {description && (
            <div className="mb-5">
              <p
                className={`text-sm leading-relaxed ${!descExpanded ? 'line-clamp-3' : ''}`}
                style={{ color: 'var(--qr-text-muted)' }}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                {description}
              </p>
              {description.length > 120 && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-1 flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--qr-accent)' }}
                >
                  {descExpanded ? (
                    <><ChevronUp className="h-3 w-3" /> Show less</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> Read more</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Allergens */}
          {item.allergens.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qr-text-muted)' }}>
                Allergens
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.allergens.map((a) => (
                  <span
                    key={a}
                    className="rounded-full px-2.5 py-1 text-xs"
                    style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text-muted)' }}
                  >
                    {ALLERGEN_EMOJIS[a.toLowerCase()] ?? a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {linkedGroups.length > 0 && (
            <div className="mb-5 space-y-5">
              {linkedGroups.map((group) => {
                const groupModifiers = menuData.modifiers.filter((m) => m.group_id === group.id);
                const selected = selectedModifiers[group.id] ?? [];
                const groupName = lang === 'ar' && group.name_ar ? group.name_ar : group.name;

                return (
                  <div key={group.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold" style={{ color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                        {groupName}
                      </p>
                      <div className="flex items-center gap-2">
                        {group.is_required && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            Required
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                          {group.max_selections === 1 ? 'Pick 1' : `Up to ${group.max_selections}`}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {groupModifiers.map((mod) => {
                        const modName = lang === 'ar' && mod.name_ar ? mod.name_ar : mod.name;
                        const isSelected = selected.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => toggleModifier(group.id, mod.id, group.max_selections)}
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
                                {modName}
                              </span>
                            </div>
                            {mod.price_delta !== 0 && (
                              <span className="text-sm font-semibold" style={{ color: 'var(--qr-accent)' }}>
                                {mod.price_delta > 0 ? '+' : ''}${mod.price_delta.toFixed(2)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qr-text-muted)' }}>
              Special Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, preferences, or special requests..."
              rows={2}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                background: 'var(--qr-surface)',
                border: '1px solid var(--qr-border)',
                color: 'var(--qr-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div
        className="border-t px-5 py-4"
        style={{ background: 'var(--qr-surface)', borderColor: 'var(--qr-border)' }}
      >
        <div className="flex items-center gap-4">
          {/* Quantity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
              style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-lg font-bold" style={{ color: 'var(--qr-text)' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
              style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Add button */}
          <AnimatePresence mode="wait">
            <motion.button
              key={allRequiredSelected ? 'ready' : 'blocked'}
              onClick={handleAdd}
              disabled={!allRequiredSelected || item.is_eighty_sixd}
              className="flex flex-1 items-center justify-between rounded-2xl px-5 py-3.5 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-40"
              style={{
                background: allRequiredSelected && !item.is_eighty_sixd ? 'var(--qr-accent)' : 'var(--qr-surface-2)',
                color: allRequiredSelected && !item.is_eighty_sixd ? 'var(--qr-bg)' : 'var(--qr-text-muted)',
                boxShadow: allRequiredSelected && !item.is_eighty_sixd ? '0 4px 20px rgba(var(--qr-accent-rgb), 0.35)' : 'none',
              }}
              whileTap={{ scale: 0.97 }}
            >
              <span>Add to Order</span>
              <span>${totalPrice.toFixed(2)}</span>
            </motion.button>
          </AnimatePresence>
        </div>

        {!allRequiredSelected && (
          <p className="mt-2 text-center text-xs" style={{ color: '#f87171' }}>
            Please complete all required selections
          </p>
        )}
      </div>
    </motion.div>
  );
}
