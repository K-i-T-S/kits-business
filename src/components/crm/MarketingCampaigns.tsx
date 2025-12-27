import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
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

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'social_media' | 'loyalty' | 'promotion';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  targetSegmentId?: string;
  targetSegmentName?: string;
  contentTemplate: Record<string, any>;
  scheduleConfig: Record<string, any>;
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
    contentTemplate: {
      subject: '',
      body: '',
    },
    scheduleConfig: {
      sendImmediately: true,
      scheduledAt: '',
    },
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
    [campaigns, searchQuery, statusFilter, typeFilter]
  );

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeIcon = (type: Campaign['type']) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'social_media':
        return <Users className="h-4 w-4" />;
      case 'loyalty':
        return <TrendingUp className="h-4 w-4" />;
      case 'promotion':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
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
        startDate: newCampaign.scheduleConfig.sendImmediately ? new Date().toISOString() : newCampaign.scheduleConfig.scheduledAt,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.actualCost, 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics.sent || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.metrics.converted || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Marketing Campaigns</h3>
          <p className="text-sm text-gray-600">Create and manage automated marketing campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Campaigns</p>
              <p className="text-2xl font-semibold text-gray-900">{activeCampaigns}</p>
            </div>
            <Play className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalBudget)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sent</p>
              <p className="text-2xl font-semibold text-gray-900">{totalSent.toLocaleString()}</p>
            </div>
            <Send className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conversions</p>
              <p className="text-2xl font-semibold text-gray-900">{totalConversions.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No campaigns found</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first marketing campaign to get started</p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const performance = calculatePerformance(campaign.metrics);
            const isSelected = selectedCampaign === campaign.id;
            
            return (
              <div key={campaign.id} className="rounded-lg border border-gray-200 bg-white">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                        {getTypeIcon(campaign.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                        <p className="text-sm text-gray-600">{campaign.description}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                              campaign.status
                            )}`}
                          >
                            {campaign.status}
                          </span>
                          {campaign.targetSegmentName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              <Users className="h-3 w-3" />
                              {campaign.targetSegmentName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && onLaunchCampaign && (
                        <button
                          onClick={() => onLaunchCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Play className="h-3 w-3" />
                          Launch
                        </button>
                      )}
                      {campaign.status === 'active' && onPauseCampaign && (
                        <button
                          onClick={() => onPauseCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
                        >
                          <Pause className="h-3 w-3" />
                          Pause
                        </button>
                      )}
                      {campaign.status === 'paused' && onResumeCampaign && (
                        <button
                          onClick={() => onResumeCampaign(campaign.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Play className="h-3 w-3" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedCampaign(isSelected ? null : campaign.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {onUpdateCampaign && (
                        <button
                          onClick={() => {
                            // Handle edit
                          }}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {onDeleteCampaign && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this campaign?')) {
                              onDeleteCampaign(campaign.id);
                            }
                          }}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Sent</p>
                      <p className="text-sm font-semibold text-gray-900">{campaign.metrics.sent || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Open Rate</p>
                      <p className="text-sm font-semibold text-gray-900">{performance.openRate.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Click Rate</p>
                      <p className="text-sm font-semibold text-gray-900">{performance.clickRate.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Conversions</p>
                      <p className="text-sm font-semibold text-gray-900">{campaign.metrics.converted || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Revenue</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(campaign.metrics.revenue || 0)}
                      </p>
                    </div>
                  </div>

                  {campaign.startDate && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
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

                {/* Expanded Details */}
                {isSelected && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3">Campaign Details</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Type:</span>
                            <span className="text-sm font-medium text-gray-900 capitalize">{campaign.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Status:</span>
                            <span className="text-sm font-medium text-gray-900 capitalize">{campaign.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Budget:</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(campaign.budget)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Spent:</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(campaign.actualCost)}</span>
                          </div>
                          {campaign.createdBy && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Created by:</span>
                              <span className="text-sm font-medium text-gray-900">{campaign.createdBy.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3">Performance Metrics</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Delivered:</span>
                            <span className="text-sm font-medium text-gray-900">{campaign.metrics.delivered || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Opened:</span>
                            <span className="text-sm font-medium text-gray-900">{campaign.metrics.opened || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Clicked:</span>
                            <span className="text-sm font-medium text-gray-900">{campaign.metrics.clicked || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Converted:</span>
                            <span className="text-sm font-medium text-gray-900">{campaign.metrics.converted || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Revenue:</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(campaign.metrics.revenue || 0)}</span>
                          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Marketing Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., Summer Sale Promotion"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
                  <select
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value as Campaign['type'] })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe your campaign objectives and target audience"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Segment</label>
                  <select
                    value={newCampaign.targetSegmentId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, targetSegmentId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                  <input
                    type="number"
                    value={newCampaign.budget}
                    onChange={(e) => setNewCampaign({ ...newCampaign, budget: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
                <input
                  type="text"
                  value={newCampaign.contentTemplate.subject}
                  onChange={(e) =>
                    setNewCampaign({
                      ...newCampaign,
                      contentTemplate: { ...newCampaign.contentTemplate, subject: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Campaign subject line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
                <textarea
                  value={newCampaign.contentTemplate.body}
                  onChange={(e) =>
                    setNewCampaign({
                      ...newCampaign,
                      contentTemplate: { ...newCampaign.contentTemplate, body: e.target.value },
                    })
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Campaign content"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="schedule"
                      value="immediate"
                      checked={newCampaign.scheduleConfig.sendImmediately}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          scheduleConfig: { ...newCampaign.scheduleConfig, sendImmediately: true },
                        })
                      }
                      className="mr-2"
                    />
                      Send immediately
                    </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="schedule"
                      value="scheduled"
                      checked={!newCampaign.scheduleConfig.sendImmediately}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          scheduleConfig: { ...newCampaign.scheduleConfig, sendImmediately: false },
                        })
                      }
                      className="mr-2"
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
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
