import {
  Mail,
  UserPlus,
  Shield,
  DollarSign,
  Users,
  Loader2,
  BookUser,
  Package,
  Eye,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { type RoleAction, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type StandardInviteRole =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'cashier'
  | 'accountant'
  | 'stockkeeper'
  | 'viewer';

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  base_role: 'manager' | 'cashier' | 'viewer';
  permissions: Partial<Record<RoleAction, boolean>>;
}

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Standard role option config ───────────────────────────────────────────────

const STANDARD_ROLES: Array<{
  value: StandardInviteRole;
  icon: React.ElementType;
  color: string;
}> = [
  { value: 'admin', icon: ShieldCheck, color: 'text-purple-300' },
  { value: 'manager', icon: Shield, color: 'text-blue-300' },
  { value: 'supervisor', icon: Users, color: 'text-cyan-300' },
  { value: 'cashier', icon: CreditCard, color: 'text-emerald-300' },
  { value: 'accountant', icon: BookUser, color: 'text-amber-300' },
  { value: 'stockkeeper', icon: Package, color: 'text-orange-300' },
  { value: 'viewer', icon: Eye, color: 'text-white/60' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteTeamMemberModal({
  isOpen,
  onClose,
  onSuccess,
}: InviteTeamMemberModalProps) {
  const { currentTenant } = useApp();
  const [loading, setLoading] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Selected role state — either a standard role slug or a custom role id
  const [selectedStandard, setSelectedStandard] = useState<StandardInviteRole>('cashier');
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    commission: 3,
  });

  // ── Load custom roles ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || !currentTenant) return;

    setLoadingCustom(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('custom_roles')
          .select('id, name, display_name, base_role, permissions')
          .order('display_name', { ascending: true });

        if (!error && data) {
          setCustomRoles(
            data.map((row: {
              id: string;
              name: string;
              display_name: string;
              base_role: string;
              permissions: unknown;
            }) => ({
              id: row.id,
              name: row.name,
              display_name: row.display_name,
              base_role: (['manager', 'cashier', 'viewer'].includes(row.base_role)
                ? row.base_role
                : 'viewer') as 'manager' | 'cashier' | 'viewer',
              permissions: (typeof row.permissions === 'object' && row.permissions !== null
                ? row.permissions
                : {}) as Partial<Record<RoleAction, boolean>>,
            })),
          );
        }
      } finally {
        setLoadingCustom(false);
      }
    })();
  }, [isOpen, currentTenant]);

  // ── Reset on open/close ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      setFormData({ email: '', name: '', commission: 3 });
      setSelectedStandard('cashier');
      setSelectedCustomId(null);
    }
  }, [isOpen]);

  // ── Submit ───────────────────────────────────────────────────────────────

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

    // Resolve the actual DB role and custom_role_id to send
    let dbRole: string = selectedStandard;
    let customRoleId: string | null = null;

    if (selectedCustomId) {
      const cr = customRoles.find((r) => r.id === selectedCustomId);
      if (cr) {
        dbRole = cr.base_role; // DB-level access
        customRoleId = cr.id;
      }
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { error: fnError } = await supabase.functions.invoke('send-invitation', {
        body: {
          inviteeEmail: formData.email,
          inviteeName: formData.name,
          role: dbRole,
          customRoleId,
          commission: formData.commission,
          tenantId: currentTenant.id,
          tenantName: currentTenant.name,
        },
      });

      if (fnError) throw fnError;

      toast.success(`Invitation sent to ${formData.email}`, {
        description: "They'll receive an email to set their password and join your team.",
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to invite team member:', error);
      toast.error('Failed to add team member', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const isCommissionRole =
    selectedCustomId === null &&
    (selectedStandard === 'cashier' || selectedStandard === 'manager');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl"
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(28px)',
          color: '#f8faff',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-2xl font-bold text-white mb-1">Invite Team Member</h2>
          <p className="text-white/60 text-sm">Add someone to your {currentTenant?.name} team</p>
        </div>

        {/* Scrollable form body */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="overflow-y-auto flex-1 px-6 pb-6 space-y-5"
        >
          {/* Full name */}
          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-white/80 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="invite-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-white/80 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="email"
                id="invite-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="team@company.com"
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                required
              />
            </div>
          </div>

          {/* Role selector — Standard roles */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">Role *</label>
            <div className="space-y-2">
              {STANDARD_ROLES.map(({ value, icon: Icon, color }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedCustomId === null && selectedStandard === value
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={value}
                    checked={selectedCustomId === null && selectedStandard === value}
                    onChange={() => {
                      setSelectedStandard(value);
                      setSelectedCustomId(null);
                    }}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">
                      {/* eslint-disable-next-line security/detect-object-injection */}
                      {ROLE_LABELS[value] ?? value}
                    </div>
                    <div className="text-xs text-white/60">
                      {/* eslint-disable-next-line security/detect-object-injection */}
                      {ROLE_DESCRIPTIONS[value] ?? ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Custom roles divider + list */}
            {(loadingCustom || customRoles.length > 0) && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-white/10" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Custom Roles</span>
                  <div className="flex-1 border-t border-white/10" />
                </div>

                {loadingCustom ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-white/40">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading custom roles…
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customRoles.map((cr) => (
                      <label
                        key={cr.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedCustomId === cr.id
                            ? 'border-indigo-500/40 bg-indigo-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="invite-role"
                          value={cr.id}
                          checked={selectedCustomId === cr.id}
                          onChange={() => setSelectedCustomId(cr.id)}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <UserPlus className="h-5 w-5 mt-0.5 text-indigo-300" />
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{cr.display_name}</div>
                          <div className="text-xs text-white/50">
                            Base: {cr.base_role} &middot;{' '}
                            {Object.values(cr.permissions).filter(Boolean).length} permissions
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Commission rate — only for cashier or manager standard roles */}
          {isCommissionRole && (
            <div>
              <label
                htmlFor="invite-commission"
                className="block text-sm font-medium text-white/80 mb-2"
              >
                Commission Rate (%)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="number"
                  id="invite-commission"
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

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Invitation…
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
