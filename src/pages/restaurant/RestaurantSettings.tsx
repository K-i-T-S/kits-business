import { Settings2, Save, ToggleLeft, ToggleRight, AlertCircle, QrCode, Copy, Check, ExternalLink } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import RoleGate from '@/components/RoleGate';
import { useApp } from '@/context/AppContext';
import type { RestaurantSettings, OrderFlow, PaymentMode } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

const QR_PALETTES = [
  { key: 'dark-luxury', label: 'Dark Luxury', bg: '#0a0f1e', accent: '#c8a96e' },
  { key: 'beirut-night', label: 'Beirut Night', bg: '#0d0d0d', accent: '#e63946' },
  { key: 'mediterranean', label: 'Mediterranean', bg: '#1a2942', accent: '#00b4d8' },
  { key: 'lebanese-garden', label: 'Lebanese Garden', bg: '#0f2010', accent: '#4caf50' },
  { key: 'classic-bistro', label: 'Classic Bistro', bg: '#1c1410', accent: '#d4a853' },
  { key: 'modern-minimal', label: 'Modern Minimal', bg: '#111111', accent: '#ffffff' },
] as const;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const DEFAULT_SETTINGS: Omit<RestaurantSettings, 'id' | 'tenant_id'> = {
  default_order_flow: 'waiter_confirm',
  default_payment_mode: 'waiter_only',
  service_charge_enabled: true,
  service_charge_pct: 10,
  vat_enabled: true,
  vat_pct: 11,
  tip_pool_enabled: false,
  slow_service_threshold_minutes: 15,
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`flex-none transition-colors ${checked ? 'text-amber-400' : 'text-white/30'}`}
        aria-pressed={checked}
        aria-label={label}
      >
        {checked
          ? <ToggleRight className="h-8 w-8" />
          : <ToggleLeft className="h-8 w-8" />
        }
      </button>
    </div>
  );
}

