import {
  Key,
  Zap,
  Sparkles,
  Plus,
  Copy,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Eye,
  Send,
  AlertCircle,
  Clock,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import FeatureGate from '../FeatureGate';
import Layout from '../Layout';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/utils/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface WebhookDeliverySummary {
  id: string;
  success: boolean | null;
  delivered_at: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  failure_count: number;
  last_fired_at: string | null;
  last_status: string | null;
  created_at: string;
  webhook_deliveries: WebhookDeliverySummary[];
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  success: boolean | null;
  duration_ms: number | null;
  delivered_at: string;
}

type Permission = 'read' | 'write' | 'delete';

const ALL_PERMISSIONS: Permission[] = ['read', 'write', 'delete'];

const PERMISSION_LABELS: Record<Permission, string> = {
  read: 'Read',
  write: 'Write',
  delete: 'Delete',
};

const PERMISSION_COLORS: Record<Permission, string> = {
  read: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  write: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  delete: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const getPermissionColor = (perm: string): string => {
  if (perm === 'read') return PERMISSION_COLORS.read;
  if (perm === 'write') return PERMISSION_COLORS.write;
  if (perm === 'delete') return PERMISSION_COLORS.delete;
  return 'bg-white/10 text-white/60 border-white/20';
};

const getPermissionLabel = (perm: string): string => {
  if (perm === 'read') return PERMISSION_LABELS.read;
  if (perm === 'write') return PERMISSION_LABELS.write;
  if (perm === 'delete') return PERMISSION_LABELS.delete;
  return perm;
};

const AVAILABLE_EVENTS = [
  'sale.created',
  'sale.refunded',
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.created',
  'inventory.low_stock',
] as const;

type WebhookEvent = (typeof AVAILABLE_EVENTS)[number];

// ─── Crypto Helpers ───────────────────────────────────────────────────────────

const generateApiKey = (): string => {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return 'kits_' + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

const hashKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
};

const generateSecret = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

// ─── Shared Modal Wrapper ─────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<Set<Permission>>(new Set(['read']));
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKeys((data as ApiKey[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load API keys';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleTogglePermission = (perm: Permission) => {
    setNewKeyPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        if (next.size === 1) return prev; // At least one permission required
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error('Key name is required');
      return;
    }
    setCreating(true);
    try {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 12);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      const { error } = await supabase.from('api_keys').insert({
        name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: Array.from(newKeyPermissions),
        is_active: true,
        created_by: userId,
      });
      if (error) throw error;

      setRevealedKey(rawKey);
      setShowNewKeyModal(false);
      setNewKeyName('');
      setNewKeyPermissions(new Set(['read']));
      await loadKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create API key';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    try {
      const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('id', key.id);
      if (error) throw error;
      toast.success(`"${key.name}" revoked`);
      await loadKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke key';
      toast.error(message);
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !key.is_active })
        .eq('id', key.id);
      if (error) throw error;
      toast.success(key.is_active ? 'Key disabled' : 'Key enabled');
      await loadKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update key';
      toast.error(message);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/40">
          {keys.length} key{keys.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowNewKeyModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Generate New Key
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Key className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/50">No API keys yet. Generate your first key above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`rounded-2xl border p-4 transition-colors ${
                key.is_active
                  ? 'border-white/10 bg-white/5'
                  : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{key.name}</p>
                    {!key.is_active && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-white/40">
                    {key.key_prefix}••••••••••••••••••••
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {key.permissions.map((perm) => (
                      <span
                        key={perm}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getPermissionColor(perm)}`}
                      >
                        {getPermissionLabel(perm)}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/40">
                    {key.last_used_at ? (
                      <span>
                        Last used{' '}
                        {new Date(key.last_used_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span>Never used</span>
                    )}
                    {key.expires_at && (
                      <span>
                        Expires{' '}
                        {new Date(key.expires_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    <span>
                      Created{' '}
                      {new Date(key.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => { void handleToggleActive(key); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    title={key.is_active ? 'Disable key' : 'Enable key'}
                  >
                    {key.is_active ? (
                      <ToggleRight className="h-4 w-4 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => { void handleRevoke(key); }}
                    disabled={!key.is_active}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    title="Revoke key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Key Modal */}
      {showNewKeyModal && (
        <Modal title="Generate New API Key" onClose={() => setShowNewKeyModal(false)}>
          <form onSubmit={(e) => { void handleCreateKey(e); }} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Key Name *</label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production Integration, Accounting Sync…"
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/60">Permissions</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => handleTogglePermission(perm)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                      newKeyPermissions.has(perm)
                        ? getPermissionColor(perm)
                        : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {getPermissionLabel(perm)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-white/40">
                At least one permission is required.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={creating || !newKeyName.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Generate Key
              </button>
              <button
                type="button"
                onClick={() => setShowNewKeyModal(false)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Revealed Key Modal — shown once after generation */}
      {revealedKey && (
        <Modal
          title="Your New API Key"
          onClose={() => {
            setRevealedKey(null);
            setCopied(false);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300">
                This key will <strong>never be shown again</strong>. Copy it now and store it
                securely.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2">
              <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-green-400">
                {revealedKey}
              </code>
              <button
                onClick={() => { void handleCopy(revealedKey); }}
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <button
              onClick={() => {
                setRevealedKey(null);
                setCopied(false);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white"
            >
              Done — I've saved the key
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState(generateSecret());
  const [newEvents, setNewEvents] = useState<Set<WebhookEvent>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*, webhook_deliveries(id, success, delivered_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWebhooks((data as Webhook[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load webhooks';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const handleToggleEvent = (event: WebhookEvent) => {
    setNewEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Webhook name is required');
      return;
    }
    if (!newUrl.trim() || !newUrl.startsWith('https://')) {
      toast.error('A valid HTTPS URL is required');
      return;
    }
    if (newEvents.size === 0) {
      toast.error('Select at least one event');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('webhooks').insert({
        name: newName.trim(),
        url: newUrl.trim(),
        secret: newSecret,
        events: Array.from(newEvents),
        is_active: true,
        failure_count: 0,
      });
      if (error) throw error;
      toast.success('Webhook registered');
      setShowAddModal(false);
      setNewName('');
      setNewUrl('');
      setNewSecret(generateSecret());
      setNewEvents(new Set());
      await loadWebhooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add webhook';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (wh: Webhook) => {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active: !wh.is_active })
        .eq('id', wh.id);
      if (error) throw error;
      toast.success(wh.is_active ? 'Webhook disabled' : 'Webhook enabled');
      await loadWebhooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update webhook';
      toast.error(message);
    }
  };

  const handleDelete = async (wh: Webhook) => {
    try {
      const { error } = await supabase.from('webhooks').delete().eq('id', wh.id);
      if (error) throw error;
      toast.success(`"${wh.name}" deleted`);
      await loadWebhooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete webhook';
      toast.error(message);
    }
  };

  const handleTest = async (wh: Webhook) => {
    try {
      await supabase.functions.invoke('test-webhook', { body: { webhookId: wh.id } });
      toast.success('Test queued — delivery will appear in the log shortly');
    } catch {
      toast.info('Test queued (function not yet deployed)');
    }
  };

  const handleViewDeliveries = async (wh: Webhook) => {
    setDeliveryModal(wh);
    setLoadingDeliveries(true);
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', wh.id)
        .order('delivered_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setDeliveries((data as WebhookDelivery[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load deliveries';
      toast.error(message);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/40">
          {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/50">No webhooks yet. Register your first endpoint above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const recentDeliveries = wh.webhook_deliveries ?? [];
            const successCount = recentDeliveries.filter((d) => d.success).length;
            const failCount = recentDeliveries.filter((d) => d.success === false).length;

            return (
              <div
                key={wh.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  wh.is_active
                    ? 'border-white/10 bg-white/5'
                    : 'border-white/5 bg-white/[0.02] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{wh.name}</p>
                      {wh.failure_count > 2 && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
                          {wh.failure_count} failures
                        </span>
                      )}
                      {!wh.is_active && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                          Disabled
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-0.5 max-w-xs truncate text-xs text-white/40"
                      title={wh.url}
                    >
                      {wh.url}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/40">
                      {recentDeliveries.length > 0 && (
                        <span>
                          <span className="text-green-400">{successCount} ok</span>
                          {failCount > 0 && (
                            <span className="ml-1 text-red-400">{failCount} failed</span>
                          )}
                          {' '}(last {recentDeliveries.length})
                        </span>
                      )}
                      {wh.last_fired_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(wh.last_fired_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      onClick={() => { void handleTest(wh); }}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      title="Send test event"
                    >
                      <Send className="h-3 w-3" />
                      Test
                    </button>
                    <button
                      onClick={() => { void handleViewDeliveries(wh); }}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      title="View delivery log"
                    >
                      <Eye className="h-3 w-3" />
                      Log
                    </button>
                    <button
                      onClick={() => { void handleToggleActive(wh); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                      title={wh.is_active ? 'Disable' : 'Enable'}
                    >
                      {wh.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => { void handleDelete(wh); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete webhook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Webhook Modal */}
      {showAddModal && (
        <Modal title="Add Webhook" onClose={() => setShowAddModal(false)}>
          <form onSubmit={(e) => { void handleAddWebhook(e); }} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sales Notifications, ERP Sync…"
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Endpoint URL * (HTTPS)
              </label>
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhooks/kits"
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                type="url"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Signing Secret (HMAC-SHA256)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-800 px-3 py-2 font-mono text-xs text-green-400">
                  {newSecret}
                </code>
                <button
                  type="button"
                  onClick={() => setNewSecret(generateSecret())}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10 transition-colors"
                >
                  Regenerate
                </button>
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Use this to verify webhook signatures on your server.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/60">
                Events * (select at least one)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => handleToggleEvent(ev)}
                    className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${
                      newEvents.has(ev)
                        ? 'border-indigo-500/40 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !newName.trim() || !newUrl.trim() || newEvents.size === 0}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Register Webhook
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delivery Log Modal */}
      {deliveryModal && (
        <Modal
          title={`Delivery Log — ${deliveryModal.name}`}
          onClose={() => {
            setDeliveryModal(null);
            setDeliveries([]);
          }}
        >
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loadingDeliveries ? (
              <div className="flex h-20 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-500" />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-white/40">No deliveries recorded yet.</p>
              </div>
            ) : (
              deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="mt-0.5 shrink-0">
                    {d.success ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-indigo-300">{d.event}</span>
                      {d.status_code !== null && (
                        <span
                          className={`text-xs font-medium ${
                            d.success ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          HTTP {d.status_code}
                        </span>
                      )}
                      {d.duration_ms !== null && (
                        <span className="text-xs text-white/30">{d.duration_ms}ms</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {new Date(d.delivered_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function ApiAndWebhooks() {
  return (
    <Layout>
      <div className="space-y-8 pb-20 lg:pb-0">
        {/* Hero */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Enterprise</p>
            <h1 className="mt-3 text-3xl font-semibold">API &amp; Webhooks</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Connect your business systems with external services via a secure REST API and
              real-time webhook notifications.
            </p>
          </div>
        </section>

        {/* Feature-gated content */}
        <FeatureGate feature="api_webhooks">
          <Tabs defaultValue="api-keys" className="space-y-6">
            <TabsList className="inline-flex w-full rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
              <TabsTrigger
                value="api-keys"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition-colors data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                API Keys
              </TabsTrigger>
              <TabsTrigger
                value="webhooks"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition-colors data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Webhooks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api-keys" className="mt-0">
              <ApiKeysTab />
            </TabsContent>

            <TabsContent value="webhooks" className="mt-0">
              <WebhooksTab />
            </TabsContent>
          </Tabs>
        </FeatureGate>
      </div>
    </Layout>
  );
}
