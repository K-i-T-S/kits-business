import {
  BarChart3,
  Calendar,
  Clock,
  Edit,
  Eye,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface CampaignContentTemplate {
  subject?: string;
  body?: string;
}

interface CampaignScheduleConfig {
  sendImmediately: boolean;
  scheduledAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'social_media' | 'loyalty' | 'promotion';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  targetSegmentId?: string;
  targetSegmentName?: string;
  contentTemplate: CampaignContentTemplate;
  scheduleConfig: CampaignScheduleConfig;
  budget: number;
  actualCost: number;
  startDate?: string;
  endDate?: string;
  metrics: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    converted?: number;
    revenue?: number;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface MarketingCampaignsProps {
  campaigns: Campaign[];
  segments: Array<{ id: string; name: string; customerCount: number }>;
  onCreateCampaign?: (campaign: Omit<Campaign, 'id' | 'createdAt'>) => void;
  onUpdateCampaign?: (id: string, campaign: Partial<Campaign>) => void;
  onDeleteCampaign?: (id: string) => void;
  onLaunchCampaign?: (id: string) => void;
  onPauseCampaign?: (id: string) => void;
  onResumeCampaign?: (id: string) => void;
}

export default function MarketingCampaigns({
  campaigns,
  segments,
  onCreateCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onLaunchCampaign,
  onPauseCampaign,
  onResumeCampaign,
}: MarketingCampaignsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    type: 'email' as Campaign['type'],
    targetSegmentId: '',
    contentTemplate: { subject: '', body: '' } as CampaignContentTemplate,
    scheduleConfig: { sendImmediately: true as boolean, scheduledAt: '' } as CampaignScheduleConfig,
    budget: 0,
  });

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const matchesSearch =
          campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          campaign.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
        const matchesType = typeFilter === 'all' || campaign.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [campaigns, searchQuery, statusFilter, typeFilter],
  );

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'draft': return 'bg-white/10 text-white/60 border-white/20';
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  const getTypeIcon = (type: Campaign['type']) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'social_media': return <Users className="h-4 w-4" />;
      case 'loyalty': return <TrendingUp className="h-4 w-4" />;
      case 'promotion': return <BarChart3 className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const calculatePerformance = (metrics: Campaign['metrics']) => {
    if (!metrics.sent || metrics.sent === 0) return { openRate: 0, clickRate: 0, conversionRate: 0 };
    const openRate = ((metrics.opened || 0) / metrics.sent) * 100;
    const clickRate = ((metrics.clicked || 0) / (metrics.opened || 1)) * 100;
    const conversionRate = ((metrics.converted || 0) / (metrics.clicked || 1)) * 100;
    return { openRate, clickRate, conversionRate };
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (onCreateCampaign) {
      onCreateCampaign({
        ...newCampaign,
        status: 'draft',
        actualCost: 0,
        startDate: newCampaign.scheduleConfig.sendImmediately
          ? new Date().toISOString()
          : newCampaign.scheduleConfig.scheduledAt,
        metrics: {},
      });
      setNewCampaign({
        name: '',
        description: '',
        type: 'email',
        targetSegmentId: '',
        contentTemplate: { subject: '', body: '' },
        scheduleConfig: { sendImmediately: true, scheduledAt: '' },
        budget: 0,
      });
      setShowCreateModal(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const formatCurrency = (value: number | undefined | null) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics.sent || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.metrics.converted || 0), 0);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">Campaigns</p>
          <h2 className="mt-1 text-xl font-bold text-white">Marketing Campaigns</h2>
          <p className="text-sm text-white/60">Create and manage automated marketing campaigns</p>
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
          { label: 'Active Campaigns', value: activeCampaigns, icon: Play, accent: 'text-green-400' },
          { label: 'Total Budget', value: formatCurrency(totalBudget), icon: BarChart3, accent: 'text-blue-400' },
          { label: 'Total Sent', value: totalSent.toLocaleString(), icon: Send, accent: 'text-purple-400' },
          { label: 'Conversions', value: totalConversions.toLocaleString(), icon: TrendingUp, accent: 'text-emerald-400' },
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
          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/70 focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/70 focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="social_media">Social Media</option>
          <option value="loyalty">Loyalty</option>
          <option value="promotion">Promotion</option>
        </select>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <Mail className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-3 text-sm font-semibold text-white">No campaigns found</h3>
            <p className="mt-1 text-sm text-white/50">
              {campaigns.length === 0
                ? 'Marketing campaigns will be available in a future update.'
                : 'No campaigns match your current filters.'}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const performance = calculatePerformance(campaign.metrics);
            const isSelected = selectedCampaign === campaign.id;

            return (
              <div key={campaign.id} className="rounded-2xl border border-white/15 bg-white/5">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                        {getTypeIcon(campaign.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{campaign.name}</h4>
                        <p className="text-sm text-white/60">{campaign.description}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                            {campaign.status}
                          </span>
                          {campaign.targetSegmentName && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
                              <Users className="h-3 w-3" />
                              {campaign.targetSegmentName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {campaign.status === 'draft' && onLaunchCampaign && (
                        <button
                          onClick={() => onLaunchCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Play className="h-3 w-3" />
                          Launch
                        </button>
                      )}
                      {campaign.status === 'active' && onPauseCampaign && (
                        <button
                          onClick={() => onPauseCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
                        >
                          <Pause className="h-3 w-3" />
                          Pause
                        </button>
                      )}
                      {campaign.status === 'paused' && onResumeCampaign && (
                        <button
                          onClick={() => onResumeCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Play className="h-3 w-3" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedCampaign(isSelected ? null : campaign.id)}
                        className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {onUpdateCampaign && (
                        <button
                          onClick={() => toast.info('Campaign editor coming soon')}
                          className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {onDeleteCampaign && (
                        <button
                          onClick={() => {
                            if (confirm('Delete this campaign?')) {
                              onDeleteCampaign(campaign.id);
                            }
                          }}
                          className="rounded-xl p-2 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                    {[
                      { label: 'Sent', value: campaign.metrics.sent || 0 },
                      { label: 'Open Rate', value: `${performance.openRate.toFixed(1)}%` },
                      { label: 'Click Rate', value: `${performance.clickRate.toFixed(1)}%` },
                      { label: 'Conversions', value: campaign.metrics.converted || 0 },
                      { label: 'Revenue', value: formatCurrency(campaign.metrics.revenue || 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="text-xs text-white/50">{label}</p>
                        <p className="text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  {campaign.startDate && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Started: {formatDate(campaign.startDate)}
                      </span>
                      {campaign.endDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ends: {formatDate(campaign.endDate)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Budget: {formatCurrency(campaign.budget)}
                      </span>
                    </div>
                  )}
                </div>

                {isSelected && (
                  <div className="border-t border-white/10 p-5">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h5 className="mb-3 font-medium text-white">Campaign Details</h5>
                        <div className="space-y-2">
                          {[
                            { label: 'Type', value: campaign.type },
                            { label: 'Status', value: campaign.status },
                            { label: 'Budget', value: formatCurrency(campaign.budget) },
                            { label: 'Spent', value: formatCurrency(campaign.actualCost) },
                            ...(campaign.createdBy ? [{ label: 'Created by', value: campaign.createdBy.name }] : []),
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between">
                              <span className="text-sm text-white/50">{label}:</span>
                              <span className="text-sm font-medium capitalize text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="mb-3 font-medium text-white">Performance Metrics</h5>
                        <div className="space-y-2">
                          {[
                            { label: 'Delivered', value: campaign.metrics.delivered || 0 },
                            { label: 'Opened', value: campaign.metrics.opened || 0 },
                            { label: 'Clicked', value: campaign.metrics.clicked || 0 },
                            { label: 'Converted', value: campaign.metrics.converted || 0 },
                            { label: 'Revenue', value: formatCurrency(campaign.metrics.revenue || 0) },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between">
                              <span className="text-sm text-white/50">{label}:</span>
                              <span className="text-sm font-medium text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-white">Create Marketing Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g., Summer Sale Promotion"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Campaign Type</label>
                  <select
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value as Campaign['type'] })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="social_media">Social Media</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="promotion">Promotion</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Description</label>
                <textarea
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Describe your campaign objectives and target audience"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Target Segment</label>
                  <select
                    value={newCampaign.targetSegmentId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, targetSegmentId: e.target.value })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select a segment</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} ({segment.customerCount} customers)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/70">Budget (USD)</label>
                  <input
                    type="number"
                    value={newCampaign.budget}
                    onChange={(e) => setNewCampaign({ ...newCampaign, budget: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Email Subject</label>
                <input
                  type="text"
                  value={newCampaign.contentTemplate.subject ?? ''}
                  onChange={(e) =>
                    setNewCampaign({
                      ...newCampaign,
                      contentTemplate: { ...newCampaign.contentTemplate, subject: e.target.value },
                    })
                  }
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Campaign subject line"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Email Body</label>
                <textarea
                  value={newCampaign.contentTemplate.body ?? ''}
                  onChange={(e) =>
                    setNewCampaign({
                      ...newCampaign,
                      contentTemplate: { ...newCampaign.contentTemplate, body: e.target.value },
                    })
                  }
                  rows={4}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Campaign content"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">Schedule</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      name="schedule"
                      checked={newCampaign.scheduleConfig.sendImmediately}
                      onChange={() =>
                        setNewCampaign({
                          ...newCampaign,
                          scheduleConfig: { ...newCampaign.scheduleConfig, sendImmediately: true },
                        })
                      }
                      className="accent-indigo-500"
                    />
                    Send immediately
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      name="schedule"
                      checked={!newCampaign.scheduleConfig.sendImmediately}
                      onChange={() =>
                        setNewCampaign({
                          ...newCampaign,
                          scheduleConfig: { ...newCampaign.scheduleConfig, sendImmediately: false },
                        })
                      }
                      className="accent-indigo-500"
                    />
                    Schedule for later
                  </label>
                </div>
                {!newCampaign.scheduleConfig.sendImmediately && (
                  <input
                    type="datetime-local"
                    value={newCampaign.scheduleConfig.scheduledAt}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        scheduleConfig: { ...newCampaign.scheduleConfig, scheduledAt: e.target.value },
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
