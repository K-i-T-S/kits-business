import {
  AlertTriangle,
  Building2,
  CreditCard,
  Loader2,
  Save,
  Settings,
  ShoppingCart,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'businessInfo' | 'financial' | 'posBehaviour' | 'loyalty' | 'dangerZone';

interface BusinessForm {
  name: string;
  country: string;
  currency: string;
  phone: string;
  website: string;
}

interface FinancialForm {
  taxRate: string;
  defaultCurrency: string;
  decimalPlaces: string;
  tin: string;
  secondaryCurrency: string;
  exchangeRate: string;
  showDualCurrency: boolean;
}

interface PosForm {
  defaultPaymentMethod: 'cash' | 'card' | 'both';
  requireCustomerOnSale: boolean;
  printReceiptAutomatically: boolean;
}

interface LoyaltyForm {
  loyaltyEnabled: boolean;
  loyaltyPointsPerDollar: string;
  loyaltyPointsRedeemRate: string;
}

const POS_PAYMENT_KEY = 'pos_default_payment';
const POS_REQUIRE_CUSTOMER_KEY = 'pos_require_customer';
const POS_AUTO_PRINT_KEY = 'pos_auto_print_receipt';

function loadPosPrefs(): PosForm {
  const raw = localStorage.getItem(POS_PAYMENT_KEY);
  const method = raw === 'card' || raw === 'both' ? (raw as 'card' | 'both') : 'cash';
  return {
    defaultPaymentMethod: method,
    requireCustomerOnSale: localStorage.getItem(POS_REQUIRE_CUSTOMER_KEY) === 'true',
    printReceiptAutomatically: localStorage.getItem(POS_AUTO_PRINT_KEY) === 'true',
  };
}

// ── Toggle sub-component ──────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 ${
        checked ? 'bg-indigo-500' : 'bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SystemSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant, setCurrentTenant } = useApp();

  const [activeTab, setActiveTab] = useState<ActiveTab>('businessInfo');

  // Business info
  const [businessForm, setBusinessForm] = useState<BusinessForm>({
    name: currentTenant?.name ?? '',
    country: 'Lebanon',
    currency: 'USD',
    phone: '',
    website: '',
  });
  const [savingBusiness, setSavingBusiness] = useState(false);

  // Financial
  const [financialForm, setFinancialForm] = useState<FinancialForm>({
    taxRate: '11',
    defaultCurrency: 'USD',
    decimalPlaces: '2',
    tin: '',
    secondaryCurrency: 'LBP',
    exchangeRate: '89500',
    showDualCurrency: false,
  });
  const [savingFinancial, setSavingFinancial] = useState(false);

  // POS behaviour (localStorage)
  const [posForm, setPosForm] = useState<PosForm>(loadPosPrefs);
  const [savingPos, setSavingPos] = useState(false);

  // Loyalty
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltyForm>({
    loyaltyEnabled: false,
    loyaltyPointsPerDollar: '1',
    loyaltyPointsRedeemRate: '0.01',
  });
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  // Danger zone
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingBusiness, setDeletingBusiness] = useState(false);

  // Initialise forms from currentTenant
  useEffect(() => {
    if (!currentTenant) return;
    const settings = currentTenant.settings as Record<string, unknown>;
    setBusinessForm(prev => ({
      ...prev,
      name: currentTenant.name ?? prev.name,
      country: (settings['country'] as string | undefined) ?? prev.country,
      currency: (settings['currency'] as string | undefined) ?? prev.currency,
      phone: (settings['phone'] as string | undefined) ?? prev.phone,
      website: (settings['website'] as string | undefined) ?? prev.website,
    }));
    setFinancialForm(prev => ({
      ...prev,
      taxRate:
        currentTenant.tax_rate != null
          ? String(+(currentTenant.tax_rate * 100).toFixed(4))
          : (settings['tax_rate'] as string | undefined) ?? prev.taxRate,
      defaultCurrency: (settings['currency'] as string | undefined) ?? prev.defaultCurrency,
      decimalPlaces: (settings['decimal_places'] as string | undefined) ?? prev.decimalPlaces,
      tin: currentTenant.tin ?? prev.tin,
      secondaryCurrency: currentTenant.secondary_currency ?? prev.secondaryCurrency,
      exchangeRate:
        currentTenant.exchange_rate != null
          ? String(currentTenant.exchange_rate)
          : prev.exchangeRate,
      showDualCurrency: currentTenant.show_dual_currency ?? prev.showDualCurrency,
    }));
    setLoyaltyForm(prev => ({
      ...prev,
      loyaltyEnabled: currentTenant.loyalty_enabled ?? prev.loyaltyEnabled,
      loyaltyPointsPerDollar:
        currentTenant.loyalty_points_per_dollar != null
          ? String(currentTenant.loyalty_points_per_dollar)
          : prev.loyaltyPointsPerDollar,
      loyaltyPointsRedeemRate:
        currentTenant.loyalty_points_redeem_rate != null
          ? String(currentTenant.loyalty_points_redeem_rate)
          : prev.loyaltyPointsRedeemRate,
    }));
  }, [currentTenant]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveBusiness = async () => {
    if (!currentTenant) return;
    setSavingBusiness(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: businessForm.name.trim(),
          settings: {
            ...(currentTenant.settings as Record<string, unknown>),
            country: businessForm.country,
            currency: businessForm.currency,
            phone: businessForm.phone,
            website: businessForm.website,
          },
        })
        .eq('id', currentTenant.id);
      if (error) throw error;

      // Keep local state in sync
      setCurrentTenant({
        ...currentTenant,
        name: businessForm.name.trim(),
        settings: {
          ...(currentTenant.settings as Record<string, unknown>),
          country: businessForm.country,
          currency: businessForm.currency,
          phone: businessForm.phone,
          website: businessForm.website,
        },
      });

      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveFinancial = async () => {
    if (!currentTenant) return;
    setSavingFinancial(true);
    try {
      // tax_rate stored as decimal in DB (11% → 0.11)
      const taxRateDecimal = parseFloat(financialForm.taxRate) / 100;
      const exchangeRateNum = parseFloat(financialForm.exchangeRate) || 0;

      const { error } = await supabase
        .from('tenants')
        .update({
          tax_rate: taxRateDecimal,
          tin: financialForm.tin.trim() || null,
          secondary_currency: financialForm.secondaryCurrency,
          exchange_rate: exchangeRateNum,
          show_dual_currency: financialForm.showDualCurrency,
          settings: {
            ...(currentTenant.settings as Record<string, unknown>),
            currency: financialForm.defaultCurrency,
            decimal_places: financialForm.decimalPlaces,
          },
        })
        .eq('id', currentTenant.id);
      if (error) throw error;

      setCurrentTenant({
        ...currentTenant,
        tax_rate: taxRateDecimal,
        tin: financialForm.tin.trim() || null,
        secondary_currency: financialForm.secondaryCurrency,
        exchange_rate: exchangeRateNum,
        show_dual_currency: financialForm.showDualCurrency,
        settings: {
          ...(currentTenant.settings as Record<string, unknown>),
          currency: financialForm.defaultCurrency,
          decimal_places: financialForm.decimalPlaces,
        },
      });

      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingFinancial(false);
    }
  };

  const handleSavePos = () => {
    setSavingPos(true);
    try {
      localStorage.setItem(POS_PAYMENT_KEY, posForm.defaultPaymentMethod);
      localStorage.setItem(POS_REQUIRE_CUSTOMER_KEY, String(posForm.requireCustomerOnSale));
      localStorage.setItem(POS_AUTO_PRINT_KEY, String(posForm.printReceiptAutomatically));
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingPos(false);
    }
  };

  const handleSaveLoyalty = async () => {
    if (!currentTenant) return;
    setSavingLoyalty(true);
    try {
      const pointsPerDollar = parseFloat(loyaltyForm.loyaltyPointsPerDollar) || 1;
      const redeemRate = parseFloat(loyaltyForm.loyaltyPointsRedeemRate) || 0.01;

      const { error } = await supabase
        .from('tenants')
        .update({
          loyalty_enabled: loyaltyForm.loyaltyEnabled,
          loyalty_points_per_dollar: pointsPerDollar,
          loyalty_points_redeem_rate: redeemRate,
        })
        .eq('id', currentTenant.id);
      if (error) throw error;

      setCurrentTenant({
        ...currentTenant,
        loyalty_enabled: loyaltyForm.loyaltyEnabled,
        loyalty_points_per_dollar: pointsPerDollar,
        loyalty_points_redeem_rate: redeemRate,
      });

      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingLoyalty(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!currentTenant) return;
    if (deleteConfirmName !== currentTenant.name) {
      toast.error(t('settings.deleteConfirm'));
      return;
    }
    setDeletingBusiness(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', currentTenant.id);
      if (error) throw error;
      await supabase.auth.signOut();
      void navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
      setDeletingBusiness(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isOwner = currentTenant?.userRole === 'owner';

  // Exchange rate only shown when secondary currency differs from the primary
  const showExchangeRate = financialForm.secondaryCurrency !== financialForm.defaultCurrency;

  // Human-readable redemption label: e.g. 0.01 → "1 point = $0.01"
  const redeemRateNum = parseFloat(loyaltyForm.loyaltyPointsRedeemRate) || 0;
  const redeemLabel = `1 point = $${redeemRateNum.toFixed(2)}`;

  const tabs: { id: ActiveTab; label: string; icon: typeof Settings }[] = [
    { id: 'businessInfo', label: t('settings.businessInfo'), icon: Building2 },
    { id: 'financial', label: t('settings.financial'), icon: CreditCard },
    { id: 'posBehaviour', label: t('settings.posBehaviour'), icon: ShoppingCart },
    { id: 'loyalty', label: t('settings.loyaltyProgram'), icon: Star },
    { id: 'dangerZone', label: t('settings.dangerZone'), icon: AlertTriangle },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t('navigation.systemSettings')}
            </h1>
            <p className="mt-1 text-white/60 text-sm">
              {currentTenant?.name ?? ''}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="hidden sm:inline">{t('common.dashboard')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                {t('common.settings')}
              </p>
              <nav className="space-y-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isDanger = tab.id === 'dangerZone';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? isDanger
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : isDanger
                            ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-300'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-6">

            {/* ── Business Info ─────────────────────────────────────────── */}
            {activeTab === 'businessInfo' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white">
                  {t('settings.businessInfo')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessForm.name}
                      onChange={e => setBusinessForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Your business name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Country
                    </label>
                    <select
                      value={businessForm.country}
                      onChange={e => setBusinessForm(p => ({ ...p, country: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="Lebanon" className="bg-slate-800">Lebanon</option>
                      <option value="UAE" className="bg-slate-800">UAE</option>
                      <option value="Saudi Arabia" className="bg-slate-800">Saudi Arabia</option>
                      <option value="Jordan" className="bg-slate-800">Jordan</option>
                      <option value="Kuwait" className="bg-slate-800">Kuwait</option>
                      <option value="Qatar" className="bg-slate-800">Qatar</option>
                      <option value="Bahrain" className="bg-slate-800">Bahrain</option>
                      <option value="Oman" className="bg-slate-800">Oman</option>
                      <option value="Egypt" className="bg-slate-800">Egypt</option>
                      <option value="Other" className="bg-slate-800">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.currency')}
                    </label>
                    <select
                      value={businessForm.currency}
                      onChange={e => setBusinessForm(p => ({ ...p, currency: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="USD" className="bg-slate-800">USD ($)</option>
                      <option value="LBP" className="bg-slate-800">LBP (ل.ل)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={businessForm.phone}
                      onChange={e => setBusinessForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="+961 X XXX XXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={businessForm.website}
                      onChange={e => setBusinessForm(p => ({ ...p, website: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleSaveBusiness()}
                    disabled={savingBusiness}
                    className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {savingBusiness ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingBusiness ? t('settings.saving') : t('settings.saveChanges')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Financial ─────────────────────────────────────────────── */}
            {activeTab === 'financial' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white">
                  {t('settings.financial')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tax Rate */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.taxRate')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={financialForm.taxRate}
                      onChange={e => setFinancialForm(p => ({ ...p, taxRate: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <p className="mt-1 text-xs text-white/40">Lebanon TVA = 11%</p>
                  </div>

                  {/* Tax ID (TIN) */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.taxId')}
                    </label>
                    <input
                      type="text"
                      value={financialForm.tin}
                      onChange={e => setFinancialForm(p => ({ ...p, tin: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="e.g. 123456789"
                    />
                  </div>

                  {/* Default Currency */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.currency')}
                    </label>
                    <select
                      value={financialForm.defaultCurrency}
                      onChange={e => setFinancialForm(p => ({ ...p, defaultCurrency: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="USD" className="bg-slate-800">USD ($)</option>
                      <option value="LBP" className="bg-slate-800">LBP (ل.ل)</option>
                      <option value="EUR" className="bg-slate-800">EUR (€)</option>
                      <option value="GBP" className="bg-slate-800">GBP (£)</option>
                      <option value="AED" className="bg-slate-800">AED (د.إ)</option>
                      <option value="SAR" className="bg-slate-800">SAR (ر.س)</option>
                      <option value="QAR" className="bg-slate-800">QAR (ر.ق)</option>
                      <option value="KWD" className="bg-slate-800">KWD (د.ك)</option>
                    </select>
                  </div>

                  {/* Secondary Currency */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.secondaryCurrency')}
                    </label>
                    <select
                      value={financialForm.secondaryCurrency}
                      onChange={e => setFinancialForm(p => ({ ...p, secondaryCurrency: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="LBP" className="bg-slate-800">LBP (ل.ل)</option>
                      <option value="USD" className="bg-slate-800">USD ($)</option>
                      <option value="EUR" className="bg-slate-800">EUR (€)</option>
                      <option value="GBP" className="bg-slate-800">GBP (£)</option>
                      <option value="AED" className="bg-slate-800">AED (د.إ)</option>
                      <option value="SAR" className="bg-slate-800">SAR (ر.س)</option>
                      <option value="QAR" className="bg-slate-800">QAR (ر.ق)</option>
                      <option value="KWD" className="bg-slate-800">KWD (د.ك)</option>
                    </select>
                  </div>

                  {/* Exchange Rate — shown only when secondary ≠ primary */}
                  {showExchangeRate && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        {t('settings.exchangeRate')}{' '}
                        <span className="text-white/40 font-normal">
                          ({financialForm.secondaryCurrency} per {financialForm.defaultCurrency})
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={financialForm.exchangeRate}
                        onChange={e => setFinancialForm(p => ({ ...p, exchangeRate: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <p className="mt-1 text-xs text-white/40">
                        LBP per USD — update from sayrafa.com
                      </p>
                    </div>
                  )}

                  {/* Decimal Places */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Decimal Places
                    </label>
                    <select
                      value={financialForm.decimalPlaces}
                      onChange={e => setFinancialForm(p => ({ ...p, decimalPlaces: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="0" className="bg-slate-800">0 (e.g. 100)</option>
                      <option value="2" className="bg-slate-800">2 (e.g. 100.00)</option>
                      <option value="3" className="bg-slate-800">3 (e.g. 100.000)</option>
                    </select>
                  </div>
                </div>

                {/* Show Dual Currency toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-white">{t('settings.showDualCurrency')}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      Show prices in both {financialForm.defaultCurrency} and {financialForm.secondaryCurrency} on POS and receipts
                    </p>
                  </div>
                  <Toggle
                    checked={financialForm.showDualCurrency}
                    onChange={v => setFinancialForm(p => ({ ...p, showDualCurrency: v }))}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleSaveFinancial()}
                    disabled={savingFinancial}
                    className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {savingFinancial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingFinancial ? t('settings.saving') : t('settings.saveChanges')}
                  </button>
                </div>
              </div>
            )}

            {/* ── POS Behaviour ─────────────────────────────────────────── */}
            {activeTab === 'posBehaviour' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white">
                  {t('settings.posBehaviour')}
                </h2>

                <div className="space-y-4">
                  {/* Default payment method */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Default Payment Method
                    </label>
                    <select
                      value={posForm.defaultPaymentMethod}
                      onChange={e => setPosForm(p => ({ ...p, defaultPaymentMethod: e.target.value as 'cash' | 'card' | 'both' }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="cash" className="bg-slate-800">Cash</option>
                      <option value="card" className="bg-slate-800">Card</option>
                      <option value="both" className="bg-slate-800">Both</option>
                    </select>
                  </div>

                  {/* Require customer */}
                  <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">Require customer on sale</p>
                      <p className="text-xs text-white/50 mt-0.5">Cashier must select a customer before completing a sale</p>
                    </div>
                    <Toggle
                      checked={posForm.requireCustomerOnSale}
                      onChange={v => setPosForm(p => ({ ...p, requireCustomerOnSale: v }))}
                    />
                  </div>

                  {/* Auto print receipt */}
                  <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">Print receipt automatically</p>
                      <p className="text-xs text-white/50 mt-0.5">Automatically open print dialog after each completed sale</p>
                    </div>
                    <Toggle
                      checked={posForm.printReceiptAutomatically}
                      onChange={v => setPosForm(p => ({ ...p, printReceiptAutomatically: v }))}
                    />
                  </div>
                </div>

                <p className="text-xs text-white/40">
                  POS behaviour settings are stored locally in this browser.
                </p>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSavePos}
                    disabled={savingPos}
                    className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {savingPos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingPos ? t('settings.saving') : t('settings.saveChanges')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Loyalty Program ───────────────────────────────────────── */}
            {activeTab === 'loyalty' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-400 shrink-0" />
                  <h2 className="text-lg font-semibold text-white">
                    {t('settings.loyaltyProgram')}
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Enable loyalty */}
                  <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">{t('settings.enableLoyalty')}</p>
                      <p className="text-xs text-white/50 mt-0.5">
                        Customers earn and redeem points on every purchase
                      </p>
                    </div>
                    <Toggle
                      checked={loyaltyForm.loyaltyEnabled}
                      onChange={v => setLoyaltyForm(p => ({ ...p, loyaltyEnabled: v }))}
                    />
                  </div>

                  {/* Points config — shown only when loyalty is enabled */}
                  {loyaltyForm.loyaltyEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Points per dollar */}
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          {t('settings.pointsPerDollar')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={loyaltyForm.loyaltyPointsPerDollar}
                          onChange={e => setLoyaltyForm(p => ({ ...p, loyaltyPointsPerDollar: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <p className="mt-1 text-xs text-white/40">e.g. 1 = earn 1 point per $1 spent</p>
                      </div>

                      {/* Redemption value */}
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          {t('settings.redemptionValue')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={loyaltyForm.loyaltyPointsRedeemRate}
                          onChange={e => setLoyaltyForm(p => ({ ...p, loyaltyPointsRedeemRate: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <p className="mt-1 text-xs text-white/40">{redeemLabel}</p>
                      </div>
                    </div>
                  )}

                  {/* Tier thresholds — read-only info */}
                  <div className="p-4 bg-slate-900 border border-white/10 rounded-xl space-y-3">
                    <p className="text-sm font-medium text-white/80">{t('settings.loyaltyTiers')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl">
                        <span className="text-amber-600 text-lg">🥉</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-400">Bronze</p>
                          <p className="text-xs text-white/50">0 – 499 pts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-slate-700/30 border border-slate-500/30 rounded-xl">
                        <span className="text-slate-300 text-lg">🥈</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-300">Silver</p>
                          <p className="text-xs text-white/50">500 – 1,999 pts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-xl">
                        <span className="text-yellow-400 text-lg">🥇</span>
                        <div>
                          <p className="text-xs font-semibold text-yellow-400">Gold</p>
                          <p className="text-xs text-white/50">2,000+ pts</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => void handleSaveLoyalty()}
                    disabled={savingLoyalty}
                    className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {savingLoyalty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingLoyalty ? t('settings.saving') : t('settings.saveChanges')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Danger Zone ───────────────────────────────────────────── */}
            {activeTab === 'dangerZone' && (
              <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-5 sm:p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                  <h2 className="text-lg font-semibold text-red-300">
                    {t('settings.dangerZone')}
                  </h2>
                </div>

                {!isOwner ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-sm text-white/60">
                      Only the business owner can delete this business.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <h3 className="text-sm font-semibold text-red-300 mb-1">
                        {t('settings.deleteAccount')}
                      </h3>
                      <p className="text-xs text-red-300/70 mb-4">
                        This action is permanent and cannot be undone. All data associated with this business will be deleted.
                      </p>

                      <label className="block text-sm font-medium text-white/80 mb-2">
                        {t('settings.deleteConfirm')}:{' '}
                        <span className="font-bold text-red-300">{currentTenant?.name}</span>
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={e => setDeleteConfirmName(e.target.value)}
                        placeholder={currentTenant?.name ?? ''}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-red-500/30 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => void handleDeleteBusiness()}
                        disabled={deletingBusiness || deleteConfirmName !== currentTenant?.name}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {deletingBusiness
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                        {deletingBusiness ? 'Deleting...' : t('settings.deleteAccount')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
