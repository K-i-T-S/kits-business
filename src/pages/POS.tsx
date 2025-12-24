import { useState } from 'react';
import { Barcode, Minus, Plus, Trash2, CreditCard, DollarSign, Receipt, User } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { Sale } from '../context/AppContext';
import { toast } from 'sonner@2.0.3';

interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantAttributes: string;
  price: number;
  cost: number;
  quantity: number;
}

export default function POS() {
  const { products, customers, currentEmployee, addSale, updateCustomer } = useApp();
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Find product by barcode
    const product = products.find(p => p.barcode === barcode);
    
    if (product) {
      // For simplicity, add first variant
      const variant = product.variants[0];
      if (!variant) {
        toast.error('Product missing variants', {
          description: 'Please configure at least one variant before selling.',
        });
        return;
      }
      
      if (variant.stock > 0) {
        const existingItem = cart.find(
          item => item.productId === product.id && item.variantId === variant.id
        );

        if (existingItem) {
          setCart(cart.map(item =>
            item.productId === product.id && item.variantId === variant.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
        } else {
          const variantDesc = Object.entries(variant.attributes)
            .map(([key, value]) => `${value}`)
            .join(' - ');

          setCart([...cart, {
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantAttributes: variantDesc,
            price: variant.price,
            cost: variant.cost,
            quantity: 1
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
    setCart(cart.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal(); // Can add tax or discounts here
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty', {
        description: 'Scan or add at least one product before completing a sale.',
      });
      return;
    }

    const sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost
      })),
      subtotal: calculateSubtotal(),
      total: calculateTotal(),
      paymentMethod,
      employeeId: currentEmployee?.id || '',
      ...(selectedCustomer ? { customerId: selectedCustomer } : {})
    } satisfies Sale;

    try {
      await addSale(sale);

      // Update customer purchase history
      if (selectedCustomer) {
        const customer = customers.find(c => c.id === selectedCustomer);
        if (customer) {
          await updateCustomer(selectedCustomer, {
            totalPurchases: customer.totalPurchases + sale.total,
            lastPurchaseDate: new Date().toISOString()
          });
        }
      }
  
      setLastSale(sale);
      setShowReceipt(true);
      setCart([]);
      setBarcode('');
      setSelectedCustomer('');
      toast.success('Sale completed', {
        description: `Total ${sale.total.toFixed(2)} charged via ${paymentMethod}.`,
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
      <div className="space-y-10">
        <section className="glass-panel flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Point of sale</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Live sales cockpit</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Run fast, touch-friendly checkouts with barcode search, loyalty linking, and smart
              receipt handling. Replace this copy with your in-store experience promise.
            </p>
          </div>
          <div className="rounded-3xl border border-white/50 bg-white/70 px-6 py-4 text-right text-xs uppercase tracking-[0.3em] text-slate-500">
            Operator: <span className="text-base font-semibold text-slate-900">{currentEmployee?.name}</span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scanner lane</p>
                  <h2 className="text-lg font-semibold text-slate-900">Scan or enter barcode</h2>
                </div>
              </div>
              <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <div className="flex-1 relative">
                  <Barcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode..."
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3 pl-12 pr-4 text-sm text-slate-900 shadow-inner shadow-white/60 focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                >
                  Add
                </button>
              </form>
            </section>

            <section className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Basket</p>
                  <h2 className="text-lg font-semibold text-slate-900">Shopping cart</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Ready to convert {cart.length} item{cart.length !== 1 ? 's' : ''}
                </p>
              </div>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
                  <Receipt className="h-12 w-12" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs uppercase tracking-[0.3em]">Scan a product to get started</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {cart.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white/90 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {item.variantAttributes}
                        </p>
                        <p className="text-sm text-slate-500">${item.price.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex flex-col items-center gap-2 sm:flex-row">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(index, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          >
                            <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          <span className="w-12 text-center text-sm font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:flex-col sm:items-end">
                        <p className="text-sm font-semibold text-slate-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeItem(index)}
                          className="mt-2 rounded-full border border-rose-100 bg-rose-50/50 p-2 text-rose-600 hover:bg-rose-50"
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
            <section className="glass-panel p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Customer</p>
              <h2 className="text-lg font-semibold text-slate-900">Attach loyalty profile</h2>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-white/80 py-3 pl-12 pr-10 text-sm text-slate-900 shadow-inner shadow-white/60 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.phone})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="glass-panel p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tender</p>
              <h2 className="text-lg font-semibold text-slate-900">Payment method</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <DollarSign className={`mx-auto mb-2 h-8 w-8 ${
                    paymentMethod === 'cash' ? 'text-emerald-600' : 'text-slate-300'
                  }`} />
                  <p className="text-sm font-semibold">Cash</p>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className={`mx-auto mb-2 h-8 w-8 ${
                    paymentMethod === 'card' ? 'text-indigo-600' : 'text-slate-300'
                  }`} />
                  <p className="text-sm font-semibold">Card</p>
                </button>
              </div>
            </section>

            <section className="glass-panel p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Totals</p>
              <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="text-slate-900">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Tax</span>
                  <span className="text-slate-900">$0.00</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete sale
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="glass-panel max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Receipt className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Sale complete</h2>
              <p className="text-sm text-slate-500">Receipt #{lastSale.id}</p>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm">
              {lastSale.items.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {item.productName} x{item.quantity}
                  </span>
                  <span className="font-semibold text-slate-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-900">${lastSale.total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payment</span>
                <span className="capitalize text-slate-900">{lastSale.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Date</span>
                <span className="text-slate-900">
                  {new Date(lastSale.date).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={closeReceipt} className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30">
                New sale
              </button>
              <button onClick={() => window.print()} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
