import { MapPin, Sparkles, Package, Users, TrendingUp } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { supabase } from '../../utils/supabaseClient';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default function MultiLocationSupport() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState({ employees: 0, products: 0, customers: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, employeesRes, productsRes, customersRes] = await Promise.all([
        supabase.from('tenants').select('id, name, slug, created_at').maybeSingle(),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);

      if (tenantRes.error) throw tenantRes.error;

      setTenant(tenantRes.data ?? null);
      setStats({
        employees: employeesRes.count ?? 0,
        products: productsRes.count ?? 0,
        customers: customersRes.count ?? 0,
      });
    } catch {
      toast.error('Failed to load location data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Multi-Location Management</p>
            <h1 className="mt-3 text-3xl font-semibold">Multi-Location Support</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Manage multiple business locations with unified reporting and inventory management.
            </p>
          </div>
        </section>

        {/* Current Location */}
        {tenant && (
          <section>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-3">Your Current Location</p>
            <Card className="glass-panel border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
                    <MapPin className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <div>{tenant.name}</div>
                    <div className="text-xs font-normal text-white/40">{tenant.slug}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Users className="h-5 w-5 text-blue-400" />
                    <p className="text-xl font-semibold text-white">{stats.employees}</p>
                    <p className="text-xs text-white/50">Employees</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Package className="h-5 w-5 text-green-400" />
                    <p className="text-xl font-semibold text-white">{stats.products}</p>
                    <p className="text-xs text-white/50">Products</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                    <p className="text-xl font-semibold text-white">{stats.customers}</p>
                    <p className="text-xs text-white/50">Customers</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/40">
                  Location active since {new Date(tenant.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Coming Soon */}
        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center">
          <MapPin className="mx-auto h-10 w-10 text-indigo-400 mb-3" />
          <h2 className="text-lg font-semibold text-white">Multiple Locations — Coming Soon</h2>
          <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
            Adding branches, warehouses, or satellite stores to your account is planned for a future release.
            Each location will have its own inventory, staff, and sales reports while sharing a unified
            analytics view. Contact KiTS to discuss your multi-location requirements.
          </p>
        </div>
      </div>
    </Layout>
  );
}
