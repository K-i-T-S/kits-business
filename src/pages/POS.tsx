import { Barcode, Minus, Plus, Trash2, DollarSign, Receipt, User, Tag, Star, Settings, Split, Printer, MessageCircle, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

import DiscountModal from '../components/DiscountModal';
import Layout from '../components/Layout';
import LoyaltyModal from '../components/LoyaltyModal';
import ReceiptCustomizationModal from '../components/ReceiptCustomizationModal';
import SplitPaymentModal from '../components/SplitPaymentModal';
import TipsModal from '../components/TipsModal';
import { useApp } from '../context/AppContext';
import type { Sale, Product } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';
import { demoCoupons, demoLoyaltyProgram, demoCustomerLoyalty, demoReceiptTemplates } from '../data/demoPosData';
import type { SplitPayment, TipInfo, DiscountCoupon, ReceiptTemplate } from '../types/pos';
import { formatTaxBreakdown } from '../utils/formatting';
import { POSCalculator } from '../utils/posCalculations';
import { supabase } from '../utils/supabaseClient';
import '../styles/print.css';

// ─── Barcode scanner tuning ───────────────────────────────────────────────────
// USB HID scanners emit characters in rapid succession (< 50 ms between each)
// followed by an Enter keydown. We buffer chars and flush on Enter.
const SCANNER_CHAR_INTERVAL_MS = 50;
const SCANNER_MIN_LENGTH = 4; // ignore accidental single-keystroke Enter presses

interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantAttributes: string;
  price: number;
  cost: number;
  quantity: number;
}

interface ReceiptData {
  id: string;
  date: string;
  items: Array<{
    productId: string;
    variantId: string;
    productName: string;
    quantity: number;
    price: number;
    cost: number;
  }>;
  subtotal: number;
  tax: number;
  discounts: number;
  tips: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  payments: SplitPayment[];
  appliedCoupon: DiscountCoupon | null;
  loyaltyPointsRedeemed: number;
}

