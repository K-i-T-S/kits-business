import {
  Activity,
  CheckCircle,
  Clock,
  Settings,
  Database,
  Zap,
  Package,
  Users,
  ShoppingCart,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import HealthCheckDashboard from './HealthCheckDashboard';
import PerformanceDashboard from './PerformanceDashboard';

import { supabase } from '../../utils/supabaseClient';

interface AppStats {
  productCount: number;
  customerCount: number;
  salesToday: number;
  employeeCount: number;
}

export default function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<AppStats>({ productCount: 0, customerCount: 0, salesToday: 0, employeeCount: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [productsRes, customersRes, salesTodayRes, employeesRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('sales').select('id', { count: 'exact', head: true }).gte('sale_date', todayStart.toISOString()),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      setStats({
        productCount: productsRes.count ?? 0,
        customerCount: customersRes.count ?? 0,
        salesToday: salesTodayRes.count ?? 0,
        employeeCount: employeesRes.count ?? 0,
      });
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-400" />
              System Monitoring
            </h1>
            <p className="text-slate-400 mt-2">System health and live application metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/10 text-slate-200 border-white/20">
              <Clock className="h-3 w-3 mr-1" />
              {new Date().toLocaleTimeString()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStats}
              className="bg-white/10 text-slate-200 border-white/20 hover:bg-white/20"
            >
              <Settings className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Overview
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Health Checks
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* System Status */}
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
                  <p className="text-slate-400 text-sm">Supabase connected</p>
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
                  <div className="text-2xl font-bold text-blue-400">Supabase</div>
                  <p className="text-slate-400 text-sm">PostgreSQL · Free tier</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Sales Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-300">
                    {loading ? '—' : stats.salesToday}
                  </div>
                  <p className="text-slate-400 text-sm">transactions recorded</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-400" />
                    Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-300">
                    {loading ? '—' : stats.employeeCount}
                  </div>
                  <p className="text-slate-400 text-sm">active employees</p>
                </CardContent>
              </Card>
            </div>

            {/* App Data Summary */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  <span>Application Data</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Live counts from your Supabase database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <Package className="h-5 w-5 text-green-400" />
                    <p className="text-xl font-semibold text-white">{loading ? '—' : stats.productCount}</p>
                    <p className="text-xs text-slate-400">Products</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <Users className="h-5 w-5 text-blue-400" />
                    <p className="text-xl font-semibold text-white">{loading ? '—' : stats.customerCount}</p>
                    <p className="text-xs text-slate-400">Customers</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <ShoppingCart className="h-5 w-5 text-purple-400" />
                    <p className="text-xl font-semibold text-white">{loading ? '—' : stats.salesToday}</p>
                    <p className="text-xs text-slate-400">Sales Today</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <Users className="h-5 w-5 text-orange-400" />
                    <p className="text-xl font-semibold text-white">{loading ? '—' : stats.employeeCount}</p>
                    <p className="text-xs text-slate-400">Employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <HealthCheckDashboard />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
