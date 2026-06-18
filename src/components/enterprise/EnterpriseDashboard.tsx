import {
  Shield,
  Zap,
  MapPin,
  Key,
  Users,
  Package,
  Globe,
  Webhook,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '../../utils/supabaseClient';

interface RealStats {
  employeeCount: number;
  activeProductCount: number;
  lowStockCount: number;
  customerCount: number;
}

export default function EnterpriseDashboard() {
  const [stats, setStats] = useState<RealStats>({
    employeeCount: 0,
    activeProductCount: 0,
    lowStockCount: 0,
    customerCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [employeesRes, productsRes, customersRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id, stock_quantity, min_stock_level', { count: 'exact' }).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);

      const products = productsRes.data ?? [];
      const lowStock = products.filter(
        (p: { stock_quantity: number; min_stock_level: number }) =>
          p.stock_quantity <= p.min_stock_level,
      ).length;

      setStats({
        employeeCount: employeesRes.count ?? 0,
        activeProductCount: productsRes.count ?? 0,
        lowStockCount: lowStock,
        customerCount: customersRes.count ?? 0,
      });
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
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
              <h1 className="mt-3 text-3xl font-semibold">Enterprise Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Overview of your enterprise features and live business data.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={loadDashboardData}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 self-start"
            >
              <RefreshCw className="h-4 w-4 me-2" />
              Refresh
            </Button>
          </div>
        </section>

        {/* Live Business Metrics */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/75 to-cyan-400/50">
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Active Employees</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.employeeCount}</p>
            <p className="text-sm text-white/80">across all roles</p>
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/70 to-lime-400/50">
              <Package className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Active Products</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.activeProductCount}</p>
            {stats.lowStockCount > 0 && (
              <p className="text-sm text-amber-300">{stats.lowStockCount} below reorder level</p>
            )}
            {stats.lowStockCount === 0 && (
              <p className="text-sm text-white/80">all stock levels healthy</p>
            )}
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/70 to-pink-400/50">
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Customers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.customerCount}</p>
            <p className="text-sm text-white/80">in your database</p>
          </div>

          <div className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/70 to-orange-400/50">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">Locations</p>
            <p className="mt-2 text-2xl font-semibold text-white">1</p>
            <p className="text-sm text-white/80">multi-location coming soon</p>
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Shield className="h-4 w-4" />
                    Roles & Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70 space-y-1">
                  <div className="flex justify-between">
                    <span>Team members</span>
                    <span className="font-medium text-white">{stats.employeeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Role tiers</span>
                    <span className="font-medium text-white">4</span>
                  </div>
                  <p className="text-xs text-white/40 mt-2">Owner · Manager · Cashier · Viewer</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Zap className="h-4 w-4" />
                    Workflow Automation
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70">
                  <p className="text-xs text-white/40">Not configured — coming soon</p>
                  <p className="mt-1">Automate low-stock alerts, daily reports, and customer onboarding.</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <MapPin className="h-4 w-4" />
                    Multi-Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70">
                  <div className="flex justify-between">
                    <span>Active locations</span>
                    <span className="font-medium text-white">1</span>
                  </div>
                  <p className="text-xs text-white/40 mt-2">Expand to multiple branches in a future update.</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Key className="h-4 w-4" />
                    API Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70">
                  <p className="text-xs text-white/40">Not configured — coming soon</p>
                  <p className="mt-1">Generate API keys to connect external systems.</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Webhook className="h-4 w-4" />
                    Webhooks
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70">
                  <p className="text-xs text-white/40">Not configured — coming soon</p>
                  <p className="mt-1">Push real-time events to external services.</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Package className="h-4 w-4" />
                    Inventory Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70 space-y-1">
                  <div className="flex justify-between">
                    <span>Active products</span>
                    <span className="font-medium text-white">{stats.activeProductCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low stock items</span>
                    <span className={`font-medium ${stats.lowStockCount > 0 ? 'text-amber-300' : 'text-white'}`}>
                      {stats.lowStockCount}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