export default function POS() {
  const { products, customers, currentEmployee, currentTenant, addSale, updateCustomer } = useApp();
  const { hasFeature } = useSubscription();
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<ReceiptData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 9: green flash feedback — productId | null
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);

  // Enhanced POS states
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showReceiptCustomization, setShowReceiptCustomization] = useState(false);
  const [_splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [tipInfo, setTipInfo] = useState<TipInfo | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState(0);
  const [selectedReceiptTemplate, setSelectedReceiptTemplate] = useState<ReceiptTemplate | null>(null);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const taxRate = currentTenant?.tax_rate ?? 0;

  const handleSendWhatsApp = async () => {
    if (!lastSale || !selectedCustomer) return;
    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer?.phone) return;

    setWhatsappSending(true);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-receipt', {
        body: {
          to: customer.phone,
          customerName: customer.name,
          saleId: lastSale.id,
          items: lastSale.items.map(i => ({
            name: i.productName,
            qty: i.quantity,
            price: i.price,
          })),
          subtotal: lastSale.subtotal,
          tax: lastSale.tax,
          total: lastSale.total,
          paymentMethod: lastSale.paymentMethod,
          businessName: currentTenant?.name ?? 'KiTS Business',
        },
      });
      if (error) {
        toast.error('Failed to send receipt via WhatsApp');
      } else {
        toast.success('Receipt sent via WhatsApp!');
      }
    } catch {
      toast.error('Failed to send receipt via WhatsApp');
    } finally {
      setWhatsappSending(false);
    }
  };

  // ── Step 9: Scanner refs — NOT state, avoids async update lag ────────────
  const scannerBuffer = useRef<string>('');
  const lastKeystrokeAt = useRef<number>(0);

  const filteredProducts = (products || []).filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || (p.sku?.toLowerCase() ?? '').includes(q)
      || (p.barcode?.toLowerCase() ?? '').includes(q);
  });

  // ── Core add-to-cart (shared by click and scanner) ───────────────────────
  const addProductToCart = useCallback((product: Product, flashId?: string) => {
    const variant = product.variants[0];
    if (!variant) {
      toast.error('Product missing variants', { description: 'Please configure at least one variant before selling.' });
      return;
    }
    if (variant.stock <= 0) {
      toast.error('Out of stock', { description: `${product.name} has no remaining inventory.` });
      return;
    }

    const variantDesc = Object.values(variant.attributes).join(' - ');

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.variantId === variant.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id && item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, {
        productId: product.id!,
        variantId: variant.id,
        productName: product.name,
        variantAttributes: variantDesc,
        price: variant.price,
        cost: variant.cost,
        quantity: 1,
      }];
    });

    // Step 9: brief green flash on the product card
    if (flashId) {
      setScannedProductId(flashId);
      setTimeout(() => setScannedProductId(null), 600);
    }
  }, []);

  // ── Step 9: keydown handler on the barcode input ──────────────────────────
  // Physical HID scanners beam a burst of characters all within ~50 ms of each
  // other, then send Enter. We detect that pattern and intercept before the
  // normal form submit fires.
  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const elapsed = now - lastKeystrokeAt.current;

    if (e.key === 'Enter') {
      const buffered = scannerBuffer.current;
      scannerBuffer.current = '';
      lastKeystrokeAt.current = 0;

      if (buffered.length >= SCANNER_MIN_LENGTH) {
        // Looks like a scanner burst — handle it ourselves
        e.preventDefault();
        const product = products.find(p => p.barcode === buffered || p.sku === buffered);
        if (product) {
          addProductToCart(product, product.id);
          setBarcode('');
          toast.success(`Added: ${product.name}`, { duration: 1500 });
        } else {
          toast.error('Barcode not recognised', {
            description: `No product found for "${buffered}". Check inventory.`,
          });
          setBarcode('');
        }
      }
      // Short buffer → let normal form onSubmit handle it
      return;
    }

    // Accumulate into buffer if within scanner timing window
    if (e.key.length === 1) {
      if (lastKeystrokeAt.current === 0 || elapsed < SCANNER_CHAR_INTERVAL_MS) {
        scannerBuffer.current += e.key;
      } else {
        // Gap too large — human typing, restart buffer
        scannerBuffer.current = e.key;
      }
    }

    lastKeystrokeAt.current = now;
  }, [products, addProductToCart]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const product = products.find(p => p.barcode === barcode);

    if (product) {
      const variant = product.variants[0];
      if (!variant) {
        toast.error('Product missing variants', {
          description: 'Please configure at least one variant before selling.',
        });
        return;
      }

      if (variant.stock > 0) {
        const existingItem = cart.find(
          item => item.productId === product.id && item.variantId === variant.id,
        );

        if (existingItem) {
          setCart(cart?.map(item =>
            item.productId === product.id && item.variantId === variant.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ) || []);
        } else {
          const variantDesc = Object.entries(variant.attributes)
            .map(([, value]) => `${value}`)
            .join(' - ');

          setCart([...(cart || []), {
            productId: product.id!,
            variantId: variant.id,
            productName: product.name,
            variantAttributes: variantDesc,
            price: variant.price,
            cost: variant.cost,
            quantity: 1,
          }]);
        }
        setBarcode('');
      } else {
        toast.error('Product out of stock', {
          description: `${product.name} has no remaining inventory.`,
        });
      }
    } else {
      toast.error('Product not found', {
        description: `No product found for barcode ${barcode || 'entered value'}.`,
      });
    }
  };

  const updateQuantity = (index: number, change: number) => {
    const newCart = [...cart];
    const target = newCart[index];
    if (!target) return;
    const newQuantity = target.quantity + change;

    if (newQuantity <= 0) {
      newCart.splice(index, 1);
    } else {
      target.quantity = newQuantity;
    }

    setCart(newCart);
  };

  const removeItem = (index: number) => {
    setCart((cart || [])?.filter((_, i) => i !== index) || []);
  };

  const calculateSubtotal = () => {
    return (cart || [])?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  };

  const calculateTax = () => {
    return POSCalculator.calculateTax(calculateSubtotal(), taxRate);
  };

  const calculateDiscounts = () => {
    let totalDiscount = 0;

    if (appliedCoupon) {
      const cartItemsForDiscount = (cart || [])?.map(item => ({
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
      })) || [];
      totalDiscount += POSCalculator.calculateCouponDiscount(calculateSubtotal(), appliedCoupon, cartItemsForDiscount);
    }

    if (loyaltyPointsRedeemed > 0) {
      // 100 points = $1
      totalDiscount += loyaltyPointsRedeemed * 0.01;
    }

    return totalDiscount;
  };

  const calculateTips = () => {
    if (!tipInfo) return 0;
    return POSCalculator.calculateTip(calculateSubtotal(), tipInfo);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const discounts = calculateDiscounts();
    const tips = calculateTips();
    return POSCalculator.calculateFinalTotal(subtotal, tax, discounts, tips);
  };

  const handleCheckout = () => {
    if (!cart?.length) {
      toast.error('Cart is empty', {
        description: 'Scan or add at least one product before completing a sale.',
      });
      return;
    }

    if (calculateTotal() > 0) {
      setShowSplitPayment(true);
    }
  };

  const completeSale = async (payments: SplitPayment[]) => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const discounts = calculateDiscounts();
    const tips = calculateTips();
    const total = calculateTotal();

    const primaryMethod: 'cash' | 'card' = (() => {
      const m = payments[0]?.method;
      if (payments.length === 1 && (m === 'cash' || m === 'card')) return m;
      return 'cash';
    })();

    const saleItems = cart.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      cost: item.cost,
    }));

    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      items: saleItems,
      subtotal,
      total,
      paymentMethod: primaryMethod,
      employeeId: currentEmployee?.id || '',
      ...(selectedCustomer ? { customerId: selectedCustomer } : {}),
    };

    const receiptData: ReceiptData = {
      ...sale,
      tax,
      discounts,
      tips,
      payments,
      appliedCoupon,
      loyaltyPointsRedeemed,
    };

    try {
      await addSale(sale);

      if (selectedCustomer) {
        const customer = customers.find(c => c.id === selectedCustomer);
        if (customer) {
          await updateCustomer(selectedCustomer, {
            totalPurchases: customer.totalPurchases + sale.total,
            lastPurchaseDate: new Date().toISOString(),
          });
        }

        // Loyalty: earn points
        if (currentTenant?.loyalty_enabled) {
          const pointsEarned = Math.floor(total * (currentTenant.loyalty_points_per_dollar ?? 1));
          if (pointsEarned > 0) {
            void supabase.rpc('upsert_customer_points', {
              p_customer_id: selectedCustomer,
              p_points_earned: pointsEarned,
              p_sale_id: sale.id,
            });
          }
        }
        // Loyalty: deduct redeemed points
        if (loyaltyPointsRedeemed > 0) {
          void supabase.from('customer_points').select('points_balance').eq('customer_id', selectedCustomer).single()
            .then(({ data }) => {
              if (!data) return;
              const newBalance = Math.max(0, (data as { points_balance: number }).points_balance - loyaltyPointsRedeemed);
              void supabase.from('customer_points').update({ points_balance: newBalance }).eq('customer_id', selectedCustomer);
              void supabase.from('point_transactions').insert({
                tenant_id: currentTenant?.id,
                customer_id: selectedCustomer,
                sale_id: sale.id,
                type: 'redeemed',
                points: -loyaltyPointsRedeemed,
                balance_after: newBalance,
              });
            });
        }
      }

      setLastSale(receiptData);
      setShowReceipt(true);
      setCart([]);
      setBarcode('');
      setSelectedCustomer('');
      setSplitPayments([]);
      setTipInfo(null);
      setAppliedCoupon(null);
      setLoyaltyPointsRedeemed(0);

      toast.success('Sale completed', {
        description: `Total ${sale.total.toFixed(2)} charged via ${payments.map(p => p.method).join(', ')}.`,
      });
    } catch (error) {
      toast.error('Failed to complete sale', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    }
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
  };

  return (
    <Layout>
      {/* Step 4: pb-28 on mobile reserves space for the sticky checkout footer */}
      <div className="space-y-10 pb-28 lg:pb-0">
        <section className="hero-gradient glass-panel flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Point of sale</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Live sales cockpit</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              {cart.length > 0
                ? `${cart.length} item${cart.length !== 1 ? 's' : ''} in cart · $${calculateTotal().toFixed(2)} total`
                : 'Scan a barcode or select a product to begin a new transaction.'}
            </p>
          </div>
          <div className="rounded-3xl border border-white/50 bg-white/20 px-6 py-4 text-end text-xs uppercase tracking-[0.3em] text-white/80">
            Operator: <span className="text-base font-semibold text-white">{currentEmployee?.name}</span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* ── Product grid ── */}
            <section className="hero-gradient glass-panel p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Products</p>
                  <h2 className="text-lg font-semibold text-white">Select or search</h2>
                </div>
                <span className="text-xs text-white/60">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, or barcode…"
                className="mt-4 w-full rounded-2xl border border-white/30 bg-white/20 py-3 px-4 text-sm text-white placeholder-white/50 shadow-inner focus:border-white/50 focus:outline-none"
              />
              {filteredProducts.length === 0 ? (
                <p className="mt-4 text-center text-sm text-white/60 py-4">
                  {searchQuery.trim() ? 'No products match your search.' : 'No products found. Add products in the Inventory section.'}
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto pe-1">
                  {(searchQuery.trim() ? filteredProducts : filteredProducts.slice(0, 24)).map(product => {
                    const v = product.variants[0];
                    if (!v) return null;
                    // Step 4: min-h-[80px] touch target  |  Step 9: green flash ring
                    const isFlashing = scannedProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        onClick={() => addProductToCart(product)}
                        disabled={v.stock <= 0}
                        className={[
                          'rounded-2xl border p-3 text-start transition min-h-[80px] flex flex-col justify-between',
                          isFlashing
                            ? 'border-emerald-400 bg-emerald-500/30 ring-2 ring-emerald-400'
                            : 'border-white/30 bg-white/10 hover:bg-white/20',
                          v.stock <= 0 ? 'opacity-50 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                        <p className="text-xs text-white/80">${v.price.toFixed(2)}</p>
                        <p className={`text-xs ${v.stock > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {v.stock > 0 ? `${v.stock} in stock` : 'Out of stock'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Scanner lane ── */}
            <section className="hero-gradient glass-panel p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Scanner lane</p>
                  <h2 className="text-lg font-semibold text-white">Scan or enter barcode</h2>
                </div>
              </div>
              <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <div className="flex-1 relative">
                  <Barcode className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleScannerKeyDown}
                    placeholder="Scan or enter barcode..."
                    className="w-full rounded-2xl border border-white/30 bg-white/20 py-3 ps-12 pe-4 text-sm text-white placeholder-white/50 shadow-inner focus:border-white/50 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl btn-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                >
                  Add
                </button>
              </form>
            </section>

            {/* ── Cart ── */}
            <section className="hero-gradient glass-panel p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Basket</p>
                  <h2 className="text-lg font-semibold text-white">Shopping cart</h2>
                </div>
                <p className="text-xs text-white/80">
                  Ready to convert {cart?.length || 0} item{(cart?.length || 0) !== 1 ? 's' : ''}
                </p>
              </div>
              {!cart?.length ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-white/60">
                  <Receipt className="h-12 w-12" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs uppercase tracking-[0.3em]">Scan a product to get started</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {(cart || [])?.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 rounded-3xl border border-white/30 bg-white/10 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                          {item.variantAttributes}
                        </p>
                        <p className="text-sm text-white/80">${(item.price || 0).toFixed(2)}</p>
                      </div>

                      {/* Step 4: quantity controls — min 44×44px (h-11 w-11) touch targets */}
                      <div className="flex flex-col items-center gap-2 sm:flex-row">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(index, -1)}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 active:scale-95 transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center text-sm font-semibold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 active:scale-95 transition"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:flex-col sm:items-end">
                        <p className="text-sm font-semibold text-white">
                          ${((item.price || 0) * item.quantity).toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeItem(index)}
                          className="mt-2 rounded-full border border-rose-200/50 bg-rose-500/20 p-2 text-rose-300 hover:bg-rose-500/30"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {/* ── Customer ── */}
            <section className="hero-gradient glass-panel p-6 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Customer</p>
              <h2 className="text-lg font-semibold text-white">Attach loyalty profile</h2>
              <div className="relative">
                <User className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-white/30 bg-white/20 py-3 ps-12 pe-10 text-sm text-white shadow-inner focus:border-white/50 focus:outline-none"
                >
                  <option value="">Walk-in Customer</option>
                  {(customers || [])?.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.phone})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* ── Payment options ── */}
            <section className="hero-gradient glass-panel p-6 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Tender</p>
              <h2 className="text-lg font-semibold text-white">Payment options</h2>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowSplitPayment(true)}
                    className="p-3 rounded-lg border border-white/30 bg-white/10 text-white/80 hover:border-white/50 flex items-center justify-center gap-2"
                  >
                    <Split className="w-4 h-4" />
                    <span className="text-sm">Split Payment</span>
                  </button>
                  <button
                    onClick={() => setShowTipsModal(true)}
                    className="p-3 rounded-lg border border-white/30 bg-white/10 text-white/80 hover:border-white/50 flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Add Tip</span>
                  </button>
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="p-3 rounded-lg border border-white/30 bg-white/10 text-white/80 hover:border-white/50 flex items-center justify-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    <span className="text-sm">Discount</span>
                  </button>
                  <button
                    onClick={() => setShowLoyaltyModal(true)}
                    disabled={!selectedCustomer}
                    className="p-3 rounded-lg border border-white/30 bg-white/10 text-white/80 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    <span className="text-sm">Loyalty</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowReceiptCustomization(true)}
                  className="w-full p-3 rounded-lg border border-white/30 bg-white/10 text-white/80 hover:border-white/50 flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Receipt Settings</span>
                </button>
              </div>

              {(appliedCoupon || tipInfo || loyaltyPointsRedeemed > 0) && (
                <div className="mt-4 space-y-2">
                  {appliedCoupon && (
                    <div className="flex items-center justify-between p-2 rounded bg-emerald-500/20 border border-emerald-400">
                      <span className="text-xs text-emerald-300">Coupon: {appliedCoupon.code}</span>
                      <span className="text-xs text-emerald-300">-${calculateDiscounts().toFixed(2)}</span>
                    </div>
                  )}
                  {tipInfo && (
                    <div className="flex items-center justify-between p-2 rounded bg-blue-500/20 border border-blue-400">
                      <span className="text-xs text-blue-300">Tip ({tipInfo.type})</span>
                      <span className="text-xs text-blue-300">+${calculateTips().toFixed(2)}</span>
                    </div>
                  )}
                  {loyaltyPointsRedeemed > 0 && (
                    <div className="flex items-center justify-between p-2 rounded bg-amber-500/20 border border-amber-400">
                      <span className="text-xs text-amber-300">Points Redeemed</span>
                      <span className="text-xs text-amber-300">-{(loyaltyPointsRedeemed * 0.01).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Order summary — desktop only; mobile uses sticky footer ── */}
            <section className="hero-gradient glass-panel p-6 text-white hidden lg:block">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Totals</p>
              <h2 className="text-lg font-semibold text-white">Order Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                {taxRate > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-white/80">
                      <span>Subtotal</span>
                      <span className="text-white">${(calculateSubtotal() || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/80">
                      <span>{formatTaxBreakdown(calculateSubtotal(), taxRate).taxLabel}</span>
                      <span className="text-white">${calculateTax().toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-white/80">
                    <span>Subtotal</span>
                    <span className="text-white">${(calculateSubtotal() || 0).toFixed(2)}</span>
                  </div>
                )}
                {calculateDiscounts() > 0 && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>Discounts</span>
                    <span>-${calculateDiscounts().toFixed(2)}</span>
                  </div>
                )}
                {calculateTips() > 0 && (
                  <div className="flex items-center justify-between text-blue-300">
                    <span>Tips</span>
                    <span>+${calculateTips().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex flex-col border-t border-white/30 pt-3">
                  <div className="flex items-center justify-between text-base font-semibold text-white">
                    <span>Total</span>
                    <span>${(calculateTotal() || 0).toFixed(2)}</span>
                  </div>
                  {currentTenant?.show_dual_currency && currentTenant.exchange_rate && (
                    <div className="text-end text-xs text-white/50 mt-0.5">
                      ≈ {Math.round((calculateTotal() || 0) * currentTenant.exchange_rate).toLocaleString()} {currentTenant.secondary_currency ?? 'LBP'}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={!cart?.length}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete sale
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* ── Step 4: Sticky checkout footer — mobile only (hidden on lg+) ─────── */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-white/60">
            {cart.length > 0
              ? `${cart.length} item${cart.length !== 1 ? 's' : ''} in cart`
              : 'Cart empty'}
          </span>
          <span className="font-semibold text-white">${(calculateTotal() || 0).toFixed(2)}</span>
        </div>
        <button
          onClick={handleCheckout}
          disabled={!cart?.length}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cart.length > 0 ? `Checkout · $${calculateTotal().toFixed(2)}` : 'Checkout'}
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <SplitPaymentModal
        isOpen={showSplitPayment}
        totalAmount={calculateTotal()}
        onComplete={completeSale}
        onCancel={() => setShowSplitPayment(false)}
      />

      <TipsModal
        isOpen={showTipsModal}
        subtotal={calculateSubtotal()}
        onComplete={(tip) => {
          setTipInfo(tip);
          setShowTipsModal(false);
          toast.success('Tip added', {
            description: `Tip of $${tip.amount.toFixed(2)} added to order.`,
          });
        }}
        onCancel={() => setShowTipsModal(false)}
      />

      <DiscountModal
        isOpen={showDiscountModal}
        subtotal={calculateSubtotal()}
        cartItems={(cart || [])?.map(item => ({
          productId: item.productId,
          price: item.price,
          quantity: item.quantity,
        })) || []}
        availableCoupons={demoCoupons}
        onApplyCoupon={(coupon) => {
          setAppliedCoupon(coupon);
          setShowDiscountModal(false);
          toast.success('Coupon applied', {
            description: `${coupon.code} discount applied.`,
          });
        }}
        onRemoveCoupon={() => {
          setAppliedCoupon(null);
          toast.success('Coupon removed');
        }}
        onCancel={() => setShowDiscountModal(false)}
        appliedCoupon={appliedCoupon || undefined}
      />

      <LoyaltyModal
        isOpen={showLoyaltyModal}
        subtotal={calculateSubtotal()}
        customerLoyalty={selectedCustomer ? demoCustomerLoyalty : undefined}
        loyaltyProgram={demoLoyaltyProgram}
        onRedeemPoints={(points) => {
          setLoyaltyPointsRedeemed(points);
          setShowLoyaltyModal(false);
          toast.success('Points redeemed', {
            description: `${points} points redeemed for discount.`,
          });
        }}
        onCancel={() => setShowLoyaltyModal(false)}
      />

      <ReceiptCustomizationModal
        isOpen={showReceiptCustomization}
        templates={demoReceiptTemplates}
        currentTemplate={selectedReceiptTemplate || undefined}
        onSelectTemplate={(template) => {
          setSelectedReceiptTemplate(template);
          setShowReceiptCustomization(false);
          toast.success('Receipt template selected', {
            description: `${template.name} template applied.`,
          });
        }}
        onSaveTemplate={(template) => {
          localStorage.setItem('pos_receipt_template', JSON.stringify(template));
          setSelectedReceiptTemplate(template);
          toast.success('Receipt template saved');
        }}
        onCancel={() => setShowReceiptCustomization(false)}
      />

      {/* ── Step 5: Receipt modal with print layout ─────────────────────────── */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="glass-panel max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
            {/*
              #receipt-print is the anchor for @media print — only this element
              (and its children) will be visible when the user hits Print.
              print.css hides body > * and reveals #receipt-print.
            */}
            <div id="receipt-print">
              {/* Store header */}
              <div className="text-center border-b border-white/20 pb-4 mb-4">
                <p className="text-lg font-bold text-white">KiTS Business</p>
                <p className="text-xs text-white/60 mt-1">
                  {new Date(lastSale.date).toLocaleString()}
                </p>
                <p className="text-xs text-white/60">
                  Receipt #{lastSale.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Sale complete indicator */}
              <div className="text-center mb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <Receipt className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-white">Sale complete</h2>
              </div>

              {/* Line items */}
              <div className="mt-2 space-y-3 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-sm">
                {(lastSale?.items || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-white/80">
                      {item.productName}
                      <span className="ms-1 text-white/50">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-white">
                      ${((item.price || 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Subtotal</span>
                  <span className="font-semibold text-white">${(lastSale.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Tax</span>
                  <span className="font-semibold text-white">${(lastSale.tax || 0).toFixed(2)}</span>
                </div>
                {(lastSale.discounts || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300">Discounts</span>
                    <span className="font-semibold text-emerald-300">-${(lastSale.discounts || 0).toFixed(2)}</span>
                  </div>
                )}
                {(lastSale.tips || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300">Tips</span>
                    <span className="font-semibold text-blue-300">+${(lastSale.tips || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/30 pt-2">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-bold text-white text-base">${(lastSale.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Payment</span>
                  <span className="capitalize text-white">
                    {lastSale.payments.length > 0
                      ? lastSale.payments.map(p => p.method).join(', ')
                      : lastSale.paymentMethod}
                  </span>
                </div>
                {lastSale.appliedCoupon && (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300">Coupon</span>
                    <span className="text-emerald-300">{lastSale.appliedCoupon.code}</span>
                  </div>
                )}
                {lastSale.loyaltyPointsRedeemed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300">Points Redeemed</span>
                    <span className="text-amber-300">{lastSale.loyaltyPointsRedeemed}</span>
                  </div>
                )}
              </div>

              {/* Footer watermark */}
              <p className="receipt-divider mt-4 pt-4 text-center text-xs text-white/40">
                Thank you for shopping with KiTS Business
              </p>
            </div>

            {/* Action buttons — hidden from print via .no-print */}
            <div className="mt-6 flex flex-col gap-3 no-print">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={closeReceipt}
                  className="flex-1 rounded-2xl btn-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                >
                  New sale
                </button>
                {/* Step 5: Print Receipt button */}
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
              </div>
              {/* WhatsApp Receipt — Business plan only, requires customer phone */}
              {hasFeature('enterprise_dashboard') &&
                selectedCustomer &&
                customers.find(c => c.id === selectedCustomer)?.phone && (
                <button
                  onClick={() => void handleSendWhatsApp()}
                  disabled={whatsappSending}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {whatsappSending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <MessageCircle className="w-4 h-4" />}
                  {whatsappSending ? 'Sending…' : 'Send via WhatsApp'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
