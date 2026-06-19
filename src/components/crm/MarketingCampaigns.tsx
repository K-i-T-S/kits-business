import {
  BarChart3,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabaseClient';

// ── DB row type ───────────────────────────────────────────────────────────────

interface DbCampaign {
  id: string;
  name: string;
  type: 'email' | 'whatsapp';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  subject: string | null;
  body: string;
  target_segment: 'all' | 'new' | 'vip' | 'inactive';
  scheduled_at: string | null;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
  updated_at: string;
}

// ── Form state ────────────────────────────────────────────────────────────────

interface CampaignForm {
  name: string;
  type: 'email' | 'whatsapp';
  subject: string;
  body: string;
  target_segment: 'all' | 'new' | 'vip' | 'inactive';
  send_immediately: boolean;
  scheduled_at: string;
}

const DEFAULT_FORM: CampaignForm = {
  name: '',
  type: 'email',
  subject: '',
  body: '',
  target_segment: 'all',
  send_immediately: true,
  scheduled_at: '',
};

// ── Schedule modal state ──────────────────────────────────────────────────────

interface ScheduleModal {
  campaignId: string;
  scheduledAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusColor(status: DbCampaign['status']): string {
  switch (status) {
    case 'draft': return 'bg-white/10 text-white/60 border-white/20';
    case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'sending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'sent': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

function getTypeIcon(type: DbCampaign['type']): JSX.Element {
  switch (type) {
    case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
    default: return <Mail className="h-4 w-4" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketingCampaigns() {
  const [campaigns, setCampaigns] = useState<DbCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CampaignForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<ScheduleModal | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  async function fetchCampaigns() {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data ?? []) as DbCampaign[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load campaigns';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchCampaigns();
  }, []);

  // ── Create campaign ─────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.body.trim()) {
      toast.error('Name and body are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        type: formData.type,
        subject: formData.subject.trim() || null,
        body: formData.body.trim(),
        target_segment: formData.target_segment,
        status: 'draft',
      };

      if (!formData.send_immediately && formData.scheduled_at) {
        payload.scheduled_at = new Date(formData.scheduled_at).toISOString();
        payload.status = 'scheduled';
      }

      const { error } = await supabase.from('campaigns').insert(payload);
      if (error) throw error;

      toast.success('Campaign created');
      setFormData(DEFAULT_FORM);
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete campaign ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
      toast.success('Campaign deleted');
      await fetchCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete campaign';
      toast.error(message);
    }
  }

  // ── Send now ────────────────────────────────────────────────────────────────

  async function handleSendNow(id: string) {
    try {
      const { error: updateErr } = await supabase
        .from('campaigns')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateErr) throw updateErr;

      // Invoke Edge Function — may not exist yet; handle gracefully
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { error: fnErr } = await supabase.functions.invoke('send-campaign', {
        body: { campaign_id: id },
      });
      if (fnErr) {
        const fnMsg = fnErr instanceof Error ? fnErr.message : String(fnErr);
        toast.error(`Send function unavailable: ${fnMsg}`);
      } else {
        toast.success('Campaign queued for sending');
      }

      await fetchCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send campaign';
      toast.error(message);
    }
  }

  // ── Schedule ────────────────────────────────────────────────────────────────

  async function handleSchedule() {
    if (!scheduleModal || !scheduleModal.scheduledAt) {
      toast.error('Please select a date and time');
      return;
    }
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          scheduled_at: new Date(scheduleModal.scheduledAt).toISOString(),
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleModal.campaignId);
      if (error) throw error;

      toast.success('Campaign scheduled');
      setScheduleModal(null);
      await fetchCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule campaign';
      toast.error(message);
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length;
  const sentCount = campaigns.filter(c => c.status === 'sent').length;

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesType = typeFilter === 'all' || c.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [campaigns, searchQuery, statusFilter, typeFilter],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">Campaigns</p>
          <h2 className="mt-1 text-xl font-bold text-white">Marketing Campaigns</h2>
          <p className="text-sm text-white/60">Create and manage email and WhatsApp campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Campaigns', value: campaigns.length, icon: BarChart3, accent: 'text-indigo-400' },
          { label: 'Active / Scheduled', value: activeCampaigns, icon: Play, accent: 'text-green-400' },
          { label: 'Total Messages Sent', value: totalSent.toLocaleString(), icon: Send, accent: 'text-purple-400' },
          { label: 'Completed Campaigns', value: sentCount, icon: TrendingUp, accent: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
              <Icon className={`h-7 w-7 ${accent}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-2xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
            <p className="text-sm text-white/50">Loading campaigns…</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <Mail className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-3 text-sm font-semibold text-white">No campaigns found</h3>
            <p className="mt-1 text-sm text-white/50">
              {campaigns.length === 0
                ? 'Create your first campaign to start reaching customers.'
                : 'No campaigns match your current filters.'}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-white/15 bg-white/5">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                      {getTypeIcon(campaign.type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-white truncate">{campaign.name}</h4>
                      {campaign.subject && (
                        <p className="text-sm text-white/60 truncate">{campaign.subject}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
                          <Users className="h-3 w-3" />
                          {campaign.target_segment}
                        </span>
                        <span className="text-xs text-white/40 capitalize">{campaign.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="ml-3 flex shrink-0 items-center gap-1">
                    {campaign.status === 'draft' && (
                      <>
                        <button
                          onClick={() => void handleSendNow(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                          title="Send now"
                        >
                          <Send className="h-3 w-3" />
                          Send Now
                        </button>
                        <button
                          onClick={() => setScheduleModal({ campaignId: campaign.id, scheduledAt: '' })}
                          className="inline-flex items-center gap-1 rounded-xl bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                          title="Schedule"
                        >
                          <Calendar className="h-3 w-3" />
                          Schedule
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => void handleDelete(campaign.id)}
                      className="rounded-xl p-2 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: 'Sent', value: campaign.sent_count.toLocaleString() },
                    { label: 'Segment', value: campaign.target_segment },
                    {
                      label: 'Scheduled',
                      value: campaign.scheduled_at ? formatDate(campaign.scheduled_at) : '—',
                    },
                    {
                      label: 'Created',
                      value: formatDate(campaign.created_at),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-xs text-white/50">{label}</p>
                      <p className="text-sm font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {campaign.sent_at && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-white/40">
                    <Clock className="h-3 w-3" />
                    Sent: {formatDate(campaign.sent_at)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Campaign Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-white">Create Marketing Campaign</h3>
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Campaign Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g., Summer Sale Promotion"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'email' | 'whatsapp' })}
                    className="w-full rounded-2xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Target Segment</label>
                <select
                  value={formData.target_segment}
                  onChange={(e) => setFormData({ ...formData, target_segment: e.target.value as CampaignForm['target_segment'] })}
                  className="w-full rounded-2xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Customers</option>
                  <option value="new">New Customers (last 30 days)</option>
                  <option value="vip">VIP Customers</option>
                  <option value="inactive">Inactive (no purchase 60+ days)</option>
                </select>
              </div>

              {formData.type === 'email' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Subject Line</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                    placeholder="Your email subject line"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Message Body *</label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={5}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Write your campaign message here…"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">Schedule</label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      name="schedule"
                      checked={formData.send_immediately}
                      onChange={() => setFormData({ ...formData, send_immediately: true })}
                      className="accent-indigo-500"
                    />
                    Save as draft
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      name="schedule"
                      checked={!formData.send_immediately}
                      onChange={() => setFormData({ ...formData, send_immediately: false })}
                      className="accent-indigo-500"
                    />
                    Schedule for later
                  </label>
                </div>
                {!formData.send_immediately && (
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setFormData(DEFAULT_FORM); }}
                  className="flex-1 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ────────────────────────────────────────────────────── */}
      {scheduleModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-white">Schedule Campaign</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Send at</label>
                <input
                  type="datetime-local"
                  value={scheduleModal.scheduledAt}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, scheduledAt: e.target.value })}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setScheduleModal(null)}
                  className="flex-1 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSchedule()}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
