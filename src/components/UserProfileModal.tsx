import { User, Camera, Edit2, Save, X, Shield, Building2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { currentTenant, currentEmployee } = useApp();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentEmployee?.name || '',
    email: currentEmployee?.email || '',
    phone: '',
    bio: '',
    avatar_url: '',
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update user metadata in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: formData.name,
          phone: formData.phone,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
        },
      });

      if (authError) throw authError;

      // Update employee record if exists
      if (currentEmployee?.id) {
        try {
          const { error: employeeError } = await supabase
            .from('employees')
            .update({
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
            })
            .eq('id', currentEmployee.id);

          if (employeeError) throw employeeError;
        } catch (employeeError) {
          console.error('Employee update error:', employeeError);
        }
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const _handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: currentPassword,
      });

      if (signInError) throw signInError;

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Failed to update password:', error);
      toast.error('Failed to update password');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-md p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)',
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-indigo-600 flex items-center justify-center">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-white" />
              )}
            </div>
            <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-slate-900">
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{formData.name}</h3>
            <p className="text-sm text-white/60">{formData.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={currentTenant?.userRole || ''} />
              {currentTenant && (
                <div className="flex items-center gap-1 text-xs text-white/40">
                  <Building2 className="h-3 w-3" />
                  {currentTenant.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!isEditing}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isEditing}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              disabled={!isEditing}
              placeholder="Tell us about yourself..."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50 resize-none"
            />
          </div>
        </div>

        {/* Account Stats */}
        <div className="mt-6 p-4 bg-white/5 rounded-xl">
          <h4 className="text-sm font-medium text-white/80 mb-3">Account Information</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Member Since</span>
              <span className="text-white">
                {currentEmployee ? 'Active' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Role</span>
              <span className="text-white capitalize">{currentTenant?.userRole || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Business</span>
              <span className="text-white">{currentTenant?.name || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-white/20 text-white rounded-xl font-medium transition-all hover:bg-slate-700/50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for role badge
function RoleBadge({ role }: { role: string }) {
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'owner':
        return { color: 'bg-purple-500/20 text-purple-300 border border-purple-500/30', label: 'Owner' };
      case 'manager':
        return { color: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', label: 'Manager' };
      case 'cashier':
        return { color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', label: 'Cashier' };
      case 'viewer':
        return { color: 'bg-white/10 text-white/60 border border-white/10', label: 'Viewer' };
      default:
        return { color: 'bg-white/10 text-white/60 border border-white/10', label: role };
    }
  };

  const roleInfo = getRoleInfo(role);

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
      <Shield className="h-3 w-3 me-1" />
      {roleInfo.label}
    </span>
  );
}
