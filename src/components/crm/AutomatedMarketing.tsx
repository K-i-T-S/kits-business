import { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Play,
  Pause,
  Settings,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { MarketingCampaign, CustomerSegment, AutomatedWorkflow } from '../../types/crm';

interface AutomatedMarketingProps {
  campaigns: MarketingCampaign[];
  segments: CustomerSegment[];
  workflows: AutomatedWorkflow[];
  onCreateCampaign: (campaign: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCampaign: (id: string, campaign: Partial<MarketingCampaign>) => void;
  onCreateWorkflow: (workflow: Omit<AutomatedWorkflow, 'id' | 'createdAt'>) => void;
  onUpdateWorkflow: (id: string, workflow: Partial<AutomatedWorkflow>) => void;
}

export default function AutomatedMarketing({
  campaigns,
  segments,
  workflows,
  onCreateCampaign,
  onUpdateCampaign,
  onCreateWorkflow,
  onUpdateWorkflow,
}: AutomatedMarketingProps) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'workflows' | 'automation'>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  // Campaign statistics
  const campaignStats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
    const totalSent = campaigns.reduce((sum, c) => sum + (c.performance?.sent || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.performance?.opened || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.performance?.clicked || 0), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.performance?.revenue || 0), 0);
    const averageOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const averageClickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      totalSent,
      totalOpened,
      totalClicked,
      totalRevenue,
      averageOpenRate,
      averageClickRate,
    };
  }, [campaigns]);

  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: MarketingCampaign['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getWorkflowIcon = (trigger: AutomatedWorkflow['trigger']['type']) => {
    switch (trigger) {
      case 'customer_join':
        return <Users className="h-4 w-4" />;
      case 'purchase':
        return <TrendingUp className="h-4 w-4" />;
      case 'birthday':
        return <Calendar className="h-4 w-4" />;
      case 'inactivity':
        return <Clock className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const toggleWorkflowExpansion = (workflowId: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedWorkflows(newExpanded);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation for creating campaign
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Automated Marketing</h2>
          <p className="text-sm text-gray-600">Create and manage automated marketing campaigns and workflows</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'campaigns', label: 'Campaigns', icon: Mail },
            { id: 'workflows', label: 'Workflows', icon: Zap },
            { id: 'automation', label: 'Automation Rules', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Campaign Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Campaigns</p>
                  <p className="text-2xl font-semibold text-gray-900">{campaignStats.totalCampaigns}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Play className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Campaigns</p>
                  <p className="text-2xl font-semibold text-gray-900">{campaignStats.activeCampaigns}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg. Open Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">{campaignStats.averageOpenRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(campaignStats.totalRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Campaigns List */}
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No campaigns yet</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first marketing campaign to get started</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{campaign.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Sent</p>
                          <p className="text-sm font-medium text-gray-900">{campaign.performance?.sent || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Opened</p>
                          <p className="text-sm font-medium text-gray-900">{campaign.performance?.opened || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Clicked</p>
                          <p className="text-sm font-medium text-gray-900">{campaign.performance?.clicked || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(campaign.performance?.revenue || 0)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {campaign.targetSegments.length} segments
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {campaign.targetCustomers.length} customers
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(campaign.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Settings className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Pause className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Automated Workflows</h3>
              <p className="text-sm text-gray-600">Create automated workflows based on customer triggers</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No workflows yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create your first automated workflow to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => {
                const isExpanded = expandedWorkflows.has(workflow.id);
                
                return (
                  <div key={workflow.id} className="bg-white rounded-lg border border-gray-200">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleWorkflowExpansion(workflow.id)}
                            className="rounded-lg p-1 hover:bg-gray-100"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                          </button>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                            {getWorkflowIcon(workflow.trigger.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{workflow.name}</h4>
                            <p className="text-sm text-gray-600">{workflow.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {workflow.isActive ? 'Active' : 'Inactive'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {workflow.actions.length} actions
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                              <Settings className="h-4 w-4" />
                            </button>
                            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                              {workflow.isActive ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4">
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Trigger</h5>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="flex items-center gap-2">
                                {getWorkflowIcon(workflow.trigger.type)}
                                <span className="text-sm font-medium text-gray-900 capitalize">
                                  {workflow.trigger.type.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                When {workflow.trigger.type.replace('_', ' ')} occurs
                              </p>
                            </div>
                          </div>

                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Actions</h5>
                            <div className="space-y-2">
                              {workflow.actions.map((action: any, index: number) => (
                                <div key={index} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-300">
                                    {action.type === 'send_email' && <Mail className="h-4 w-4" />}
                                    {action.type === 'send_sms' && <MessageSquare className="h-4 w-4" />}
                                    {action.type === 'add_tag' && <Target className="h-4 w-4" />}
                                    {action.type === 'delay' && <Clock className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 capitalize">
                                      {action.type.replace('_', ' ')}
                                    </p>
                                    {action.delay && (
                                      <p className="text-xs text-gray-500">
                                        Delay: {action.delay} minutes
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Automation Rules Tab */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Automation Rules</h3>
            <p className="text-sm text-gray-600">Configure automated marketing rules and settings</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Welcome Series</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">New Customer Welcome</p>
                    <p className="text-xs text-gray-500">Send welcome email to new customers</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Onboarding Sequence</p>
                    <p className="text-xs text-gray-500">Send onboarding emails over 7 days</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Re-engagement Campaigns</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Inactive Customers</p>
                    <p className="text-xs text-gray-500">Re-engage customers after 30 days</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Abandoned Cart</p>
                    <p className="text-xs text-gray-500">Send reminder for abandoned carts</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Personalization</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Birthday Campaigns</p>
                    <p className="text-xs text-gray-500">Send birthday wishes and offers</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Purchase Anniversary</p>
                    <p className="text-xs text-gray-500">Celebrate purchase anniversaries</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Smart Sending</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Optimal Send Time</p>
                    <p className="text-xs text-gray-500">Send at customer's optimal time</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Frequency Capping</p>
                    <p className="text-xs text-gray-500">Limit emails per customer per week</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Summer Sale 2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push Notification</option>
                    <option value="social">Social Media</option>
                    <option value="multi">Multi-channel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe your campaign objectives and target audience"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Segments</label>
                  <select multiple className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} ({segment.customerCount} customers)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="0.00"
                />
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
