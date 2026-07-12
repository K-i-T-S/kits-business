import { KeyRound, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

interface CreatePinEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CustomRoleOption {
  id: string;
  display_name: string;
  base_role: string;
}

const STANDARD_ROLES = [
  'owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'stockkeeper', 'viewer',
];

/**
 * Track 1c (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * lets an owner/manager/admin create a real PIN-login account for staff
 * who won't use email/password — calls the create-pin-employee edge
 * function, which creates a genuine Supabase Auth account with the PIN
 * as its password (Option B — real session, not client-side attribution).
 */
export default function CreatePinEmployeeModal({ isOpen, onClose, onSuccess }: CreatePinEmployeeModalProps) {
  const { currentTenant } = useApp();
  const [name, setName] = useState('');
  const [roleSelection, setRoleSelection] = useState('cashier');
  const [customRoles, setCustomRoles] = useState<CustomRoleOption[]>([]);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentTenant) return;
    void (async () => {
      const { data } = await supabase
        .from('custom_roles')
        .select('id, display_name, base_role')
        .order('display_name', { ascending: true });
      setCustomRoles((data as CustomRoleOption[] | null) ?? []);
    })();
  }, [isOpen, currentTenant]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setRoleSelection('cashier');
      setPin('');
      setConfirmPin('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;

    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('PIN must be 4-6 digits');
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs don't match");
      return;
    }

    const isCustom = customRoles.some((cr) => cr.id === roleSelection);
    const role = isCustom ? customRoles.find((cr) => cr.id === roleSelection)!.base_role : roleSelection;
    const customRoleId = isCustom ? roleSelection : null;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('create-pin-employee', {
        body: { name, role, customRoleId, pin, tenantId: currentTenant.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      }) as { data: { success?: boolean; error?: string } | null; error: { message: string } | null };
      if (error || !data?.success) {
        throw new Error(data?.error ?? error?.message ?? 'Failed to create PIN employee');
      }
      toast.success(`${name} can now sign in with their PIN`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to create PIN employee', {
        description: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl"
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(28px)',
          color: '#f8faff',
        }}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-indigo-400" />
            <h2 className="text-2xl font-bold text-white">Add PIN Staff</h2>
          </div>
          <p className="text-white/60 text-sm">
            For staff who need fast terminal access, no email required.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 pb-6 space-y-5">
          <div>
            <label htmlFor="pin-emp-name" className="block text-sm font-medium text-white/80 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="pin-emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="pin-emp-role" className="block text-sm font-medium text-white/80 mb-2">
              Role *
            </label>
            <select
              id="pin-emp-role"
              value={roleSelection}
              onChange={(e) => setRoleSelection(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-white/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {currentTenant?.industry === 'restaurant' && customRoles.length > 0 && (
                <optgroup label="Job roles (Waiter, Kitchen, Argile...)">
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>{cr.display_name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Standard roles">
                {STANDARD_ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">{r}</option>
                ))}
              </optgroup>
              {!(currentTenant?.industry === 'restaurant') && customRoles.length > 0 && (
                <optgroup label="Custom roles">
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>{cr.display_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {currentTenant?.industry === 'restaurant' && (
              <p className="mt-1.5 text-xs text-white/40">
                Use a job role (Waiter, Kitchen, Argile...) unless this person is strictly a checkout cashier — "cashier" always opens straight to POS.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pin-emp-pin" className="block text-sm font-medium text-white/80 mb-2">
                PIN (4-6 digits) *
              </label>
              <input
                type="password"
                inputMode="numeric"
                id="pin-emp-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 tracking-widest"
                required
              />
            </div>
            <div>
              <label htmlFor="pin-emp-pin-confirm" className="block text-sm font-medium text-white/80 mb-2">
                Confirm PIN *
              </label>
              <input
                type="password"
                inputMode="numeric"
                id="pin-emp-pin-confirm"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 tracking-widest"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
