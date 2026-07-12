import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Building2, Package, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import '../styles/login.css';
import type { Industry } from '../types/industry';
import { ROLE_LABELS } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

import IndustrySelector from './industry/IndustrySelector';
import OnboardingBrandPanel from './onboarding/OnboardingBrandPanel';
import { STEP2_COPY } from './onboarding/stepCopy';

interface OnboardingWizardProps {
  tenantId: string;
  tenantName: string;
  onComplete: () => void;
}

const CONFETTI_COLORS = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#a78bfa'];

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const stepContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

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

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i * 360) / 14 + (Math.random() * 20 - 10),
        distance: 60 + Math.random() * 40,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.15,
      })),
    [],
  );

  const step2Copy = STEP2_COPY[industry];

  const inputClass = 'w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-500/70 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/20';
  const selectClass = 'w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white outline-none transition-all focus:border-indigo-500/70 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/20';
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60 text-start';
  const primaryBtn = 'w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-sky-400 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60';
  const skipBtn = 'block w-full cursor-pointer text-center text-sm text-white/40 underline transition-colors hover:text-white/70';
  const stepIconWrap = 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/30 to-sky-500/20';

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
      // Route through the same send-invitation edge function InviteTeamMemberModal
      // uses: it creates the pending_invitations row and emails the invitee. A
      // direct employees insert (the old behavior here) never notified anyone and
      // left the invitee with no way to log in and claim access.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { error: fnError } = await supabase.functions.invoke('send-invitation', {
        body: {
          inviteeEmail: memberEmail.trim(),
          inviteeName: memberName.trim(),
          role: memberRole,
          commission: 0,
          tenantId,
          tenantName: businessName.trim() || tenantName,
        },
      });
      if (fnError) throw fnError;
      setMemberAdded(true);
      toast.success('Invitation sent!');
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
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

  return (
    <div className="flex min-h-screen bg-slate-950">
      <OnboardingBrandPanel step={step} businessName={businessName} industry={industry} />

      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-lg">
          {/* Brand mark — visible on mobile only (desktop shows OnboardingBrandPanel) */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <img
                src="/logo.png"
                alt={`${BRAND.name} logo`}
                className="h-7 w-7 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <span className="text-base font-bold text-white">{BRAND.shortName}</span>
              <p className="text-[11px] text-white/50">Business Terminal</p>
            </div>
          </div>

          {/* Progress bar + step dots */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/40">
              <span>Setup progress</span>
              <span>{step} / 4</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                initial={false}
                animate={{ width: `${(step / 4) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Step 1: Business Profile */}
              {step === 1 && (
                <motion.div variants={stepContainerVariants} initial="hidden" animate="show" className="space-y-5">
                  <motion.div variants={fieldVariants} className="mb-6 flex items-center gap-3">
                    <div className={stepIconWrap}>
                      <Building2 className="h-6 w-6 text-indigo-300" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Tell us about your business</h2>
                      <p className="text-sm text-white/40">Step 1 of 4 — Business profile</p>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-business-name">Business Name *</label>
                    <input id="ob-business-name" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} className={inputClass} placeholder="My Business" required />
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label className={labelClass}>Industry</label>
                    <IndustrySelector value={industry} onChange={setIndustry} disabled={loading} />
                  </motion.div>
                  <motion.div variants={fieldVariants} className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor="ob-country">Country</label>
                      <select id="ob-country" value={country} onChange={e => setCountry(e.target.value)} className={selectClass}>
                        {['Lebanon', 'UAE', 'Saudi Arabia', 'Jordan', 'Kuwait', 'Other'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="ob-currency">Currency</label>
                      <select id="ob-currency" value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass}>
                        {['USD', 'LBP', 'AED', 'SAR'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-phone">Phone <span className="text-white/30">(optional)</span></label>
                    <input id="ob-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+961 X XXX XXX" />
                  </motion.div>

                  {error && <motion.div variants={fieldVariants} className="login-message-animated rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</motion.div>}

                  <motion.button variants={fieldVariants} onClick={() => void handleStep1()} disabled={loading} className={primaryBtn}>
                    {loading ? 'Saving…' : 'Continue →'}
                  </motion.button>
                </motion.div>
              )}

              {/* Step 2: First Product */}
              {step === 2 && (
                <motion.div variants={stepContainerVariants} initial="hidden" animate="show" className="space-y-5">
                  <motion.div variants={fieldVariants} className="mb-6 flex items-center gap-3">
                    <div className={stepIconWrap}>
                      <Package className="h-6 w-6 text-indigo-300" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{step2Copy.heading}</h2>
                      <p className="text-sm text-white/40">{step2Copy.subtitle}</p>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-product-name">{step2Copy.nameLabel}</label>
                    <input id="ob-product-name" type="text" value={productName} onChange={e => setProductName(e.target.value)} className={inputClass} placeholder={step2Copy.placeholder} required />
                  </motion.div>
                  <motion.div variants={fieldVariants} className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor="ob-product-price">Price *</label>
                      <input id="ob-product-price" type="number" min="0" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} className={inputClass} placeholder="0.00" required />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="ob-product-stock">Stock Qty</label>
                      <input id="ob-product-stock" type="number" min="0" step="1" value={productStock} onChange={e => setProductStock(e.target.value)} className={inputClass} placeholder="0" />
                    </div>
                  </motion.div>
                  <motion.div variants={fieldVariants} className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor="ob-product-category">Category</label>
                      <input id="ob-product-category" type="text" value={productCategory} onChange={e => setProductCategory(e.target.value)} className={inputClass} placeholder="e.g. Beverages" />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="ob-product-unit">Unit</label>
                      <select id="ob-product-unit" value={productUnit} onChange={e => setProductUnit(e.target.value)} className={selectClass}>
                        {['Piece', 'Kg', 'Litre', 'Box', 'Pack', 'Other'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>

                  {error && <motion.div variants={fieldVariants} className="login-message-animated rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</motion.div>}

                  <motion.button variants={fieldVariants} onClick={() => void handleStep2()} disabled={loading} className={primaryBtn}>
                    {loading ? 'Adding…' : step2Copy.ctaLabel}
                  </motion.button>
                  <motion.button variants={fieldVariants} type="button" onClick={() => { setStep(3); setError(''); }} className={`${skipBtn} mt-1`}>
                    Skip for now
                  </motion.button>
                </motion.div>
              )}

              {/* Step 3: Invite Team */}
              {step === 3 && (
                <motion.div variants={stepContainerVariants} initial="hidden" animate="show" className="space-y-5">
                  <motion.div variants={fieldVariants} className="mb-6 flex items-center gap-3">
                    <div className={stepIconWrap}>
                      <Users className="h-6 w-6 text-indigo-300" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Invite your team</h2>
                      <p className="text-sm text-white/40">Step 3 of 4 — Team setup</p>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-member-name">Full Name *</label>
                    <input id="ob-member-name" type="text" value={memberName} onChange={e => setMemberName(e.target.value)} className={inputClass} placeholder="Team member name" required />
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-member-email">Email *</label>
                    <input id="ob-member-email" type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} className={inputClass} placeholder="email@example.com" required />
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <label className={labelClass} htmlFor="ob-member-role">Role</label>
                    <select id="ob-member-role" value={memberRole} onChange={e => setMemberRole(e.target.value)} className={selectClass}>
                      {/* All 8 canonical roles except 'owner' — matches
                          InviteTeamMemberModal.tsx's StandardInviteRole set for
                          consistency across the two invite entry points
                          (Track 1d, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
                          Previously only offered 3 of 8. */}
                      <option value="admin">{ROLE_LABELS.admin}</option>
                      <option value="manager">{ROLE_LABELS.manager}</option>
                      <option value="supervisor">{ROLE_LABELS.supervisor}</option>
                      <option value="cashier">{ROLE_LABELS.cashier}</option>
                      <option value="accountant">{ROLE_LABELS.accountant}</option>
                      <option value="stockkeeper">{ROLE_LABELS.stockkeeper}</option>
                      <option value="viewer">{ROLE_LABELS.viewer}</option>
                    </select>
                  </motion.div>

                  {error && <motion.div variants={fieldVariants} className="login-message-animated rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</motion.div>}

                  <motion.button variants={fieldVariants} onClick={() => void handleStep3()} disabled={loading} className={primaryBtn}>
                    {loading ? 'Inviting…' : 'Invite & Continue →'}
                  </motion.button>
                  <motion.button variants={fieldVariants} type="button" onClick={() => { setStep(4); setError(''); }} className={`${skipBtn} mt-1`}>
                    Skip for now
                  </motion.button>
                </motion.div>
              )}

              {/* Step 4: Done */}
              {step === 4 && (
                <div className="space-y-6 text-center">
                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                    {confetti.map((c, i) => (
                      <motion.span
                        key={i}
                        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                        style={{ background: c.color }}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        animate={{
                          opacity: 0,
                          x: Math.cos((c.angle * Math.PI) / 180) * c.distance,
                          y: Math.sin((c.angle * Math.PI) / 180) * c.distance,
                          scale: 0,
                        }}
                        transition={{ duration: 0.9, delay: c.delay, ease: 'easeOut' }}
                        aria-hidden="true"
                      />
                    ))}
                    <motion.div
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                    >
                      <CheckCircle className="h-16 w-16 text-emerald-400" />
                    </motion.div>
                  </div>
                  <div>
                    <h2 className="mb-2 text-2xl font-bold text-white">You're all set!</h2>
                    <p className="text-sm text-white/50">Your business is ready to go.</p>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-start">
                    <div className="flex items-center gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className="text-white/70">Business profile configured</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {productAdded
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                        : <div className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20" />
                      }
                      <span className={productAdded ? 'text-white/70' : 'text-white/30'}>
                        {productAdded ? 'First product added' : 'No products added yet — add them from Inventory'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {memberAdded
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                        : <div className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20" />
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
