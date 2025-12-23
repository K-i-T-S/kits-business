import { useState } from 'react';
import { CheckCircle, Package, Users, ShoppingCart, TrendingUp, BarChart3, Shield } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../utils/supabaseClient';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        // Sign up with Supabase
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: businessName,
              role: 'admin',
              commission: 5
            }
          }
        });

        if (signupError) throw signupError;
        
        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        toast.success('Account created');
        onLogin();
      } else {
        // Sign in with Supabase
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;
        
        toast.success('Welcome back');
        onLogin();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const message = err?.message || 'Authentication failed';
      setError(message);
      toast.error('Authentication failed', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Package,
      title: 'Inventory Management',
      description: 'Track products, variants, costs, and stock levels in real-time'
    },
    {
      icon: ShoppingCart,
      title: 'Point of Sale',
      description: 'Fast checkout with barcode scanning, receipts, and payment processing'
    },
    {
      icon: Users,
      title: 'Customer & Employee Management',
      description: 'Manage customer debts, employee roles, and sales commissions'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Daily sales reports, profit tracking, and cost shift analysis'
    },
    {
      icon: BarChart3,
      title: 'Multi-Supplier Tracking',
      description: 'Import inventory from multiple suppliers with automatic cost calculations'
    },
    {
      icon: Shield,
      title: 'Secure & Scalable',
      description: 'Role-based access control and enterprise-grade security'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-xl mb-4">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-indigo-600">KITS-POS</h1>
              <p className="text-gray-600">All-in-One Business Terminal</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="block text-gray-700 mb-2">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Enter your business name"
                    required={isSignup}
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : (isSignup ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignup(!isSignup)}
                className="text-indigo-600 hover:underline"
              >
                {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 p-12 flex-col justify-center">
        <div className="max-w-xl">
          <h2 className="text-white mb-4">Transform Your Business Operations</h2>
          <p className="text-indigo-100 mb-12">
            Streamline inventory, sales, and team management with our comprehensive POS system
          </p>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white mb-1">{feature.title}</h3>
                  <p className="text-indigo-200 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-indigo-500">
            <div className="flex items-center space-x-2 text-indigo-100">
              <CheckCircle className="w-5 h-5" />
              <span>Trusted by 5,000+ businesses worldwide</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}