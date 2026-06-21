import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ShoppingCart, Wind } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';

import type { QRMenuData, RestaurantMenuItem, QRMenuTenant } from '@/types/restaurant';

interface QRMenuHomeProps {
  menuData: QRMenuData;
  lang: 'en' | 'ar';
  totalCartItems: number;
  onSelectItem: (item: RestaurantMenuItem) => void;
  onOpenCart: () => void;
  onCallWaiter: () => void;
  onFa7em: () => void;
  promotionalBanner: string | null;
  showBanner: boolean;
  onBannerTap: () => void;
}

// 3D tilt card
function ItemCard({
  item,
  lang,
  onClick,
}: {
  item: RestaurantMenuItem;
  lang: 'en' | 'ar';
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const name = lang === 'ar' && item.name_ar ? item.name_ar : item.name;
  const description = lang === 'ar' && item.description_ar ? item.description_ar : item.description;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;
    setTilt({ x: rotateX, y: rotateY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || !e.touches[0]) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    setTilt({ x: rotateX, y: rotateY });
  }, []);

  const resetTilt = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={resetTilt}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetTilt}
      className="qr-item-card qr-glass cursor-pointer overflow-hidden rounded-2xl"
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.02 : 1})`,
        boxShadow: isHovered ? '0 12px 40px rgba(var(--qr-accent-rgb), 0.2)' : '0 2px 12px rgba(0,0,0,0.3)',
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* 16:9 image */}
      <div className="relative aspect-video w-full overflow-hidden">
        {item.photo_url ? (
          <motion.img
            src={item.photo_url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
            initial={{ filter: 'blur(10px)', scale: 1.1 }}
            whileInView={{ filter: 'blur(0px)', scale: 1 }}
            transition={{ duration: 0.4 }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-4xl"
            style={{ background: 'var(--qr-surface-2)' }}
          >
            🍽️
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {item.is_chef_pick && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm" style={{ background: 'rgba(var(--qr-accent-rgb),0.8)', color: 'var(--qr-bg)' }}>
              👨‍🍳 Chef&apos;s Pick
            </span>
          )}
          {item.is_featured && !item.is_chef_pick && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm" style={{ background: 'rgba(var(--qr-accent-rgb),0.8)', color: 'var(--qr-bg)' }}>
              ⭐ Featured
            </span>
          )}
        </div>

        {/* 86'd overlay */}
        {item.is_eighty_sixd && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
            <div
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              Not Available Tonight
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              {name}
            </p>
            {description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--qr-text-muted)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {description}
              </p>
            )}
          </div>
          <p className="flex-shrink-0 text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
            ${item.base_price_usd.toFixed(2)}
          </p>
        </div>
        {item.calories && (
          <p className="mt-1 text-[10px]" style={{ color: 'var(--qr-text-muted)' }}>
            🔥 {item.calories} cal
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Horizontal featured scroll section
function FeaturedSection({
  items,
  lang,
  onSelectItem,
  title,
  emoji,
}: {
  items: RestaurantMenuItem[];
  lang: 'en' | 'ar';
  onSelectItem: (item: RestaurantMenuItem) => void;
  title: string;
  emoji: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2 px-4">
        <span className="text-lg">{emoji}</span>
        <h3 className="text-base font-bold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
          {title}
        </h3>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map((item) => (
          <div key={item.id} className="w-56 flex-shrink-0">
            <ItemCard item={item} lang={lang} onClick={() => onSelectItem(item)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Category pills
function CategoryPills({
  categories,
  selectedId,
  lang,
  onSelect,
}: {
  categories: QRMenuData['categories'];
  selectedId: string | null;
  lang: 'en' | 'ar';
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 flex gap-2 overflow-x-auto px-4 py-3"
      style={{ background: 'var(--qr-bg)', scrollbarWidth: 'none' }}
    >
      <button
        onClick={() => onSelect(null)}
        className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
        style={{
          background: selectedId === null ? 'var(--qr-accent)' : 'var(--qr-surface)',
          color: selectedId === null ? 'var(--qr-bg)' : 'var(--qr-text-muted)',
          border: '1px solid var(--qr-border)',
        }}
      >
        🍽️ All
      </button>
      {categories.map((cat) => {
        const catName = lang === 'ar' && cat.name_ar ? cat.name_ar : cat.name;
        const isSelected = selectedId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
            style={{
              background: isSelected ? 'var(--qr-accent)' : 'var(--qr-surface)',
              color: isSelected ? 'var(--qr-bg)' : 'var(--qr-text-muted)',
              border: '1px solid var(--qr-border)',
            }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {cat.icon === 'utensils' ? '🍽️' : cat.icon} {catName}
          </button>
        );
      })}
    </div>
  );
}

// Tenant hero header
function TenantHero({ tenant, lang }: { tenant: QRMenuTenant; lang: 'en' | 'ar' }) {
  return (
    <div className="relative overflow-hidden px-4 pt-6 pb-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: tenant.brand_primary ?? 'var(--qr-accent)' }}
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        {tenant.brand_logo_url ? (
          <motion.img
            src={tenant.brand_logo_url}
            alt={tenant.name}
            className="h-16 w-16 rounded-2xl object-cover shadow-lg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg"
            style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)', color: 'var(--qr-accent)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {tenant.name.charAt(0)}
          </motion.div>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          {tenant.name}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--qr-text-muted)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Kitchen Open
        </motion.div>
      </div>
    </div>
  );
}

export default function QRMenuHome({
  menuData,
  lang,
  totalCartItems,
  onSelectItem,
  onOpenCart,
  onCallWaiter,
  onFa7em,
  promotionalBanner,
  showBanner,
  onBannerTap,
}: QRMenuHomeProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const featuredItems = menuData.items.filter((i) => i.is_featured).slice(0, 5);
  const chefPicks = menuData.items.filter((i) => i.is_chef_pick && !i.is_featured).slice(0, 3);

  const filteredItems = selectedCategoryId
    ? menuData.items.filter((i) => i.category_id === selectedCategoryId)
    : menuData.items;

  return (
    <div className="relative pb-32" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Promotional banner */}
      <AnimatePresence>
        {showBanner && promotionalBanner && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={onBannerTap}
            className="cursor-pointer px-4 py-2 text-center text-sm font-semibold"
            style={{
              background: 'var(--qr-accent)',
              color: 'var(--qr-bg)',
            }}
          >
            {promotionalBanner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language + restaurant header */}
      <TenantHero tenant={menuData.tenant} lang={lang} />

      {/* Featured */}
      {!selectedCategoryId && (
        <>
          <FeaturedSection items={featuredItems} lang={lang} onSelectItem={onSelectItem} title="Featured" emoji="⭐" />
          <FeaturedSection items={chefPicks} lang={lang} onSelectItem={onSelectItem} title="Chef's Picks" emoji="👨‍🍳" />
        </>
      )}

      {/* Category filter */}
      <CategoryPills
        categories={menuData.categories}
        selectedId={selectedCategoryId}
        lang={lang}
        onSelect={setSelectedCategoryId}
      />

      {/* Menu grid */}
      <div className="mt-4 px-4">
        {selectedCategoryId && (
          <h3
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
          >
            {menuData.categories.find((c) => c.id === selectedCategoryId)?.name ?? ''}
          </h3>
        )}

        {filteredItems.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--qr-text-muted)' }}>
            <p className="text-4xl mb-3">🍽️</p>
            <p>No items available</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <ItemCard item={item} lang={lang} onClick={() => onSelectItem(item)} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* KiTS fingerprint */}
      <footer className="qr-kits-fingerprint mt-8">
        <span>Digital menu by</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>KiTS</span>
      </footer>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-4 z-30 flex flex-col items-end gap-3">
        {/* Fa7em / Argile */}
        <motion.button
          onClick={onFa7em}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-sm"
          style={{ background: 'var(--qr-card-bg)', border: '1px solid var(--qr-border)', color: 'var(--qr-text-muted)' }}
          whileTap={{ scale: 0.95 }}
        >
          <Wind className="h-4 w-4" />
          Fa7em 💨
        </motion.button>

        {/* Call waiter */}
        <motion.button
          onClick={onCallWaiter}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-sm"
          style={{ background: 'var(--qr-card-bg)', border: '1px solid var(--qr-border)', color: 'var(--qr-text-muted)' }}
          whileTap={{ scale: 0.95 }}
        >
          <Bell className="h-4 w-4" />
          Call Waiter 🔔
        </motion.button>

        {/* Cart button */}
        <AnimatePresence>
          {totalCartItems > 0 && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={onOpenCart}
              className="qr-accent-glow flex items-center gap-3 rounded-full px-5 py-3.5 text-base font-bold shadow-xl"
              style={{
                background: 'var(--qr-accent)',
                color: 'var(--qr-bg)',
              }}
              whileTap={{ scale: 0.95 }}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>{totalCartItems} item{totalCartItems !== 1 ? 's' : ''}</span>
              <motion.span
                key={totalCartItems}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="rounded-full px-2 py-0.5 text-xs font-black"
                style={{ background: 'rgba(0,0,0,0.2)' }}
              >
                View
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
