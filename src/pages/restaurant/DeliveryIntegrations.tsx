import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import FeatureGate from '@/components/FeatureGate';
import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryIntegration {
  id: string;
  tenant_id: string;
  platform_name: 'talabat' | 'toters' | 'zomato';
  api_key: string | null;
  webhook_secret: string | null;
  menu_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string | null;
}

type PlatformName = DeliveryIntegration['platform_name'];

interface PlatformConfig {
  id: PlatformName;
  label: string;
  description: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
}

// ── Platform metadata ─────────────────────────────────────────────────────────

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'talabat',
    label: 'Talabat',
    description: 'The leading food delivery platform in the Middle East — highest order volume in Lebanon.',
    badgeText: 'T',
    badgeColor: 'text-white',
    badgeBg: 'bg-orange-600',
  },
  {
    id: 'toters',
    label: 'Toters',
    description: 'Lebanon-based delivery app covering Beirut and major Lebanese cities.',
    badgeText: 'TO',
    badgeColor: 'text-white',
    badgeBg: 'bg-green-600',
  },
  {
    id: 'zomato',
    label: 'Zomato',
    description: 'Global restaurant discovery and delivery platform with growing MENA presence.',
    badgeText: 'Z',
    badgeColor: 'text-white',
    badgeBg: 'bg-red-600',
  },
];

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Platform Card ─────────────────────────────────────────────────────────────

interface PlatformCardProps {
  platform: PlatformConfig;
  integration: DeliveryIntegration | null;
  tenantId: string;
  onSaved: () => void;
}

function PlatformCard({ platform, integration, tenantId, onSaved }: PlatformCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const [apiKey, setApiKey] = useState(integration?.api_key ?? '');
  const [webhookSecret, setWebhookSecret] = useState(integration?.webhook_secret ?? '');
  const [menuUrl, setMenuUrl] = useState(integration?.menu_url ?? '');
  const [isActive, setIsActive] = useState(integration?.is_active ?? false);

  // Keep form in sync if parent reloads
  useEffect(() => {
    setApiKey(integration?.api_key ?? '');
    setWebhookSecret(integration?.webhook_secret ?? '');
    setMenuUrl(integration?.menu_url ?? '');
    setIsActive(integration?.is_active ?? false);
  }, [integration]);

  const webhookUrl = `https://pytndxjeznhhyycjasep.supabase.co/functions/v1/delivery-webhook?platform=${platform.id}&tenant=${tenantId}`;

  const handleToggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    try {
      const { error } = await supabase
        .from('restaurant_delivery_integrations')
        .upsert(
          {
            tenant_id: tenantId,
            platform_name: platform.id,
            api_key: apiKey || null,
            webhook_secret: webhookSecret || null,
            menu_url: menuUrl || null,
            is_active: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,platform_name' },
        );
      if (error) throw error;
      toast.success(`${platform.label} ${next ? 'enabled' : 'disabled'}`);
      onSaved();
    } catch (err) {
      setIsActive(!next); // revert
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_delivery_integrations')
        .upsert(
          {
            tenant_id: tenantId,
            platform_name: platform.id,
            api_key: apiKey || null,
            webhook_secret: webhookSecret || null,
            menu_url: menuUrl || null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,platform_name' },
        );
      if (error) throw error;
      toast.success(`${platform.label} settings saved`);
      onSaved();
      setExpanded(false);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const isConfigured = Boolean(integration?.api_key);
  const lastSync = integration?.last_sync_at ?? null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-4 p-5">
        {/* Platform badge */}
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${platform.badgeBg} ${platform.badgeColor}`}
        >
          {platform.badgeText}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white">{platform.label}</h3>
            {isConfigured ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                {isActive ? `Connected · Last sync ${relativeTime(lastSync)}` : 'Configured · Inactive'}
              </span>
            ) : (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/5 text-white/40 border border-white/10">
                Not configured
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-white/50 line-clamp-1">{platform.description}</p>
        </div>

        {/* Active toggle */}
        <button
          role="switch"
          aria-checked={isActive}
          aria-label={`${isActive ? 'Disable' : 'Enable'} ${platform.label}`}
          onClick={() => { void handleToggleActive(); }}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white/10 border-white/20'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
              isActive ? 'translate-x-5' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${platform.label} settings`}
          className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-all"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-white/10 p-5 space-y-4">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/60" htmlFor={`api-key-${platform.id}`}>
              API Key
            </label>
            <input
              id={`api-key-${platform.id}`}
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Paste your ${platform.label} API key`}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/60" htmlFor={`webhook-secret-${platform.id}`}>
              Webhook Secret
            </label>
            <div className="relative">
              <input
                id={`webhook-secret-${platform.id}`}
                type={showSecret ? 'text' : 'password'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Webhook signing secret"
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 pe-10 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                className="absolute inset-y-0 end-0 flex items-center pe-3 text-white/40 hover:text-white/70 transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Menu URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/60" htmlFor={`menu-url-${platform.id}`}>
              Menu URL <span className="text-white/30">(optional)</span>
            </label>
            <input
              id={`menu-url-${platform.id}`}
              type="url"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>

          {/* Webhook URL (read-only) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/60">
              Your Webhook URL{' '}
              <span className="text-white/30">— paste this into {platform.label}&apos;s dashboard</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-mono text-white/60 focus:outline-none"
              />
              <button
                onClick={() => { void handleCopyWebhook(); }}
                aria-label="Copy webhook URL"
                className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeliveryIntegrations() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [integrations, setIntegrations] = useState<DeliveryIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIntegrations = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_delivery_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('platform_name');
      if (error) throw error;
      setIntegrations((data as DeliveryIntegration[]) ?? []);
    } catch (err) {
      toast.error(`Failed to load integrations: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const getIntegration = (platform: PlatformName): DeliveryIntegration | null =>
    integrations.find((i) => i.platform_name === platform) ?? null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-sky-500/20">
            <Truck className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Delivery Integrations</h1>
            <p className="mt-0.5 text-sm text-white/50">
              Connect Talabat, Toters &amp; Zomato to receive orders automatically
            </p>
          </div>
        </div>

        {/* Feature gate — Business plan required */}
        <FeatureGate feature="enterprise_dashboard">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-white/40" />
            </div>
          ) : (
            <>
              {/* How it works banner */}
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm text-white/60">
                <p className="font-medium text-white/80 mb-1">How it works</p>
                <p>
                  Enable a platform, enter its API credentials, then paste your unique Webhook URL into
                  the platform&apos;s dashboard. Incoming orders will automatically appear as open table orders
                  in your Kitchen Display and Waiter Interface.
                </p>
              </div>

              {/* Platform cards */}
              <div className="space-y-4">
                {tenantId &&
                  PLATFORMS.map((platform) => (
                    <PlatformCard
                      key={platform.id}
                      platform={platform}
                      integration={getIntegration(platform.id)}
                      tenantId={tenantId}
                      onSaved={() => { void loadIntegrations(); }}
                    />
                  ))}
              </div>
            </>
          )}
        </FeatureGate>
      </div>
    </Layout>
  );
}
