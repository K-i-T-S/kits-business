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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode Scanner */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Scan Product</h2>
            <form onSubmit={handleBarcodeSubmit} className="flex space-x-3">
              <div className="flex-1 relative">
                <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or enter barcode..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add
              </button>
            </form>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Shopping Cart</h2>
            
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Cart is empty</p>
                <p className="text-gray-500 text-sm">Scan a product to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-gray-900">{item.productName}</p>
                      <p className="text-gray-500 text-sm">{item.variantAttributes}</p>
                      <p className="text-gray-700">${item.price.toFixed(2)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center text-gray-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-gray-900 w-24 text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>

                    <button
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Checkout */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Customer (Optional)</h2>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="">Walk-in Customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Payment Method</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'cash'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <DollarSign className={`w-8 h-8 mx-auto mb-2 ${
                  paymentMethod === 'cash' ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <p className={paymentMethod === 'cash' ? 'text-indigo-600' : 'text-gray-700'}>
                  Cash
                </p>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'card'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <CreditCard className={`w-8 h-8 mx-auto mb-2 ${
                  paymentMethod === 'card' ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <p className={paymentMethod === 'card' ? 'text-indigo-600' : 'text-gray-700'}>
                  Card
                </p>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-900">$0.00</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full mt-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-gray-900 mb-2">Sale Complete!</h2>
              <p className="text-gray-600">Receipt #{lastSale.id}</p>
            </div>

            <div className="space-y-3 mb-6 border-t border-b border-gray-200 py-4">
              {lastSale.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-700">
                    {item.productName} x{item.quantity}
                  </span>
                  <span className="text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="text-gray-900">${lastSale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="text-gray-900 capitalize">{lastSale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="text-gray-900">
                  {new Date(lastSale.date).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={closeReceipt}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                New Sale
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
