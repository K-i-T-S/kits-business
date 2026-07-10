import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import '@/styles/qr-menu-themes.css';

import QRBundleDetail from './QRBundleDetail';
import QRCart from './QRCart';
import QRItemDetail from './QRItemDetail';
import QRMenuHome from './QRMenuHome';
import QROrderSuccess from './QROrderSuccess';
import QRSplash from './QRSplash';
import { useCart, getModifierKey } from './useCart';
import { useQRMenu } from './useQRMenu';

import type { QRCartBundleSelection, QRMenuBundle, RestaurantMenuItem, UpsellRule } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';
import { pickUpsellSuggestion } from '@/utils/upsellSuggestion';

type MenuView = 'splash' | 'menu' | 'item-detail' | 'bundle-detail' | 'cart' | 'success';

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
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  const { data, loading, error } = useQRMenu(tenantSlug);
  const {
    items, bundleItems, totalItems, totalPrice,
    addItem, updateQuantity, removeItem, clearCart,
    addBundleItem, removeBundleItem,
  } = useCart();

  const [view, setView] = useState<MenuView>('splash');
  const [selectedItem, setSelectedItem] = useState<RestaurantMenuItem | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<QRMenuBundle | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderMode, setOrderMode] = useState<'direct' | 'pending'>('direct');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [fa7emSent, setFa7emSent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [calledWaiter, setCalledWaiter] = useState(false);

  // Resolve ?table=N query param to a table UUID for pre-filling orders
  const [resolvedTableId, setResolvedTableId] = useState<string>('');

  useEffect(() => {
    if (!tableParam || !data?.tenant.id) return;
    const tableNum = parseInt(tableParam, 10);
    if (isNaN(tableNum)) return;

    void (async () => {
      const { data: tableRow } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('tenant_id', data.tenant.id)
        .eq('number', tableNum)
        .limit(1)
        .maybeSingle();
      if (tableRow) {
        setResolvedTableId((tableRow as { id: string }).id);
      }
    })();
  }, [tableParam, data?.tenant.id]);

  // Effective table ID: path param takes priority, then resolved from ?table=N
  const effectiveTableId = tableId && tableId !== 'main' ? tableId : resolvedTableId;

  // Self-service feedback link — independent of effectiveTableId, uses the human-facing table number/slug
  const feedbackHref = tableParam ? `/feedback/${tenantSlug}/${tableParam}` : `/feedback/${tenantSlug}`;

  // Transition from splash after 1.4s once data load resolves (success or error)
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setView('menu'), 1400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading]);

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

  const handleSelectBundle = (bundle: QRMenuBundle) => {
    setSelectedBundle(bundle);
    setView('bundle-detail');
  };

  const handleAddBundleToCart = (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => {
    addBundleItem(bundle, partySize, selections);
    setView('menu');
  };

  const handleOrderSuccess = (num: string, mode: 'direct' | 'pending') => {
    setOrderNumber(num);
    setOrderMode(mode);
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
      <div className={`${paletteClass} qr-menu-root flex min-h-dvh flex-col items-center justify-center p-8 text-center`}>
        <div className="qr-glass rounded-3xl p-10 max-w-sm w-full" style={{ border: '1px solid var(--qr-border)' }}>
          <p className="mb-4 text-5xl">🍽️</p>
          <h1 className="mb-2 text-xl font-black" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
            Menu not available
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--qr-text-muted)' }}>
            Please ask your server for assistance.
          </p>
          {error && error !== 'Menu not found' && (
            <p className="text-xs mb-4" style={{ color: 'var(--qr-text-muted)', opacity: 0.6 }}>
              {error}
            </p>
          )}
          <div className="qr-kits-fingerprint" style={{ justifyContent: 'center' }}>
            <span>Digital menu by</span>
            <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>KiTS</span>
          </div>
        </div>
      </div>
    );
  }

  const currentCartItemIds = items.map((i) => i.menuItemId);
  const mappedUpsellRules: UpsellRule[] = (data.upsell_rules ?? []).map((r) => ({
    id: r.id,
    tenantId: data.tenant.id,
    triggerItemId: r.trigger_item_id,
    suggestedItemId: r.suggested_item_id,
    confidence: r.confidence,
    supportCount: 0,
    createdAt: '',
  }));
  const upsellSuggestion = pickUpsellSuggestion(mappedUpsellRules, currentCartItemIds, data.items);

  return (
    <div className={`${paletteClass} qr-menu-root relative`}>
      {/* Table badge — shown when ?table=N is present in the URL */}
      {tableParam && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 pointer-events-none">
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl px-4 py-2 text-sm font-medium text-center">
            Table {tableParam}
          </div>
        </div>
      )}

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
              tableId={effectiveTableId}
              tableDisplayLabel={tableParam ?? undefined}
              totalCartItems={totalItems}
              onSelectItem={handleSelectItem}
              onSelectBundle={handleSelectBundle}
              onOpenCart={() => setView('cart')}
              onCallWaiter={handleCallWaiter}
              onFa7em={handleFa7em}
              promotionalBanner={data.tenant.qr_menu_promotional_banner ?? 'While you wait — try our freshly made desserts 🍮'}
              showBanner={showBanner}
              onBannerTap={handleBannerTap}
              feedbackHref={feedbackHref}
            />
          </motion.div>
        )}

        {view === 'success' && (
          <motion.div key="success" className="fixed inset-0 z-50">
            <QROrderSuccess
              orderNumber={orderNumber}
              mode={orderMode}
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

      {/* Bundle detail bottom sheet */}
      <AnimatePresence>
        {view === 'bundle-detail' && selectedBundle && (
          <QRBundleDetail
            key="bundle-detail"
            bundle={selectedBundle}
            courses={data.bundle_courses.filter((c) => c.bundle_id === selectedBundle.id)}
            courseItems={data.bundle_course_items.filter((ci) =>
              data.bundle_courses.filter((c) => c.bundle_id === selectedBundle.id).map((c) => c.id).includes(ci.bundle_course_id),
            )}
            menuItems={data.items}
            lang={lang}
            onClose={() => setView('menu')}
            onAddToCart={handleAddBundleToCart}
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
              bundleItems={bundleItems}
              tableId={effectiveTableId}
              tableDisplayLabel={tableParam ?? undefined}
              totalPrice={totalPrice}
              suggestion={upsellSuggestion}
              onUpdateQuantity={(menuItemId, modKey, qty) => updateQuantity(menuItemId, modKey, qty)}
              onRemoveItem={(menuItemId, modKey) => removeItem(menuItemId, modKey)}
              onRemoveBundleItem={(cartKey) => removeBundleItem(cartKey)}
              onAddSuggestion={(item) => addItem(item, 1, {}, '', 0)}
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
// eslint-disable-next-line react-refresh/only-export-components
export { getModifierKey };