export default function RestaurantSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [settings, setSettings] = useState<Omit<RestaurantSettings, 'id' | 'tenant_id'>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // QR / digital menu settings (stored on tenants table)
  const [qrSlug, setQrSlug] = useState('');
  const [qrPalette, setQrPalette] = useState('dark-luxury');
  const [qrBanner, setQrBanner] = useState('');
  const [slugError, setSlugError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) {
        const { id, tenant_id: _tenantId, ...rest } = data as RestaurantSettings;
        setSettingsId(id);
        setSettings(rest);
      }
    } catch (err) {
      console.error('[RestaurantSettings] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Initialise QR fields from AppContext (already loaded via get_current_user_tenant)
  useEffect(() => {
    if (!currentTenant) return;
    setQrSlug(currentTenant.tenant_slug ?? slugify(currentTenant.name ?? ''));
    setQrPalette(currentTenant.qr_menu_palette ?? 'dark-luxury');
    setQrBanner(currentTenant.qr_menu_promotional_banner ?? '');
  }, [currentTenant]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    if (!tenantId) return;

    // Validate slug
    if (!/^[a-z0-9-]+$/.test(qrSlug)) {
      setSlugError('Only lowercase letters, numbers, and hyphens allowed');
      return;
    }
    setSlugError('');

    setSaving(true);
    try {
      // Save restaurant_settings
      const payload = { ...settings, tenant_id: tenantId, updated_at: new Date().toISOString() };
      let error: { message: string } | null = null;
      if (settingsId) {
        const res = await supabase.from('restaurant_settings').update(payload).eq('id', settingsId);
        error = res.error;
      } else {
        const res = await supabase.from('restaurant_settings').insert(payload).select().single();
        error = res.error;
        if (res.data) setSettingsId((res.data as RestaurantSettings).id);
      }
      if (error) { toast.error(error.message); return; }

      // Save QR / digital menu fields to tenants table
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          tenant_slug: qrSlug || null,
          qr_menu_palette: qrPalette,
          qr_menu_promotional_banner: qrBanner || null,
        })
        .eq('id', tenantId);
      if (tenantError) { toast.error(tenantError.message); return; }

      toast.success(t('restaurant.settings.saved', 'Settings saved'));
    } finally {
      setSaving(false);
    }
  };

  const qrBaseUrl = qrSlug
    ? `${window.location.origin}/menu/${qrSlug}`
    : '';

  const handleCopyUrl = async () => {
    if (!qrBaseUrl) return;
    await navigator.clipboard.writeText(`${qrBaseUrl}/1`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-yellow-500/10 border border-amber-500/20">
              <Settings2 className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {t('restaurant.settings.title', 'Restaurant Settings')}
              </h1>
              <p className="mt-0.5 text-sm text-white/40">
                {t('restaurant.settings.desc', 'Configure order flow, service charges, and operational defaults')}
              </p>
            </div>
          </div>

          <RoleGate
            action="manage_settings"
            fallback={
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertCircle className="h-5 w-5 flex-none text-amber-400" />
                <p className="text-sm text-amber-300">
                  {t('restaurant.settings.managerOnly', 'Only owners and managers can modify restaurant settings.')}
                </p>
              </div>
            }
          >
            <div className="space-y-4">

              {/* Order Flow */}
              <section className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-4">
                  {t('restaurant.settings.orderFlow', 'Order Flow')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">
                      {t('restaurant.settings.defaultOrderFlow', 'Default Order Flow')}
                    </p>
                    <div className="flex gap-2">
                      {([
                        { key: 'waiter_confirm' as OrderFlow, label: t('restaurant.orderFlow.waiterConfirm', 'Waiter Confirms'), desc: t('restaurant.orderFlow.waiterConfirmDesc', 'Customer orders need waiter approval before going to kitchen') },
                        { key: 'direct' as OrderFlow, label: t('restaurant.orderFlow.direct', 'Direct to Kitchen'), desc: t('restaurant.orderFlow.directDesc', 'Customer orders go straight to KDS automatically') },
                      ]).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => update('default_order_flow', key)}
                          className={`flex-1 rounded-xl border-2 p-3 text-start transition-all ${
                            settings.default_order_flow === key
                              ? 'border-amber-500/50 bg-amber-500/10 shadow-amber-500/10 shadow-lg'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <p className={`text-sm font-semibold ${settings.default_order_flow === key ? 'text-amber-300' : 'text-white/70'}`}>
                            {label}
                          </p>
                          <p className="mt-0.5 text-xs text-white/40">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">
                      {t('restaurant.settings.paymentMode', 'Payment Mode')}
                    </p>
                    <div className="flex gap-2">
                      {([
                        { key: 'waiter_only' as PaymentMode, label: t('restaurant.paymentMode.waiterOnly', 'Waiter Handles Bill'), desc: t('restaurant.paymentMode.waiterOnlyDesc', 'Only waiters can close and process the bill') },
                        { key: 'customer_can_pay' as PaymentMode, label: t('restaurant.paymentMode.customerCanPay', 'Customer Can Pay'), desc: t('restaurant.paymentMode.customerCanPayDesc', 'Customers can self-pay via QR code at their table') },
                      ]).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => update('default_payment_mode', key)}
                          className={`flex-1 rounded-xl border-2 p-3 text-start transition-all ${
                            settings.default_payment_mode === key
                              ? 'border-amber-500/50 bg-amber-500/10 shadow-amber-500/10 shadow-lg'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <p className={`text-sm font-semibold ${settings.default_payment_mode === key ? 'text-amber-300' : 'text-white/70'}`}>
                            {label}
                          </p>
                          <p className="mt-0.5 text-xs text-white/40">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Charges */}
              <section className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                  {t('restaurant.settings.charges', 'Charges & Tax')}
                </h2>

                <ToggleRow
                  label={t('restaurant.settings.serviceChargeEnabled', 'Service Charge')}
                  description={t('restaurant.settings.serviceChargeDesc', 'Automatically add service charge to all bills')}
                  checked={settings.service_charge_enabled}
                  onChange={(v) => update('service_charge_enabled', v)}
                />

                {settings.service_charge_enabled && (
                  <div className="ps-4 border-s-2 border-amber-500/30">
                    <label className="mb-2 flex items-center justify-between text-xs text-white/50">
                      <span>{t('restaurant.settings.serviceChargePct', 'Service Charge %')}</span>
                      <span className="font-bold text-amber-400">{settings.service_charge_pct}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={0.5}
                      value={settings.service_charge_pct}
                      onChange={(e) => update('service_charge_pct', parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                      aria-label="Service charge percentage"
                    />
                    <div className="flex justify-between text-[10px] text-white/30 mt-1">
                      <span>0%</span><span>10%</span><span>20%</span>
                    </div>
                  </div>
                )}

                <div className="border-t border-white/8" />

                <ToggleRow
                  label={t('restaurant.settings.vatEnabled', 'VAT (Value Added Tax)')}
                  description={t('restaurant.settings.vatDesc', 'Lebanon standard VAT is 11%')}
                  checked={settings.vat_enabled}
                  onChange={(v) => update('vat_enabled', v)}
                />

                {settings.vat_enabled && (
                  <div className="ps-4 border-s-2 border-amber-500/30">
                    <label className="mb-1.5 block text-xs text-white/50">
                      {t('restaurant.settings.vatPct', 'VAT %')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={settings.vat_pct}
                      onChange={(e) => update('vat_pct', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      aria-label="VAT percentage"
                    />
                  </div>
                )}
              </section>

              {/* Tips & Alerts */}
              <section className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                  {t('restaurant.settings.tipsAlerts', 'Tips & Alerts')}
                </h2>

                <ToggleRow
                  label={t('restaurant.settings.tipPool', 'Tip Pool')}
                  description={t('restaurant.settings.tipPoolDesc', 'Pool tips across all waiters for equitable distribution')}
                  checked={settings.tip_pool_enabled}
                  onChange={(v) => update('tip_pool_enabled', v)}
                />

                <div className="border-t border-white/8" />

                <div>
                  <label className="mb-1 flex items-center justify-between text-xs text-white/50">
                    <span>{t('restaurant.settings.slowServiceThreshold', 'Slow Service Alert (minutes)')}</span>
                    <span className="font-bold text-amber-400">{settings.slow_service_threshold_minutes}m</span>
                  </label>
                  <p className="mb-2 text-xs text-white/30">
                    {t('restaurant.settings.slowServiceDesc', 'Tables open longer than this threshold are highlighted in orange')}
                  </p>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={settings.slow_service_threshold_minutes}
                    onChange={(e) => update('slow_service_threshold_minutes', parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                    aria-label="Slow service threshold in minutes"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-1">
                    <span>5m</span><span>30m</span><span>60m</span>
                  </div>
                </div>
              </section>

              {/* Digital Menu (QR) */}
              <section className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-amber-400 flex-none" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                    Digital Menu (QR Code)
                  </h2>
                </div>

                {/* Slug */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white/70">
                    Menu URL Identifier
                    <span className="ms-1.5 text-white/30 font-normal">(your unique slug)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex-none text-xs text-white/30">{window.location.origin}/menu/</span>
                    <input
                      type="text"
                      value={qrSlug}
                      onChange={(e) => {
                        setQrSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        setSlugError('');
                      }}
                      placeholder={slugify(currentTenant?.name ?? 'my-restaurant')}
                      className="flex-1 min-w-0 rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  {slugError && (
                    <p className="mt-1 text-xs text-red-400">{slugError}</p>
                  )}
                </div>

                {/* QR URL preview + copy */}
                {qrBaseUrl && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Share this link with tables</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate text-xs text-amber-300">
                        {qrBaseUrl}/<span className="text-white/40">{'{tableId}'}</span>
                      </code>
                      <button
                        onClick={() => { void handleCopyUrl(); }}
                        className="flex-none flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <a
                        href={`${qrBaseUrl}/1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none flex items-center gap-1 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Preview
                      </a>
                    </div>
                  </div>
                )}

                {/* Theme palette */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-white/70">Menu Theme</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QR_PALETTES.map(({ key, label, bg, accent }) => (
                      <button
                        key={key}
                        onClick={() => setQrPalette(key)}
                        className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                          qrPalette === key
                            ? 'border-amber-500/60 shadow-lg shadow-amber-500/10'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                        style={{ background: bg }}
                      >
                        <div className="mb-1.5 flex gap-1">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                          <div className="h-1.5 w-4 rounded-full opacity-30" style={{ background: accent }} />
                        </div>
                        <p className="text-[10px] font-medium" style={{ color: accent }}>{label}</p>
                        {qrPalette === key && (
                          <div className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-amber-400 flex items-center justify-center">
                            <Check className="h-2 w-2 text-slate-900" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Promotional banner */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white/70">
                    Promotional Banner
                    <span className="ms-1.5 text-white/30 font-normal">(shown between categories)</span>
                  </label>
                  <input
                    type="text"
                    value={qrBanner}
                    onChange={(e) => setQrBanner(e.target.value)}
                    placeholder="e.g. Try our freshly made desserts today 🍮"
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-amber-500/50 focus:outline-none"
                    maxLength={120}
                  />
                  <p className="mt-1 text-right text-[10px] text-white/25">{qrBanner.length}/120</p>
                </div>
              </section>

              {/* Save */}
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 py-4 text-base font-bold text-slate-900 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                <Save className="h-5 w-5" />
                {saving
                  ? t('common.saving', 'Saving...')
                  : t('restaurant.settings.save', 'Save Settings')}
              </button>
            </div>
          </RoleGate>
        </div>
      </div>
    </Layout>
  );
}
