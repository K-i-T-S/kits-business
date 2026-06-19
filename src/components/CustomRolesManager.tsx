import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { type RoleAction, ALL_PERMISSIONS } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomRole {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  permissions: Partial<Record<RoleAction, boolean>>;
  base_role: 'manager' | 'cashier' | 'viewer';
  created_at: string;
  updated_at: string;
}

interface FormState {
  display_name: string;
  name: string;
  base_role: 'manager' | 'cashier' | 'viewer';
  permissions: Partial<Record<RoleAction, boolean>>;
}

const BASE_ROLE_OPTIONS: Array<{
  value: 'manager' | 'cashier' | 'viewer';
  label: string;
  description: string;
}> = [
  { value: 'viewer', label: 'Viewer — read-only data', description: 'Can read data but not modify it' },
  { value: 'cashier', label: 'Cashier — sales data', description: 'Access to POS and sales records' },
  { value: 'manager', label: 'Manager — full operational data', description: 'Full data access, no admin settings' },
];

const BASE_ROLE_BADGE: Record<'manager' | 'cashier' | 'viewer', string> = {
  manager: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  cashier: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  viewer: 'bg-white/10 text-white/60 border border-white/20',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(display: string): string {
  return display
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const EMPTY_FORM: FormState = {
  display_name: '',
  name: '',
  base_role: 'viewer',
  permissions: {},
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomRolesManager() {
  const { currentTenant } = useApp();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Confirm delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Narrow the raw JSONB permissions field
      const typed: CustomRole[] = (data ?? []).map((row: {
        id: string;
        tenant_id: string;
        name: string;
        display_name: string;
        permissions: unknown;
        base_role: string;
        created_at: string;
        updated_at: string;
      }) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        name: row.name,
        display_name: row.display_name,
        permissions: (typeof row.permissions === 'object' && row.permissions !== null
          ? row.permissions
          : {}) as Partial<Record<RoleAction, boolean>>,
        base_role: (['manager', 'cashier', 'viewer'].includes(row.base_role)
          ? row.base_role
          : 'viewer') as 'manager' | 'cashier' | 'viewer',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setRoles(typed);
    } catch (err) {
      toast.error('Failed to load custom roles', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(role: CustomRole) {
    setEditingRole(role);
    setForm({
      display_name: role.display_name,
      name: role.name,
      base_role: role.base_role,
      permissions: { ...role.permissions },
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingRole(null);
    setForm(EMPTY_FORM);
  }

  function handleDisplayNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      display_name: value,
      // Auto-generate slug only when creating (not editing)
      name: editingRole ? prev.name : toSlug(value),
    }));
  }

  function togglePermission(action: RoleAction) {
    setForm((prev) => {
      // eslint-disable-next-line security/detect-object-injection
      const current = prev.permissions[action];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [action]: !current,
        },
      };
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!currentTenant) return;
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Role ID is required');
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        const { error } = await supabase
          .from('custom_roles')
          .update({
            display_name: form.display_name.trim(),
            name: form.name.trim(),
            base_role: form.base_role,
            permissions: form.permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('Role updated');
      } else {
        const { error } = await supabase
          .from('custom_roles')
          .insert({
            tenant_id: currentTenant.id,
            display_name: form.display_name.trim(),
            name: form.name.trim(),
            base_role: form.base_role,
            permissions: form.permissions,
          });

        if (error) throw error;
        toast.success('Custom role created');
      }

      closeModal();
      await loadRoles();
    } catch (err) {
      toast.error(editingRole ? 'Failed to update role' : 'Failed to create role', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Role deleted');
      setConfirmDeleteId(null);
      await loadRoles();
    } catch (err) {
      toast.error('Failed to delete role', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeleting(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const activePermissionCount = (perms: Partial<Record<RoleAction, boolean>>) =>
    Object.values(perms).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Custom Roles</h3>
          <p className="text-sm text-white/60 mt-0.5">
            Build tailored roles with fine-grained permission controls.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Role
        </button>
      </div>

      {/* Role list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-white/20 mb-4" />
          <p className="text-white font-medium mb-1">No custom roles yet</p>
          <p className="text-sm text-white/50">
            Create your first to give team members tailored access.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
            >
              {confirmDeleteId === role.id ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-white/80 flex-1">
                    Delete <span className="font-semibold text-white">{role.display_name}</span>? This
                    cannot be undone. Users assigned this role will lose their custom permissions.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleDelete(role.id)}
                      disabled={deleting === role.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {deleting === role.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{role.display_name}</span>
                      <span className="font-mono text-xs text-white/40">{role.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BASE_ROLE_BADGE[role.base_role]}`}
                      >
                        {role.base_role}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-white/50">
                      {activePermissionCount(role.permissions)} permission
                      {activePermissionCount(role.permissions) !== 1 ? 's' : ''} enabled
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(role)}
                      className="rounded-lg border border-white/20 bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label={`Edit ${role.display_name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(role.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 transition-colors"
                      aria-label={`Delete ${role.display_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl"
            style={{
              backgroundColor: 'rgba(11, 15, 36, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
              backdropFilter: 'blur(28px)',
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingRole ? 'Edit Role' : 'New Custom Role'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg border border-white/10 p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Display name */}
              <div>
                <label htmlFor="cr-display-name" className="block text-sm font-medium text-white/80 mb-2">
                  Display Name *
                </label>
                <input
                  id="cr-display-name"
                  type="text"
                  value={form.display_name}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="e.g. Delivery Driver"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>

              {/* Role ID / slug */}
              <div>
                <label htmlFor="cr-name" className="block text-sm font-medium text-white/80 mb-2">
                  Role ID <span className="text-white/40 font-normal">(auto-generated, editable)</span>
                </label>
                <input
                  id="cr-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. delivery_driver"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
                <p className="mt-1 text-xs text-white/40">
                  Lowercase letters, numbers, and underscores only.
                </p>
              </div>

              {/* Base access level */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Base Access Level *
                </label>
                <p className="text-xs text-white/40 mb-3">
                  Determines what data this role can access at the database level.
                </p>
                <div className="space-y-2">
                  {BASE_ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="radio"
                        name="cr-base-role"
                        value={opt.value}
                        checked={form.base_role === opt.value}
                        onChange={() => setForm((prev) => ({ ...prev, base_role: opt.value }))}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-medium text-white text-sm">{opt.label}</div>
                        <div className="text-xs text-white/50">{opt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permission toggles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-white/80">
                    Permissions
                  </label>
                  <span className="text-xs text-white/40">
                    {activePermissionCount(form.permissions)} / {ALL_PERMISSIONS.length} enabled
                  </span>
                </div>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(({ action, label, description }) => {
                    // eslint-disable-next-line security/detect-object-injection
                    const enabled = Boolean(form.permissions[action]);
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => togglePermission(action)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${
                          enabled
                            ? 'border-indigo-500/40 bg-indigo-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {/* Toggle indicator */}
                        <div
                          className={`shrink-0 mt-0.5 h-5 w-9 rounded-full transition-colors ${
                            enabled ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <div
                            className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm">{label}</div>
                          <div className="text-xs text-white/50">{description}</div>
                        </div>
                        {enabled ? (
                          <ChevronUp className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.display_name.trim() || !form.name.trim()}
                className="flex-1 rounded-xl btn-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRole ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
