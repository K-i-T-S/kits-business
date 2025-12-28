import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings, 
  Bell,
  Shield,
  Zap,
  Database,
  Globe
} from 'lucide-react';
import Layout from '../Layout';
import HealthCheckDashboard from './HealthCheckDashboard';
import ErrorTrackingDashboard from './ErrorTrackingDashboard';
import PerformanceDashboard from './PerformanceDashboard';

interface MonitoringAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export default function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([
    {
      id: '1',
      type: 'error',
      title: 'Database Connection Pool Exhausted',
      message: 'The primary database connection pool has reached maximum capacity',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      acknowledged: false,
      severity: 'critical'
    },
    {
      id: '2',
      type: 'warning',
      title: 'High Memory Usage',
      message: 'Memory usage is above 80% threshold',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      acknowledged: false,
      severity: 'high'
    },
    {
      id: '3',
      type: 'info',
      title: 'Scheduled Maintenance',
      message: 'System maintenance scheduled for tonight at 2:00 AM',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      acknowledged: true,
      severity: 'low'
    }
  ]);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info': return <Bell className="h-4 w-4 text-blue-400" />;
      default: return <Bell className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge className="bg-red-900/50 text-red-200 border-red-800">Critical</Badge>;
      case "high": return <Badge className="bg-orange-900/50 text-orange-200 border-orange-800">High</Badge>;
      case "medium": return <Badge className="bg-yellow-900/50 text-yellow-200 border-yellow-800">Medium</Badge>;
      case "low": return <Badge className="bg-blue-900/50 text-blue-200 border-blue-800">Low</Badge>;
      default: return <Badge className="bg-slate-800 text-slate-200 border-slate-700">Unknown</Badge>;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900/50 text-red-200 border-red-800';
      case 'high': return 'bg-orange-900/50 text-orange-200 border-orange-800';
      case 'medium': return 'bg-yellow-900/50 text-yellow-200 border-yellow-800';
      case 'low': return 'bg-blue-900/50 text-blue-200 border-blue-800';
      default: return 'bg-slate-800 text-slate-200 border-slate-700';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-400" />
            System Monitoring
          </h1>
          <p className="text-slate-400 mt-2">Real-time system health and performance metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-white/10 text-slate-200 border-white/20">
            <Clock className="h-3 w-3 mr-1" />
            Last updated: {new Date().toLocaleTimeString()}
          </Badge>
          <Button variant="outline" size="sm" className="bg-white/10 text-slate-200 border-white/20 hover:bg-white/20">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts.filter(a => !a.acknowledged && a.severity === 'critical').length > 0 && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="flex-1">
              <h3 className="text-red-200 font-semibold">Critical Alerts Active</h3>
              <p className="text-red-300 text-sm">
                {alerts.filter(a => !a.acknowledged && a.severity === 'critical').length} critical issues require immediate attention
              </p>
            </div>
            <Button variant="outline" size="sm" className="bg-red-800/20 text-red-200 border-red-700/50 hover:bg-red-800/30">
              View All
            </Button>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/10 border border-white/20">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
            Overview
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
            Health Checks
          </TabsTrigger>
          <TabsTrigger value="errors" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
            Error Tracking
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">Operational</div>
                <p className="text-slate-400 text-sm">All systems running normally</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">98.5%</div>
                <p className="text-slate-400 text-sm">Uptime this month</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">Good</div>
                <p className="text-xs text-slate-400">Within thresholds</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span>Uptime</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">99.9%</div>
                <p className="text-xs text-slate-400">Last 30 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Alerts */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center space-x-2">
                <Bell className="h-5 w-5 text-blue-400" />
                <span>Recent Alerts</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest monitoring alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border border-white/10 rounded bg-white/5">
                    <div className="flex items-center space-x-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <p className="font-medium text-slate-100">{alert.title}</p>
                        <p className="text-sm text-slate-400">{alert.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-xs text-slate-400">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <HealthCheckDashboard />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorTrackingDashboard />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center space-x-2">
                <Bell className="h-5 w-5 text-blue-400" />
                <span>All Alerts</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Complete list of monitoring alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className={`flex items-center justify-between p-4 border border-white/10 rounded bg-white/5 ${alert.acknowledged ? 'opacity-60' : ''}`}>
                    <div className="flex items-center space-x-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <p className="font-medium text-slate-100">{alert.title}</p>
                        <p className="text-sm text-slate-400">{alert.message}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {getSeverityBadge(alert.severity)}
                          <span className="text-xs text-slate-400">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                          {alert.acknowledged && (
                            <Badge variant="secondary">Acknowledged</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </Layout>
  );
}
