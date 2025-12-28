import { Building2, Plus, ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { supabase } from '../utils/supabaseClient';
import { createTenant } from '../utils/tenantManager';

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: string;
}

export default function TenantSelection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuthAndLoadTenants();
  }, []);

  const checkAuthAndLoadTenants = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }

    setCurrentUser(session.user);
    await loadUserTenants(session.user.id);
  };

  const loadUserTenants = async (userId: string) => {
    try {
      const { data: tenants, error } = await supabase
        .from('tenant_user_details')
        .select('*')
        .eq('user_id', userId)
        .eq('user_active', true)
        .eq('tenant_active', true);

      if (error) throw error;
      setUserTenants(tenants || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);

    try {
      const tenantId = await createTenant(tenantName, tenantSlug, currentUser.id);
      toast.success('Business created successfully!');

      await loadUserTenants(currentUser.id);
      setShowCreateForm(false);
      setTenantName('');
      setTenantSlug('');

      // Redirect to the new tenant
      navigate(`/app/${tenantSlug}/dashboard`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    navigate(`/app/${tenant.tenant_slug}/dashboard`);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTenantName(name);
    setTenantSlug(generateSlug(name));
  };

  // Auto-redirect effect
  useEffect(() => {
    if (userTenants.length === 1 && !showCreateForm && !redirecting) {
      const singleTenant = userTenants[0];
      if (singleTenant) {
        setRedirecting(true);
        handleSelectTenant(singleTenant);
      }
    }
  }, [userTenants, showCreateForm, redirecting]);

  if (userTenants.length === 1 && !showCreateForm && !redirecting) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Redirecting to your business...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 pb-20 lg:pb-0">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-12 w-12 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Choose Your Business</h1>
          <p className="text-gray-400">Select an existing business or create a new one</p>
        </div>

        {/* Existing Tenants */}
        {userTenants.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Your Businesses</h2>
            <div className="grid gap-4">
              {userTenants.map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-indigo-500 transition-colors cursor-pointer group"
                  onClick={() => handleSelectTenant(tenant)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                        {tenant.tenant_name}
                      </h3>
                      <p className="text-gray-400 text-sm">{tenant.tenant_slug}</p>
                      <p className="text-indigo-400 text-sm mt-1">Role: {tenant.user_role}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Tenant */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-3 text-white hover:text-indigo-400 transition-colors py-4"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Create New Business</span>
            </button>
          ) : (
            <form onSubmit={handleCreateTenant} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Create New Business</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={handleNameChange}
                  placeholder="My Business"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business URL (slug)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-gray-400 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg">
                    your-app.com/
                  </span>
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="my-business"
                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-r-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Creating...' : 'Create Business'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTenantName('');
                    setTenantSlug('');
                  }}
                  className="px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Sign Out */}
        <div className="text-center mt-8">
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
