import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Settings,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import type { MarketingCampaign, CustomerSegment, AutomatedWorkflow, WorkflowAction } from '../../types/crm';

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
  onCreateCampaign: _onCreateCampaign,
  onUpdateCampaign: _onUpdateCampaign,
  onCreateWorkflow: _onCreateWorkflow,
  onUpdateWorkflow: _onUpdateWorkflow,
}: AutomatedMarketingProps) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'workflows' | 'automation'>('campaigns');
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  const campaignStats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'active').length;
    const totalSent = campaigns.reduce((sum, c) => sum + (c.performance?.sent || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.performance?.opened || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.performance?.clicked || 0), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.performance?.revenue || 0), 0);
    const averageOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const averageClickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    return { totalCampaigns, activeCampaigns, totalSent, totalOpened, totalClicked, totalRevenue, averageOpenRate, averageClickRate };
  }, [campaigns]);

  const formatCurrency = (value: number | undefined | null) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusColor = (status: MarketingCampaign['status']) => {
    switch (status) {
      case 'running':
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'draft':
        return 'bg-white/10 text-white/60 border-white/20';
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  const getWorkflowIcon = (trigger: AutomatedWorkflow['trigger']['type']) => {
    switch (trigger) {
      case 'customer_join': return <Users className="h-4 w-4" />;
      case 'purchase': return <TrendingUp className="h-4 w-4" />;
      case 'birthday': return <Calendar className="h-4 w-4" />;
      case 'inactivity': return <Clock className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
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

  const getActionIcon = (type: WorkflowAction['type']) => {
    switch (type) {
      case 'send_email': return <Mail className="h-4 w-4" />;
      case 'send_sms': return <MessageSquare className="h-4 w-4" />;
      case 'add_tag': return <Target className="h-4 w-4" />;
      case 'delay': return <Clock className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">Marketing</p>
          <h2 className="mt-1 text-xl font-bold text-white">Automated Marketing</h2>
          <p className="text-sm text-white/60">Create and manage automated campaigns and workflows</p>
        </div>
        <button
          onClick={() => toast.info('Campaign creation coming soon')}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
        {[
          { id: 'campaigns', label: 'Campaigns', icon: Mail },
          { id: 'workflows', label: 'Workflows', icon: Zap },
          { id: 'automation', label: 'Automation Rules', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'campaigns' | 'workflows' | 'automation')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Campaigns', value: campaignStats.totalCampaigns, icon: Mail },
              { label: 'Active Campaigns', value: campaignStats.activeCampaigns, icon: Play },
              { label: 'Avg. Open Rate', value: `${campaignStats.averageOpenRate.toFixed(1)}%`, icon: Target },
              { label: 'Total Revenue', value: formatCurrency(campaignStats.totalRevenue), icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50">{label}</p>
                    <p className="text-xl font-bold text-white">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
                <Mail className="mx-auto h-12 w-12 text-white/20" />
                <h3 className="mt-3 text-sm font-semibold text-white">No campaigns yet</h3>
                <p className="mt-1 text-sm text-white/50">
                  Marketing campaigns will be available in a future update.
                  <br />
                  Send targeted email, SMS, and push campaigns to customer segments.
                </p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="font-medium text-white">{campaign.name}</h3>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <p className="mb-4 text-sm text-white/60">{campaign.description}</p>

                      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        {[
                          { label: 'Sent', value: campaign.performance?.sent || 0 },
                          { label: 'Opened', value: campaign.performance?.opened || 0 },
                          { label: 'Clicked', value: campaign.performance?.clicked || 0 },
                          { label: 'Revenue', value: formatCurrency(campaign.performance?.revenue || 0) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-white/50">{label}</p>
                            <p className="text-sm font-medium text-white">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {campaign.targetSegments.length} segments
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(campaign.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      <button
                        onClick={() => toast.info('Campaign settings coming soon')}
                        className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                        title="Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toast.info('Campaign controls coming soon')}
                        className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                        title="Pause/Resume"
                      >
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
              <h3 className="font-semibold text-white">Automated Workflows</h3>
              <p className="text-sm text-white/60">Trigger actions based on customer events</p>
            </div>
            <button
              onClick={() => toast.info('Workflow builder coming soon')}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
              <Zap className="mx-auto h-12 w-12 text-white/20" />
              <h3 className="mt-3 text-sm font-semibold text-white">No workflows yet</h3>
              <p className="mt-1 text-sm text-white/50">
                Workflow automation will be available in a future update.
                <br />
                Automatically send messages, add tags, and run actions when customers join, purchase, or go inactive.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => {
                const isExpanded = expandedWorkflows.has(workflow.id);
                return (
                  <div key={workflow.id} className="rounded-2xl border border-white/15 bg-white/5">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleWorkflowExpansion(workflow.id)}
                            className="rounded-xl p-1 hover:bg-white/10"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-white/50" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-white/50" />
                            )}
                          </button>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                            {getWorkflowIcon(workflow.trigger.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{workflow.name}</h4>
                            <p className="text-sm text-white/60">{workflow.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-sm font-medium ${workflow.isActive ? 'text-green-400' : 'text-white/40'}`}>
                              {workflow.isActive ? 'Active' : 'Inactive'}
                            </p>
                            <p className="text-xs text-white/40">{workflow.actions.length} actions</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => toast.info('Workflow settings coming soon')}
                              className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toast.info('Workflow toggle coming soon')}
                              className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                            >
                              {workflow.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 space-y-4">
                        <div>
                          <h5 className="mb-2 font-medium text-white">Trigger</h5>
                          <div className="rounded-xl bg-white/5 p-3">
                            <div className="flex items-center gap-2 text-indigo-400">
                              {getWorkflowIcon(workflow.trigger.type)}
                              <span className="text-sm font-medium capitalize">
                                {workflow.trigger.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/40">
                              When {workflow.trigger.type.replace(/_/g, ' ')} occurs
                            </p>
                          </div>
                        </div>

                        <div>
                          <h5 className="mb-2 font-medium text-white">Actions</h5>
                          <div className="space-y-2">
                            {workflow.actions.map((action: WorkflowAction, index: number) => (
                              <div key={index} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/60">
                                  {getActionIcon(action.type)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white capitalize">
                                    {action.type.replace(/_/g, ' ')}
                                  </p>
                                  {action.delay && (
                                    <p className="text-xs text-white/40">Delay: {action.delay} minutes</p>
                                  )}
                                </div>
                              </div>
                            ))}
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
            <h3 className="font-semibold text-white">Automation Rules</h3>
            <p className="text-sm text-white/60">Configure automated marketing rules and settings</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <Settings className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-3 text-sm font-semibold text-white">Automation Rules</h3>
            <p className="mt-1 text-sm text-white/50">
              This feature will be available in a future update.
              <br />
              Configure welcome series, re-engagement campaigns, birthday offers, and smart send-time optimization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
