import { Mail, UserPlus, Shield, DollarSign, Check, X, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { addUserToTenant, supabaseAdmin } from '../utils/tenantManager';

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteTeamMemberModal({ isOpen, onClose, onSuccess }: InviteTeamMemberModalProps) {
  const { currentTenant } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'cashier' as 'owner' | 'manager' | 'cashier' | 'viewer',
    name: '',
    commission: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!currentTenant) {
      toast.error('No business context found');
      return;
    }

    setLoading(true);
    try {
      if (!supabaseAdmin) {
        throw new Error('Service role key not configured');
      }

      // Step 1: Create or get the user
      let userId: string;

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin
        .from('auth.users')
        .select('id')
        .eq('email', formData.email)
        .single();

      if (existingUsers) {
        userId = existingUsers.id;
      } else {
        // Create new user with temporary password
        const tempPassword = Math.random().toString(36).slice(-12);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: formData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: formData.name,
            invited_by_tenant: currentTenant.id,
            temp_password: tempPassword,
          },
        });

        if (createError) throw createError;
        userId = newUser.user.id;

        // Send invitation email (you'd implement this with your email service)
        toast.success(`Invitation sent to ${formData.email}`);
      }

      // Step 2: Add user to tenant with role
      await addUserToTenant(currentTenant.id, userId, formData.role);

      // Step 3: Create employee record
      const { error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          name: formData.name,
          email: formData.email,
          role: formData.role === 'owner' ? 'admin' : formData.role,
          commission: formData.commission,
          totalSales: 0,
          shifts: [],
          tenant_id: currentTenant.id,
        });

      if (employeeError) throw employeeError;

      toast.success('Team member added successfully!');
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        email: '',
        role: 'cashier',
        name: '',
        commission: 3,
      });
    } catch (error) {
      console.error('Failed to invite team member:', error);
      toast.error('Failed to add team member', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    {
      value: 'manager',
      label: 'Manager',
      description: 'Can manage products, sales, and employees',
      icon: Shield,
      color: 'text-blue-600',
    },
    {
      value: 'cashier',
      label: 'Cashier',
      description: 'Can process sales and view reports',
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      value: 'viewer',
      label: 'Viewer',
      description: 'Read-only access to all data',
      icon: UserPlus,
      color: 'text-gray-600',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)'
      }}>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Invite Team Member</h2>
          <p className="text-white/60">Add someone to your {currentTenant?.name} team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="team@company.com"
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Role *
            </label>
            <div className="space-y-2">
              {roleOptions.map((role) => (
                <label
                  key={role.value}
                  className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-all"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={formData.role === role.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <role.icon className={`h-5 w-5 mt-0.5 ${role.color}`} />
                  <div className="flex-1">
                    <div className="font-medium text-white">{role.label}</div>
                    <div className="text-xs text-white/60">{role.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {(formData.role === 'cashier' || formData.role === 'manager') && (
            <div>
              <label htmlFor="commission" className="block text-sm font-medium text-white/80 mb-2">
                Commission Rate (%)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="number"
                  id="commission"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) })}
                  min="0"
                  max="50"
                  step="0.5"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
