import { CheckCircle, Building2, Package, Users } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import type { Industry } from '../types/industry';
import { supabase } from '../utils/supabaseClient';

import IndustrySelector from './industry/IndustrySelector';

interface OnboardingWizardProps {
  tenantId: string;
  tenantName: string;
  onComplete: () => void;
}

export default function OnboardingWizard({ tenantId, tenantName, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [businessName, setBusinessName] = useState(tenantName);
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [country, setCountry] = useState('Lebanon');
  const [currency, setCurrency] = useState('USD');
  const [phone, setPhone] = useState('');

  // Step 2 state
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('0');
  const [productCategory, setProductCategory] = useState('');
  const [productUnit, setProductUnit] = useState('Piece');
  const [productAdded, setProductAdded] = useState(false);

  // Step 3 state
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('cashier');
  const [memberAdded, setMemberAdded] = useState(false);

  const inputClass = 'bg-white/5 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 transition-colors';
  const selectClass = 'bg-slate-800 border border-white/20 text-white rounded-xl px-4 py-3 w-full focus:outline-none focus:border-indigo-500 transition-colors';
  const labelClass = 'block text-sm font-medium text-white/70 mb-1 text-start';
  const primaryBtn = 'w-full btn-brand text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

  // Map country → nearest Supabase region (all MENA closest to eu-central-1)
  const COUNTRY_REGION: Record<string, string> = {
    'Lebanon': 'eu-central-1',
    'UAE': 'us-east-1',
    'Saudi Arabia': 'us-east-1',
    'Jordan': 'eu-central-1',
    'Kuwait': 'us-east-1',
    'Other': 'eu-central-1',
  };

  const handleStep1 = async () => {
    if (!businessName.trim()) { setError('Business name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          name: businessName.trim(),
          business_type: industry || null,
          industry: industry || null,
          country: country || null,
          currency: currency || null,
          phone: phone || null,
          preferred_region: COUNTRY_REGION[country] ?? 'eu-central-1',
        })
        .eq('id', tenantId);
      if (updateError) throw updateError;
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!productName.trim()) { setError('Product name is required.'); return; }
    const price = parseFloat(productPrice);
    if (isNaN(price) || price < 0) { setError('Enter a valid price.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('products').insert({
        tenant_id: tenantId,
        name: productName.trim(),
        price,
        cost: 0,
        stock_quantity: parseInt(productStock, 10) || 0,
        category: productCategory || null,
        unit: productUnit,
        is_active: true,
        min_stock_level: 0,
      });
      if (insertError) throw insertError;
      setProductAdded(true);
      toast.success('Product added!');
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add product.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!memberName.trim() || !memberEmail.trim()) { setError('Name and email are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('employees').insert({
        tenant_id: tenantId,
        name: memberName.trim(),
        email: memberEmail.trim(),
        role: memberRole,
        commission_rate: 0,
        is_active: true,
      });
      if (insertError) throw insertError;
      setMemberAdded(true);
      toast.success('Team member added!');
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await supabase
        .from('tenants')
        .update({ onboarding_completed: true, db_provision_status: 'pending' })
        .eq('id', tenantId);
      onComplete();
    } catch {
      onComplete();
    }
  };

  const StepDot = ({ n }: { n: number }) => (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all ${
      n < step ? 'bg-indigo-600 text-white' :
        n === step ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-300' :
          'bg-white/5 border border-white/10 text-white/30'
    }`}>{n}</div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-4">
          <StepDot n={1} />
          <div className="flex-1 h-px bg-white/10 mx-2" />
          <StepDot n={2} />
          <div className="flex-1 h-px bg-white/10 mx-2" />
          <StepDot n={3} />
          <div className="flex-1 h-px bg-white/10 mx-2" />
          <StepDot n={4} />
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-1 mb-8">
          <div className="bg-indigo-500 h-1 rounded-full transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        {/* Step 1: Business Profile */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Tell us about your business</h2>
                <p className="text-sm text-white/40">Step 1 of 4 — Business profile</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Business Name *</label>
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} className={inputClass} placeholder="My Business" required />
            </div>

            {/* Brand preview card */}
            {businessName.trim() && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex-shrink-0"
                  style={{ background: 'var(--brand-primary)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{businessName}</p>
                  <p className="text-xs text-white/40">Powered by KiTS</p>
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Industry</label>
              <IndustrySelector value={industry} onChange={setIndustry} disabled={loading} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Country</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className={selectClass}>
                  {['Lebanon', 'UAE', 'Saudi Arabia', 'Jordan', 'Kuwait', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass}>
                  {['USD', 'LBP', 'AED', 'SAR'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Phone <span className="text-white/30">(optional)</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+961 X XXX XXX" />
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

            <button onClick={() => void handleStep1()} disabled={loading} className={primaryBtn}>
              {loading ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 2: First Product */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add your first product</h2>
                <p className="text-sm text-white/40">Step 2 of 4 — Inventory setup</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Product Name *</label>
              <input type="text" value={productName} onChange={e => setProductName(e.target.value)} className={inputClass} placeholder="e.g. Bottled Water 500ml" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Price *</label>
                <input type="number" min="0" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} className={inputClass} placeholder="0.00" required />
              </div>
              <div>
                <label className={labelClass}>Stock Qty</label>
                <input type="number" min="0" step="1" value={productStock} onChange={e => setProductStock(e.target.value)} className={inputClass} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <input type="text" value={productCategory} onChange={e => setProductCategory(e.target.value)} className={inputClass} placeholder="e.g. Beverages" />
              </div>
              <div>
                <label className={labelClass}>Unit</label>
                <select value={productUnit} onChange={e => setProductUnit(e.target.value)} className={selectClass}>
                  {['Piece', 'Kg', 'Litre', 'Box', 'Pack', 'Other'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

            <button onClick={() => void handleStep2()} disabled={loading} className={primaryBtn}>
              {loading ? 'Adding…' : 'Add Product & Continue →'}
            </button>
            <button type="button" onClick={() => { setStep(3); setError(''); }} className="block text-center w-full mt-1 text-sm text-white/40 hover:text-white/70 cursor-pointer underline transition-colors">
              Skip for now
            </button>
          </div>
        )}

        {/* Step 3: Invite Team */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Invite your team</h2>
                <p className="text-sm text-white/40">Step 3 of 4 — Team setup</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Full Name *</label>
              <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} className={inputClass} placeholder="Team member name" required />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} className={inputClass} placeholder="email@example.com" required />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select value={memberRole} onChange={e => setMemberRole(e.target.value)} className={selectClass}>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-4 py-3 text-sm">{error}</div>}

            <button onClick={() => void handleStep3()} disabled={loading} className={primaryBtn}>
              {loading ? 'Inviting…' : 'Invite & Continue →'}
            </button>
            <button type="button" onClick={() => { setStep(4); setError(''); }} className="block text-center w-full mt-1 text-sm text-white/40 hover:text-white/70 cursor-pointer underline transition-colors">
              Skip for now
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-16 w-16 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">You're all set!</h2>
              <p className="text-white/50 text-sm">Your business is ready to go.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-start space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-white/70">Business profile configured</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {productAdded
                  ? <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  : <div className="h-4 w-4 rounded-full border border-white/20 flex-shrink-0" />
                }
                <span className={productAdded ? 'text-white/70' : 'text-white/30'}>
                  {productAdded ? 'First product added' : 'No products added yet — add them from Inventory'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {memberAdded
                  ? <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  : <div className="h-4 w-4 rounded-full border border-white/20 flex-shrink-0" />
                }
                <span className={memberAdded ? 'text-white/70' : 'text-white/30'}>
                  {memberAdded ? 'Team member invited' : 'No team members yet — invite them from Employees'}
                </span>
              </div>
            </div>

            <button onClick={() => void handleFinish()} disabled={loading} className={primaryBtn}>
              {loading ? 'Setting up…' : 'Go to Dashboard →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
