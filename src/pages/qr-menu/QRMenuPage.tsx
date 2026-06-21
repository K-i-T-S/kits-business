import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { RestaurantMenuItem } from '@/types/restaurant';
import '@/styles/qr-menu-themes.css';

import QRCart from './QRCart';
import QRItemDetail from './QRItemDetail';
import QRMenuHome from './QRMenuHome';
import QROrderSuccess from './QROrderSuccess';
import QRSplash from './QRSplash';
import { useCart, getModifierKey } from './useCart';
import { useQRMenu } from './useQRMenu';

type MenuView = 'splash' | 'menu' | 'item-detail' | 'cart' | 'success';

const PALETTE_CLASS: Record<string, string> = {
  'dark-luxury': 'qr-dark-luxury',
  'beirut-night': 'qr-beirut-night',
  mediterranean: 'qr-mediterranean',
  'lebanese-garden': 'qr-lebanese-garden',
  'classic-bistro': 'qr-classic-bistro',
  'modern-minimal': 'qr-modern-minimal',
};

export default function QRMenuPage() {
  const { tenantSlug = '', tableId = '' } = useParams<{ tenantSlug: string; tableId: string }>();
  const { data, loading, error } = useQRMenu(tenantSlug);
  const { items, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart } = useCart();

  const [view, setView] = useState<MenuView>('splash');
  const [selectedItem, setSelectedItem] = useState<RestaurantMenuItem | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [fa7emSent, setFa7emSent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [calledWaiter, setCalledWaiter] = useState(false);

  // Transition from splash to menu after 1.4s
  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => setView('menu'), 1400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, data]);

  const palette = data?.tenant?.qr_menu_palette ?? 'dark-luxury';
  const paletteClass = PALETTE_CLASS[palette] ?? 'qr-dark-luxury';

  const handleSelectItem = (item: RestaurantMenuItem) => {
    setSelectedItem(item);
    setView('item-detail');
  };

  const handleAddToCart = (
    item: RestaurantMenuItem,
    quantity: number,
    selectedModifiers: Record<string, string[]>,
    notes: string,
    priceDelta: number,
  ) => {
    addItem(item, quantity, selectedModifiers, notes, priceDelta);
    setView('menu');
  };

  const handleOrderSuccess = (num: string) => {
    setOrderNumber(num);
    clearCart();
    setView('success');
  };

  const handleFa7em = () => {
    if (fa7emSent) return;
    setFa7emSent(true);
    // Show "on its way" for 2s then show banner
    setTimeout(() => {
      setShowBanner(true);
    }, 2000);
    // Reset fa7em after 10s
    setTimeout(() => setFa7emSent(false), 10000);
  };

  const handleCallWaiter = () => {
    setCalledWaiter(true);
    setTimeout(() => setCalledWaiter(false), 5000);
  };

  const handleBannerTap = () => {
    setShowBanner(false);
    // Scroll to desserts by selecting that category — handled internally in QRMenuHome
  };

  if (loading || view === 'splash') {
    return (
      <div className={`${paletteClass} qr-menu-root`}>
        <AnimatePresence>
          {(loading || view === 'splash') && (
            <QRSplash key="splash" palette={paletteClass.replace('qr-', '')} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 p-8 text-center text-white">
        <p className="mb-2 text-4xl">🍽️</p>
        <h1 className="mb-2 text-xl font-bold">Menu not found</h1>
        <p className="text-sm text-white/50">
          {error ?? 'This restaurant has not configured their digital menu yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`${paletteClass} qr-menu-root relative`}>
      {/* Language toggle */}
      <div className="fixed right-4 top-4 z-50">
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="rounded-full px-3 py-1.5 text-xs font-bold shadow-lg backdrop-blur-sm transition-all active:scale-95"
          style={{ background: 'var(--qr-card-bg)', border: '1px solid var(--qr-border)', color: 'var(--qr-text)' }}
        >
          {lang === 'en' ? '🇸🇦 AR' : '🇬🇧 EN'}
        </button>
      </div>

      {/* Fa7em feedback toast */}
      <AnimatePresence>
        {fa7emSent && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-xl"
            style={{ background: 'var(--qr-accent)', color: 'var(--qr-bg)' }}
          >
            Coal is on its way! 💨
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiter called feedback */}
      <AnimatePresence>
        {calledWaiter && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-xl"
            style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)', color: 'var(--qr-text)' }}
          >
            🔔 Waiter on the way!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <QRMenuHome
              menuData={data}
              lang={lang}
              totalCartItems={totalItems}
              onSelectItem={handleSelectItem}
              onOpenCart={() => setView('cart')}
              onCallWaiter={handleCallWaiter}
              onFa7em={handleFa7em}
              promotionalBanner={data.tenant.qr_menu_promotional_banner ?? 'While you wait — freshly made desserts 🍮'}
              showBanner={showBanner}
              onBannerTap={handleBannerTap}
            />
          </motion.div>
        )}

        {view === 'success' && (
          <motion.div key="success" className="fixed inset-0 z-50">
            <QROrderSuccess
              orderNumber={orderNumber}
              onDone={() => setView('menu')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item detail bottom sheet */}
      <AnimatePresence>
        {view === 'item-detail' && selectedItem && (
          <QRItemDetail
            key="item-detail"
            item={selectedItem}
            menuData={data}
            lang={lang}
            onClose={() => setView('menu')}
            onAddToCart={handleAddToCart}
          />
        )}
      </AnimatePresence>

      {/* Cart bottom sheet */}
      <AnimatePresence>
        {view === 'cart' && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setView('menu')}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <QRCart
              key="cart"
              items={items}
              tableId={tableId}
              totalPrice={totalPrice}
              onUpdateQuantity={(menuItemId, modKey, qty) => updateQuantity(menuItemId, modKey, qty)}
              onRemoveItem={(menuItemId, modKey) => removeItem(menuItemId, modKey)}
              onClose={() => setView('menu')}
              onSuccess={handleOrderSuccess}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Re-export for the lazy-loaded route
export { getModifierKey };
