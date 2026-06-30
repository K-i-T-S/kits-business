import { Building2, ChevronDown, Check, Users, Settings, ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';
import { getTenantsByUser } from '../utils/tenantManager';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  user_role: 'owner' | 'manager' | 'cashier' | 'viewer';
  tenant_active: boolean;
  user_active: boolean;
}

export default function TenantSwitcher() {
  const { currentTenant, switchTenant: switchTenantContext } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    void loadUserTenants();
  }, []);

  const loadUserTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tenants = await getTenantsByUser(user.id);
      setUserTenants(tenants || []);
    } catch (error) {
      console.error('Failed to load user tenants:', error);
    }
  };

  const handleTenantSwitch = (tenant: Tenant) => {
    if (tenant.id === currentTenant?.id) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Update frontend context
      switchTenantContext(tenant.id);

      toast.success(`Switched to ${tenant.name}`);
      setIsOpen(false);

      // Reload the page to ensure all data is refreshed
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      toast.error('Failed to switch business');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-purple-300 bg-purple-500/20 border border-purple-500/30';
      case 'manager':
        return 'text-blue-300 bg-blue-500/20 border border-blue-500/30';
      case 'cashier':
        return 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30';
      case 'viewer':
        return 'text-white/60 bg-white/10 border border-white/10';
      default:
        return 'text-white/60 bg-white/10 border border-white/10';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'manager':
        return 'Manager';
      case 'cashier':
        return 'Cashier';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  };

  if (!currentTenant || userTenants.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current Tenant Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
        disabled={loading}
      >
        <Building2 className="h-4 w-4 text-white/70" />
        <div className="flex-1 text-start">
          <div className="text-sm font-medium text-white">{currentTenant.name}</div>
          <div className="text-xs text-white/60">{getRoleLabel(currentTenant.userRole)}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Users className="h-4 w-4" />
                Your Businesses
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {userTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSwitch(tenant)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-all group ${
                    tenant.id === currentTenant.id ? 'bg-white/5' : ''
                  }`}
                  disabled={loading}
                >
                  <div className="flex-1 text-start">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-white">{tenant.name}</div>
                      {tenant.id === currentTenant.id && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(tenant.user_role)}`}>
                        {getRoleLabel(tenant.user_role)}
                      </span>
                      <span className="text-xs text-white/40">
                        {tenant.slug}
                      </span>
                    </div>
                  </div>

                  {tenant.id !== currentTenant.id && (
                    <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 transition-colors" />
                  )}
                </button>
              ))}
            </div>

            {userTenants.length === 0 && (
              <div className="p-6 text-center text-white/60">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No businesses found</div>
              </div>
            )}

            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <Settings className="h-4 w-4" />
                Manage Businesses
              </button>
            </div>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
