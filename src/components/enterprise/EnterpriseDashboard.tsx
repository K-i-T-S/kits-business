import {
  Shield,
  Zap,
  MapPin,
  Key,
  BarChart3,
  Users,
  Activity,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Settings,
  Globe,
  Package,
  ShoppingCart,
  UserCheck,
  Lock,
  Webhook,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnterpriseStats {
  totalUsers: number;
  activeRoles: number;
  activeWorkflows: number;
  totalLocations: number;
  activeApiKeys: number;
  activeWebhooks: number;
  lowStockItems: number;
  pendingTransfers: number;
  failedWebhooks: number;
  apiCallsToday: number;
  workflowRunsToday: number;
}

interface RecentActivity {
  id: string;
  type: 'user' | 'workflow' | 'transfer' | 'webhook' | 'api';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface SystemHealth {
  api: {
    status: 'healthy' | 'warning' | 'error';
    responseTime: number;
    uptime: number;
  };
  webhooks: {
    status: 'healthy' | 'warning' | 'error';
    successRate: number;
    lastDelivery: string;
  };
  workflows: {
    status: 'healthy' | 'warning' | 'error';
    successRate: number;
    activeCount: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'error';
    connections: number;
    queryTime: number;
  };
}

export default function EnterpriseDashboard() {
  const [stats, setStats] = useState<EnterpriseStats>({
    totalUsers: 0,
    activeRoles: 0,
    activeWorkflows: 0,
    totalLocations: 0,
    activeApiKeys: 0,
    activeWebhooks: 0,
    lowStockItems: 0,
    pendingTransfers: 0,
    failedWebhooks: 0,
    apiCallsToday: 0,
    workflowRunsToday: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    api: { status: 'healthy', responseTime: 150, uptime: 99.9 },
    webhooks: { status: 'healthy', successRate: 98.5, lastDelivery: '2 minutes ago' },
    workflows: { status: 'healthy', successRate: 95.2, activeCount: 12 },
    database: { status: 'healthy', connections: 45, queryTime: 25 },
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockStats: EnterpriseStats = {
        totalUsers: 24,
        activeRoles: 8,
        activeWorkflows: 12,
        totalLocations: 5,
        activeApiKeys: 6,
        activeWebhooks: 4,
        lowStockItems: 3,
        pendingTransfers: 2,
        failedWebhooks: 1,
        apiCallsToday: 1247,
        workflowRunsToday: 89,
      };

      const mockRecentActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'user',
          title: 'New Role Assigned',
          description: 'John Doe was assigned the Inventory Manager role',
          timestamp: '2024-01-20T14:30:00Z',
          status: 'success',
        },
        {
          id: '2',
          type: 'workflow',
          title: 'Workflow Executed',
          description: 'Low Stock Alert workflow completed successfully',
          timestamp: '2024-01-20T14:15:00Z',
          status: 'success',
        },
        {
          id: '3',
          type: 'transfer',
          title: 'Stock Transfer',
          description: '10 units transferred from Warehouse to Main Store',
          timestamp: '2024-01-20T13:45:00Z',
          status: 'success',
        },
        {
          id: '4',
          type: 'webhook',
          title: 'Webhook Failed',
          description: 'Product Updates webhook delivery failed (3 attempts)',
          timestamp: '2024-01-20T13:30:00Z',
          status: 'error',
        },
        {
          id: '5',
          type: 'api',
          title: 'API Key Created',
          description: 'New API key generated for Integration Service',
          timestamp: '2024-01-20T12:00:00Z',
          status: 'info',
        },
        {
          id: '6',
          type: 'user',
          title: 'User Login',
          description: 'Admin user logged in from new IP address',
          timestamp: '2024-01-20T11:30:00Z',
          status: 'warning',
        },
      ];

      setStats(mockStats);
      setRecentActivity(mockRecentActivity);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'workflow':
        return <Zap className="h-4 w-4" />;
      case 'transfer':
        return <ArrowRight className="h-4 w-4" />;
      case 'webhook':
        return <Webhook className="h-4 w-4" />;
      case 'api':
        return <Key className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getHealthColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthBgColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100';
      case 'warning':
        return 'bg-yellow-100';
      case 'error':
        return 'bg-red-100';
      default:
        return 'bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-chip bg-white/10 text-white/80">Enterprise Command Center</p>
              <h1 className="mt-3 text-3xl font-semibold">
                Enterprise Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Overview of your enterprise features and system health. Monitor workflows, manage locations, and track API performance.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadDashboardData} className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/75 to-cyan-400/50">
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Total Users</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.totalUsers}</p>
            <p className="text-sm text-white/80">{stats.activeRoles} active roles</p>
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/70 to-lime-400/50">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Active Workflows</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.activeWorkflows}</p>
            <p className="text-sm text-white/80">{stats.workflowRunsToday} runs today</p>
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/70 to-pink-400/50">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Locations</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.totalLocations}</p>
            <p className="text-sm text-white/80">{stats.pendingTransfers} pending transfers</p>
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/70 to-orange-400/50">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">API Activity</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.apiCallsToday}</p>
            <p className="text-sm text-white/80">{stats.activeApiKeys} active keys</p>
          </div>
        </section>

        {/* Alerts */}
        {(stats.lowStockItems > 0 || stats.failedWebhooks > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.lowStockItems > 0 && (
              <div className="glass-panel border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-800">Low Stock Alert</h3>
                </div>
                <p className="text-amber-700 mb-3">
                  {stats.lowStockItems} products are below their reorder levels
                </p>
                <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  View Inventory
                </Button>
              </div>
            )}

            {stats.failedWebhooks > 0 && (
              <div className="glass-panel border border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Webhook className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-800">Webhook Issues</h3>
                </div>
                <p className="text-red-700 mb-3">
                  {stats.failedWebhooks} webhook deliveries failed
                </p>
                <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50">
                  Review Webhooks
                </Button>
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                  Roles & Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Roles</span>
                      <span className="font-medium">{stats.activeRoles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>System Roles</span>
                      <span className="font-medium">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custom Roles</span>
                      <span className="font-medium">{stats.activeRoles - 5}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage Roles
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                  Workflow Automation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Active Workflows</span>
                      <span className="font-medium">{stats.activeWorkflows}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Runs Today</span>
                      <span className="font-medium">{stats.workflowRunsToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate</span>
                      <span className="font-medium">95.2%</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage Workflows
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                  Multi-Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Locations</span>
                      <span className="font-medium">{stats.totalLocations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active</span>
                      <span className="font-medium">{stats.totalLocations - 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Transfers</span>
                      <span className="font-medium">{stats.pendingTransfers}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage Locations
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Key className="h-5 w-5 mr-2" />
                  API Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Active Keys</span>
                      <span className="font-medium">{stats.activeApiKeys}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>API Calls Today</span>
                      <span className="font-medium">{stats.apiCallsToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Response Time</span>
                      <span className="font-medium">150ms</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage API
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Webhook className="h-5 w-5 mr-2" />
                  Webhooks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Active Webhooks</span>
                      <span className="font-medium">{stats.activeWebhooks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate</span>
                      <span className="font-medium">98.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed Today</span>
                      <span className="font-medium">{stats.failedWebhooks}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage Webhooks
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                  Inventory Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Products</span>
                      <span className="font-medium">156</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Low Stock Items</span>
                      <span className="font-medium text-yellow-600">{stats.lowStockItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Value</span>
                      <span className="font-medium">$45,678</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                  View Inventory
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest system events and user actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 mt-0.5">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{activity.title}</p>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(activity.status)}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                  API Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <Badge className={getHealthBgColor(systemHealth.api.status)}>
                        {systemHealth.api.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Response Time</span>
                      <span className={`font-medium ${getHealthColor(systemHealth.api.status)}`}>
                        {systemHealth.api.responseTime}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Uptime</span>
                      <span className="font-medium">{systemHealth.api.uptime}%</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Performance</span>
                        <span>Good</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Webhook className="h-5 w-5 mr-2" />
                  Webhook Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <Badge className={getHealthBgColor(systemHealth.webhooks.status)}>
                        {systemHealth.webhooks.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Success Rate</span>
                      <span className={`font-medium ${getHealthColor(systemHealth.webhooks.status)}`}>
                        {systemHealth.webhooks.successRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last Delivery</span>
                      <span className="text-sm">{systemHealth.webhooks.lastDelivery}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Reliability</span>
                        <span>Excellent</span>
                      </div>
                      <Progress value={systemHealth.webhooks.successRate} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                  Workflow Engine
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <Badge className={getHealthBgColor(systemHealth.workflows.status)}>
                        {systemHealth.workflows.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Success Rate</span>
                      <span className={`font-medium ${getHealthColor(systemHealth.workflows.status)}`}>
                        {systemHealth.workflows.successRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Workflows</span>
                      <span className="font-medium">{systemHealth.workflows.activeCount}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Efficiency</span>
                        <span>Good</span>
                      </div>
                      <Progress value={systemHealth.workflows.successRate} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                  Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <Badge className={getHealthBgColor(systemHealth.database.status)}>
                        {systemHealth.database.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Connections</span>
                      <span className="font-medium">{systemHealth.database.connections}/100</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg Query Time</span>
                      <span className={`font-medium ${getHealthColor(systemHealth.database.status)}`}>
                        {systemHealth.database.queryTime}ms
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Load</span>
                        <span>Normal</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                  API Usage Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-2 text-center">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                        <div key={day} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{day}</div>
                          <div className="h-16 bg-muted rounded flex items-end justify-center p-1">
                            <div
                              className="bg-primary rounded w-full"
                              style={{ height: `${Math.random() * 100}%` }}
                            />
                          </div>
                          <div className="text-xs">{Math.floor(Math.random() * 2000)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total this week: 12,847 calls</span>
                      <span className="text-green-600">↑ 15% from last week</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                  Workflow Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Low Stock Alerts</span>
                          <span>98% success</span>
                        </div>
                        <Progress value={98} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Daily Reports</span>
                          <span>95% success</span>
                        </div>
                        <Progress value={95} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Welcome Emails</span>
                          <span>99% success</span>
                        </div>
                        <Progress value={99} className="h-2" />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                    Average execution time: 2.3 seconds
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                Enterprise Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">99.9%</div>
                    <div className="text-sm text-muted-foreground">System Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">2.3s</div>
                    <div className="text-sm text-muted-foreground">Avg Response Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">95.2%</div>
                    <div className="text-sm text-muted-foreground">Workflow Success</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">98.5%</div>
                    <div className="text-sm text-muted-foreground">Webhook Delivery</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
