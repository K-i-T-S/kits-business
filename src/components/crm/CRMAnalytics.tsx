import {
  ArrowUp,
  ArrowDown,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
  UserPlus,
  Mail,
  MessageSquare,
  Target,
  PieChart,
  Activity,
} from 'lucide-react';
import { useMemo } from 'react';

import type { Customer, CustomerSegment, MarketingCampaign, CRMAnalytics } from '../../types/crm';

interface CRMAnalyticsProps {
  customers: Customer[];
  segments: CustomerSegment[];
  campaigns: MarketingCampaign[];
  dateRange: {
    start: string;
    end: string;
  };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

export default function CRMAnalytics({
  customers,
  segments,
  campaigns,
  dateRange,
  onDateRangeChange,
}: CRMAnalyticsProps) {
  // Calculate analytics data
  const analytics = useMemo((): CRMAnalytics => {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;

    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1);

    const newCustomersThisMonth = customers.filter(c => {
      const joinDate = new Date(c.createdAt);
      return joinDate >= thisMonth;
    }).length;

    const newCustomersLastMonth = customers.filter(c => {
      const joinDate = new Date(c.createdAt);
      return joinDate >= lastMonth && joinDate < thisMonth;
    }).length;

    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const averageCustomerLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Calculate retention rate (simplified)
    const activeCustomersLastMonth = customers.filter(c => {
      const lastPurchase = c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : null;
      return lastPurchase && lastPurchase >= lastMonth;
    }).length;

    const customerRetentionRate = activeCustomersLastMonth > 0 ?
      (activeCustomers / activeCustomersLastMonth) * 100 : 0;

    // Top customers by revenue
    const topCustomers = [...customers]
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, 10);

    // Segment growth
    const segmentGrowth = segments.map(segment => {
      const currentCount = segment.customerCount;
      // Mock previous count for demo
      const previousCount = Math.floor(currentCount * (0.8 + Math.random() * 0.4));
      const growthRate = previousCount > 0 ?
        ((currentCount - previousCount) / previousCount) * 100 : 0;

      return {
        segmentId: segment.id,
        segmentName: segment.name,
        currentCount,
        previousCount,
        growthRate,
      };
    });

    // Communication metrics
    const totalCommunications = customers.reduce((sum, c) =>
      sum + (c.communicationHistory?.length || 0), 0);

    const totalEmails = customers.reduce((sum, c) =>
      sum + (c.communicationHistory?.filter(comm => comm.type === 'email').length || 0), 0);

    const totalCommunicationsOpened = customers.reduce((sum, c) =>
      sum + (c.communicationHistory?.filter(comm => comm.status === 'opened').length || 0), 0);

    const totalCommunicationsReplied = customers.reduce((sum, c) =>
      sum + (c.communicationHistory?.filter(comm => comm.status === 'replied').length || 0), 0);

    const averageResponseTime = 2.5; // Mock data in hours
    const mostEffectiveChannel = 'email' as const;

    // Campaign metrics
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'running').length;

    const totalSent = campaigns.reduce((sum, c) => sum + (c.performance?.sent || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.performance?.opened || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.performance?.clicked || 0), 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + (c.performance?.converted || 0), 0);

    const averageOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const averageClickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
    const averageConversionRate = totalClicked > 0 ? (totalConverted / totalClicked) * 100 : 0;

    const campaignRevenue = campaigns.reduce((sum, c) => sum + (c.performance?.revenue || 0), 0);
    const campaignCost = campaigns.reduce((sum, c) => sum + (c.performance?.cost || 0), 0);
    const averageROI = campaignCost > 0 ? ((campaignRevenue - campaignCost) / campaignCost) * 100 : 0;

    return {
      totalCustomers,
      activeCustomers,
      newCustomersThisMonth,
      customerRetentionRate,
      averageCustomerLifetimeValue,
      topCustomers,
      segmentGrowth,
      communicationMetrics: {
        totalSent: totalCommunications,
        totalDelivered: totalCommunications, // Simplified
        totalOpened: totalCommunicationsOpened,
        totalReplied: totalCommunicationsReplied,
        averageResponseTime,
        mostEffectiveChannel,
      },
      campaignMetrics: {
        totalCampaigns,
        activeCampaigns,
        averageOpenRate,
        averageClickRate,
        averageConversionRate,
        totalRevenue: campaignRevenue,
        averageROI,
      },
    };
  }, [customers, segments, campaigns]);

  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const MetricCard = ({
    title,
    value,
    change,
    icon: Icon,
    trend,
  }: {
    title: string;
    value: string | number;
    change?: number;
    icon: any;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="h-6 w-6 text-gray-400" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <ArrowUp className="h-4 w-4" /> :
              trend === 'down' ? <ArrowDown className="h-4 w-4" /> : null}
            <span className="text-sm font-medium ml-1">
              {Math.abs(change)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">CRM Analytics</h2>
          <p className="text-sm text-gray-600">Track your customer relationship management performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>{dateRange.start} - {dateRange.end}</span>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <BarChart3 className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Customers"
          value={analytics.totalCustomers}
          change={12.5}
          trend="up"
          icon={Users}
        />
        <MetricCard
          title="Active Customers"
          value={analytics.activeCustomers}
          change={8.2}
          trend="up"
          icon={Activity}
        />
        <MetricCard
          title="New Customers (This Month)"
          value={analytics.newCustomersThisMonth}
          change={-3.1}
          trend="down"
          icon={UserPlus}
        />
        <MetricCard
          title="Customer Retention Rate"
          value={formatPercentage(analytics.customerRetentionRate)}
          change={2.4}
          trend="up"
          icon={Target}
        />
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Avg. Customer Lifetime Value"
          value={formatCurrency(analytics.averageCustomerLifetimeValue)}
          change={15.3}
          trend="up"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Revenue from Campaigns"
          value={formatCurrency(analytics.campaignMetrics.totalRevenue)}
          change={22.7}
          trend="up"
          icon={TrendingUp}
        />
        <MetricCard
          title="Average Campaign ROI"
          value={formatPercentage(analytics.campaignMetrics.averageROI)}
          change={5.8}
          trend="up"
          icon={BarChart3}
        />
      </div>

      {/* Customer Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers by Revenue</h3>
          <div className="space-y-3">
            {analytics.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                    <p className="text-xs text-gray-500">{customer.email || customer.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(customer.totalSpent || 0)}
                  </p>
                  <p className="text-xs text-gray-500">{customer.purchaseCount || 0} purchases</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Segment Growth</h3>
          <div className="space-y-3">
            {analytics.segmentGrowth.slice(0, 5).map((segment) => (
              <div key={segment.segmentId} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{segment.segmentName}</p>
                  <p className="text-xs text-gray-500">
                    {segment.currentCount} customers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center ${
                    segment.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {segment.growthRate >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    <span className="text-xs font-medium">
                      {Math.abs(segment.growthRate).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Communication Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Total Sent</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.communicationMetrics.totalSent}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Total Opened</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.communicationMetrics.totalOpened}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Total Replied</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.communicationMetrics.totalReplied}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Avg. Response Time</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.communicationMetrics.averageResponseTime} hours
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Total Campaigns</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.campaignMetrics.totalCampaigns}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Active Campaigns</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {analytics.campaignMetrics.activeCampaigns}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Avg. Open Rate</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {formatPercentage(analytics.campaignMetrics.averageOpenRate)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Avg. Conversion Rate</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {formatPercentage(analytics.campaignMetrics.averageConversionRate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Distribution Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Status</h4>
            <div className="space-y-2">
              {['active', 'inactive', 'prospect', 'lost'].map((status) => {
                const count = customers.filter(c => c.status === status).length;
                const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Source</h4>
            <div className="space-y-2">
              {['walk_in', 'referral', 'website', 'email', 'phone'].map((source) => {
                const count = customers.filter(c => c.source === source).length;
                const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                return (
                  <div key={source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{source.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Purchase Frequency</h4>
            <div className="space-y-2">
              {[
                { label: 'One-time', min: 0, max: 1 },
                { label: '2-5 purchases', min: 2, max: 5 },
                { label: '6-10 purchases', min: 6, max: 10 },
                { label: '10+ purchases', min: 11, max: Infinity },
              ].map((range) => {
                const count = customers.filter(c =>
                  (c.purchaseCount || 0) >= range.min && (c.purchaseCount || 0) <= range.max,
                ).length;
                const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                return (
                  <div key={range.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{range.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
