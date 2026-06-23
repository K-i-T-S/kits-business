import {
  ArrowLeft,
  ChefHat,
  Copy,
  Download,
  Edit2,
  GripVertical,
  Image,
  Link,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  Wand2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { AIContentGeneratorModal } from '@/components/restaurant/AIContentGeneratorModal';
import { useApp } from '@/context/AppContext';
import type {
  BranchMenuOverride,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantTable,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Storage helpers ────────────────────────────────────────────────────────────

// Requires: Supabase Storage bucket 'menu-images' must be public.
// Create in Dashboard → Storage → New bucket → name: menu-images → Public: ON
async function uploadMenuPhoto(file: File, tenantId: string, itemId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${tenantId}/${itemId}.${ext}`;
  const { error } = await supabase.storage
    .from('menu-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('[uploadMenuPhoto]', error); return null; }
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLERGENS = ['gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'veg', 'vegan', 'halal'] as const;
type Allergen = typeof ALLERGENS[number];

const MEAL_TIMES = [
  { key: 'all_day', label: 'All Day' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
] as const;

const QR_PALETTES = [
  { key: 'dark-luxury', label: 'Dark Luxury', preview: 'bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30' },
  { key: 'beirut-night', label: 'Beirut Night', preview: 'bg-gradient-to-br from-indigo-950 to-purple-950 border-indigo-500/30' },
  { key: 'mediterranean', label: 'Mediterranean', preview: 'bg-gradient-to-br from-sky-900 to-blue-950 border-sky-400/30' },
  { key: 'lebanese-garden', label: 'Lebanese Garden', preview: 'bg-gradient-to-br from-emerald-950 to-green-900 border-emerald-500/30' },
  { key: 'classic-bistro', label: 'Classic Bistro', preview: 'bg-gradient-to-br from-stone-900 to-amber-950 border-amber-600/30' },
  { key: 'modern-minimal', label: 'Modern Minimal', preview: 'bg-gradient-to-br from-zinc-900 to-neutral-900 border-white/20' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface RestaurantBranchMin {
  id: string;
  name: string;
}

interface OrderLineItem {
  item: RestaurantMenuItem;
  qty: number;
  notes: string;
}

interface ItemFormState {
  name: string;
  name_ar: string;
  description: string;
  category_id: string;
  base_price_usd: string;
  cost_price_usd: string;
  photo_url: string;
  allergens: Allergen[];
  is_active: boolean;
  is_featured: boolean;
  active_breakfast: boolean;
  active_lunch: boolean;
  active_dinner: boolean;
}

const EMPTY_ITEM_FORM: ItemFormState = {
  name: '',
  name_ar: '',
  description: '',
  category_id: '',
  base_price_usd: '',
  cost_price_usd: '',
  photo_url: '',
  allergens: [],
  is_active: true,
  is_featured: false,
  active_breakfast: true,
  active_lunch: true,
  active_dinner: true,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function AllergenBadge({ a }: { a: Allergen }) {
  const icons: Record<Allergen, string> = {
    gluten: '🌾', dairy: '🥛', nuts: '🥜', shellfish: '🦐',
    eggs: '🥚', veg: '🥦', vegan: '🌿', halal: '☪️',
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
      {icons[a]} {a}
    </span>
  );
}

interface MenuItemCardProps {
  item: RestaurantMenuItem;
  branches: RestaurantBranchMin[];
  overrides: BranchMenuOverride[];
  onEdit: (item: RestaurantMenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailable: (item: RestaurantMenuItem) => void;
}

function MenuItemCard({ item, branches, overrides, onEdit, onDelete, onToggleAvailable }: MenuItemCardProps) {
  // Count how many branches have this item disabled
  const disabledCount = branches.length > 1
    ? overrides.filter(o => o.menu_item_id === item.id && !o.is_available).length
    : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/3 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-amber-500/25 hover:shadow-2xl hover:shadow-amber-500/8 hover:-translate-y-0.5">
      {/* Photo area */}
      <div className="relative h-32 overflow-hidden bg-white/5">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40">🍽️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
        {item.is_featured && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            ⭐ Featured
          </span>
        )}
        {item.is_eighty_sixd && (
          <span className="absolute right-2 top-2 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            86'd
          </span>
        )}
        {disabledCount > 0 && (
          <span className="absolute bottom-2 left-2 rounded-full border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur-sm">
            {disabledCount}/{branches.length} branches
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            {item.name_ar && (
              <p className="truncate text-xs text-white/40" dir="rtl">{item.name_ar}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-bold text-emerald-400">${item.base_price_usd.toFixed(2)}</span>
        </div>

        {item.allergens.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {item.allergens.slice(0, 3).map(a => <AllergenBadge key={a} a={a as Allergen} />)}
            {item.allergens.length > 3 && (
              <span className="text-[10px] text-white/40">+{item.allergens.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="mt-auto flex items-center justify-between">
          <button
            onClick={() => onToggleAvailable(item)}
            className={`h-6 w-11 rounded-full border transition-all ${
              item.is_active
                ? 'border-emerald-500/50 bg-emerald-500/30'
                : 'border-white/20 bg-white/10'
            }`}
            aria-label={item.is_active ? 'Disable item' : 'Enable item'}
          >
            <span className={`block h-4 w-4 rounded-full transition-transform ${
              item.is_active
                ? 'translate-x-6 bg-emerald-400'
                : 'translate-x-1 bg-white/30'
            }`} />
          </button>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(item)}
              className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-indigo-400 transition-colors"
              aria-label="Edit item"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              aria-label="Delete item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Item Form Modal ────────────────────────────────────────────────────────────

interface ItemFormModalProps {
  item: RestaurantMenuItem | null;
  categories: RestaurantMenuCategory[];
  branches: RestaurantBranchMin[];
  overrides: BranchMenuOverride[];
  onClose: () => void;
  onSave: () => void;
}

function ItemFormModal({ item, categories, branches, overrides, onClose, onSave }: ItemFormModalProps) {
  const { currentTenant } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ItemFormState>(() => {
    if (!item) return EMPTY_ITEM_FORM;
    return {
      name: item.name,
      name_ar: item.name_ar ?? '',
      description: item.description ?? '',
      category_id: item.category_id ?? '',
      base_price_usd: String(item.base_price_usd),
      cost_price_usd: item.cost_price_usd !== null && item.cost_price_usd !== undefined ? String(item.cost_price_usd) : '',
      photo_url: item.photo_url ?? '',
      allergens: (item.allergens ?? []) as Allergen[],
      is_active: item.is_active,
      is_featured: item.is_featured,
      active_breakfast: item.active_breakfast,
      active_lunch: item.active_lunch,
      active_dinner: item.active_dinner,
    };
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [togglingBranch, setTogglingBranch] = useState<string | null>(null);
  // Local shadow of overrides for this item so toggles are instant
  const [localOverrides, setLocalOverrides] = useState<BranchMenuOverride[]>(() =>
    item ? overrides.filter(o => o.menu_item_id === item.id) : [],
  );

  const isBranchAvailable = (branchId: string): boolean => {
    const ov = localOverrides.find(o => o.branch_id === branchId);
    return ov === undefined ? true : ov.is_available;
  };

  const handleToggleBranch = async (branchId: string) => {
    if (!item || !currentTenant?.id) return;
    const currentlyAvailable = isBranchAvailable(branchId);
    setTogglingBranch(branchId);
    try {
      if (currentlyAvailable) {
        // Disable: upsert override with is_available = false
        const upsertRes = await supabase
          .from('restaurant_menu_items_branch_overrides')
          .upsert(
            {
              tenant_id: currentTenant.id,
              branch_id: branchId,
              menu_item_id: item.id,
              is_available: false,
            },
            { onConflict: 'tenant_id,branch_id,menu_item_id' },
          )
          .select()
          .single();
        if (upsertRes.error) throw upsertRes.error;
        setLocalOverrides(prev => {
          const without = prev.filter(o => o.branch_id !== branchId);
          const row = upsertRes.data as BranchMenuOverride | null;
          return row ? [...without, row] : without;
        });
      } else {
        // Enable: delete the override row
        const { error } = await supabase
          .from('restaurant_menu_items_branch_overrides')
          .delete()
          .eq('tenant_id', currentTenant.id)
          .eq('branch_id', branchId)
          .eq('menu_item_id', item.id);
        if (error) throw error;
        setLocalOverrides(prev => prev.filter(o => o.branch_id !== branchId));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update branch availability');
    } finally {
      setTogglingBranch(null);
    }
  };

  const toggleAllergen = (a: Allergen) => {
    setForm(f => ({
      ...f,
      allergens: f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a],
    }));
  };

  const handleAIGenerate = (descriptions: { en: string; ar: string }) => {
    setForm(f => ({
      ...f,
      description: descriptions.en,
    }));
    toast.success('Description updated! Arabic version: ' + descriptions.ar);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTenant?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are supported');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      // Use item id if editing; fall back to a temp key for new items
      const itemId = item?.id ?? `new-${Date.now()}`;
      const publicUrl = await uploadMenuPhoto(file, currentTenant.id, itemId);

      if (publicUrl) {
        setForm(f => ({ ...f, photo_url: publicUrl }));
        toast.success('Photo uploaded successfully');
      } else {
        toast.error('Failed to upload photo — check bucket permissions');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_price_usd) {
      toast.error('Name and price are required');
      return;
    }
    if (!currentTenant?.id) { toast.error('No active tenant'); return; }
    setSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant.id,
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        description: form.description.trim() || null,
        photo_url: form.photo_url.trim() || null,
        category_id: form.category_id || null,
        base_price_usd: parseFloat(form.base_price_usd) || 0,
        cost_price_usd: form.cost_price_usd ? parseFloat(form.cost_price_usd) : null,
        allergens: form.allergens,
        is_active: form.is_active,
        is_featured: form.is_featured,
        active_breakfast: form.active_breakfast,
        active_lunch: form.active_lunch,
        active_dinner: form.active_dinner,
      };
      if (item) {
        const { error } = await supabase.from('restaurant_menu_items').update(payload).eq('id', item.id);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase.from('restaurant_menu_items').insert(payload);
        if (error) throw error;
        toast.success('Item added');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-slate-900 shadow-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">Photo</label>
            <div className="space-y-3">
              {/* Upload area */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-white/5 py-6 text-sm font-medium text-white/60 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-white transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4" />
                    <span>Click or drag to upload<br /><span className="text-xs font-normal text-white/40">Max 2MB · JPG, PNG, WebP</span></span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { void handlePhotoUpload(e); }}
                className="hidden"
                aria-label="Upload photo"
              />
              {form.photo_url && (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={form.photo_url} alt="Preview" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Name (EN) *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                placeholder="e.g. Grilled Sea Bass"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">الاسم (AR)</label>
              <input
                dir="rtl"
                value={form.name_ar}
                onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                placeholder="سمك باس مشوي"
              />
            </div>
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Price (USD) *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.base_price_usd}
                onChange={e => setForm(f => ({ ...f, base_price_usd: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Cost price */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Cost Price (USD) — for food cost %</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.cost_price_usd}
              onChange={e => setForm(f => ({ ...f, cost_price_usd: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
              placeholder="0.00 (optional)"
            />
          </div>

          {/* Description */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-white/60">Description</label>
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                disabled={!form.name.trim()}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Generate description with AI"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Generate with AI
              </button>
            </div>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
              placeholder="Brief description of the dish..."
            />
          </div>

          {/* Meal time */}
          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">Served During</label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TIMES.map(mt => {
                const isAll = mt.key === 'all_day';
                const checked = isAll
                  ? form.active_breakfast && form.active_lunch && form.active_dinner
                  : form[`active_${mt.key}` as keyof ItemFormState] as boolean;
                return (
                  <button
                    key={mt.key}
                    type="button"
                    onClick={() => {
                      if (isAll) {
                        const all = form.active_breakfast && form.active_lunch && form.active_dinner;
                        setForm(f => ({ ...f, active_breakfast: !all, active_lunch: !all, active_dinner: !all }));
                      } else {
                        const key = `active_${mt.key}` as 'active_breakfast' | 'active_lunch' | 'active_dinner';
                        setForm(f => ({ ...f, [key]: !f[key] }));
                      }
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                      checked
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {mt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">Allergens & Dietary</label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                    form.allergens.includes(a)
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-4">
            {([
              { key: 'is_active', label: 'Available' },
              { key: 'is_featured', label: 'Featured' },
            ] as const).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  className={`h-5 w-9 rounded-full border transition-all cursor-pointer ${
                    form[key]
                      ? 'border-indigo-500/50 bg-indigo-500/40'
                      : 'border-white/20 bg-white/10'
                  }`}
                >
                  <span className={`block h-3.5 w-3.5 rounded-full mt-[2px] transition-transform ${
                    form[key] ? 'translate-x-4 bg-indigo-400' : 'translate-x-0.5 bg-white/30'
                  }`} />
                </div>
                <span className="text-xs text-white/60">{label}</span>
              </label>
            ))}
          </div>

          {/* Branch Availability — only shown when editing an existing item with 2+ branches */}
          {item && branches.length > 1 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-white/60">Branch Availability</label>
              <div className="space-y-1.5">
                {branches.map(branch => {
                  const available = isBranchAvailable(branch.id);
                  const isToggling = togglingBranch === branch.id;
                  return (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="text-sm text-white/80">{branch.name}</span>
                      <button
                        type="button"
                        onClick={() => { void handleToggleBranch(branch.id); }}
                        disabled={isToggling}
                        className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition-all disabled:opacity-50 ${
                          available
                            ? 'border-emerald-500/50 bg-emerald-500/30'
                            : 'border-white/20 bg-white/10'
                        }`}
                        aria-label={available ? `Disable at ${branch.name}` : `Enable at ${branch.name}`}
                      >
                        <span className={`block h-4 w-4 rounded-full transition-transform ${
                          available ? 'translate-x-6 bg-emerald-400' : 'translate-x-1 bg-white/30'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-white/30">
                Toggle OFF to hide this item at a specific branch only
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-4 flex-shrink-0">
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {item ? 'Save Changes' : 'Add to Menu'}
          </button>
        </div>
      </div>

      {/* AI Content Generator Modal */}
      {showAIModal && (
        <AIContentGeneratorModal
          itemName={form.name}
          onGenerate={handleAIGenerate}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </div>
  );
}

// ── Tab 1: Menu Builder ────────────────────────────────────────────────────────

interface MenuBuilderProps {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  onRefresh: () => void;
}

function MenuBuilder({ categories, items, onRefresh }: MenuBuilderProps) {
  const { currentTenant } = useApp();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RestaurantMenuItem | null | undefined>(undefined);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<RestaurantBranchMin[]>([]);
  const [overrides, setOverrides] = useState<BranchMenuOverride[]>([]);

  const displayedItems = items.filter(i => {
    const matchesCat = selectedCategoryId ? i.category_id === selectedCategoryId : true;
    const matchesSearch = search
      ? i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.name_ar ?? '').includes(search)
      : true;
    return matchesCat && matchesSearch;
  });

  // Load branches + overrides eagerly when the builder mounts
  useEffect(() => {
    if (!currentTenant?.id) return;
    void (async () => {
      const tenantId = currentTenant.id;
      const [branchRes, overrideRes] = await Promise.all([
        supabase
          .from('restaurant_branches')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('restaurant_menu_items_branch_overrides')
          .select('id, tenant_id, branch_id, menu_item_id, is_available, price_override_usd')
          .eq('tenant_id', tenantId),
      ]);
      setBranches((branchRes.data ?? []) as RestaurantBranchMin[]);
      setOverrides((overrideRes.data ?? []) as BranchMenuOverride[]);
    })();
  }, [currentTenant?.id]);

  // Refresh overrides after item modal saves (so badges update)
  const refreshOverrides = async () => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('restaurant_menu_items_branch_overrides')
      .select('id, tenant_id, branch_id, menu_item_id, is_available, price_override_usd')
      .eq('tenant_id', currentTenant.id);
    setOverrides((data ?? []) as BranchMenuOverride[]);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !currentTenant?.id) return;
    setSavingCat(true);
    const { error } = await supabase.from('restaurant_menu_categories').insert({
      tenant_id: currentTenant.id,
      name: newCatName.trim(),
      icon: '🍽️',
      sort_order: categories.length,
    });
    setSavingCat(false);
    if (error) { toast.error(error.message); return; }
    setNewCatName('');
    setAddingCat(false);
    onRefresh();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Items will become uncategorized.')) return;
    const { error } = await supabase.from('restaurant_menu_categories').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (selectedCategoryId === id) setSelectedCategoryId(null);
    onRefresh();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;
    const { error } = await supabase.from('restaurant_menu_items').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    onRefresh();
  };

  const handleToggleAvailable = async (item: RestaurantMenuItem) => {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    onRefresh();
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left: Category panel */}
      <div className="w-56 flex-shrink-0 space-y-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">Categories</p>
          <button
            onClick={() => setAddingCat(true)}
            className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-indigo-400 transition-colors"
            aria-label="Add category"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {addingCat && (
          <div className="mb-2 flex gap-1">
            <input
              autoFocus
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAddCategory(); if (e.key === 'Escape') setAddingCat(false); }}
              className="flex-1 rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
              placeholder="Category name..."
            />
            <button
              onClick={() => { void handleAddCategory(); }}
              disabled={savingCat}
              className="rounded-lg bg-indigo-600 px-2 py-1.5 text-xs text-white disabled:opacity-60"
            >
              {savingCat ? '...' : 'Add'}
            </button>
          </div>
        )}

        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
            selectedCategoryId === null
              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
              : 'border border-transparent text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <span>🍽️</span>
            <span>All Items</span>
            <span className="ml-auto text-xs opacity-60">{items.length}</span>
          </span>
        </button>

        {categories.map(cat => (
          <div key={cat.id} className="group relative">
            <button
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                selectedCategoryId === cat.id
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                  : 'border border-transparent text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 opacity-30" />
                <span>{cat.icon} {cat.name}</span>
                <span className="ml-auto text-xs opacity-60">
                  {items.filter(i => i.category_id === cat.id).length}
                </span>
              </span>
            </button>
            <button
              onClick={() => void handleDeleteCategory(cat.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/0 group-hover:text-red-400/60 hover:text-red-400 transition-colors"
              aria-label="Delete category"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Right: Items grid */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:border-indigo-500/30 focus:outline-none"
              placeholder="Search items..."
            />
          </div>
          <button
            onClick={() => setEditingItem(null)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

        {displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 py-16 text-center">
            <UtensilsCrossed className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">No menu items yet</p>
            <p className="mt-1 text-xs text-white/25">Click "Add Item" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {displayedItems.map(item => (
              <MenuItemCard
                key={item.id}
                item={item}
                branches={branches}
                overrides={overrides}
                onEdit={setEditingItem}
                onDelete={(id) => { void handleDeleteItem(id); }}
                onToggleAvailable={(it) => { void handleToggleAvailable(it); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Item modal */}
      {editingItem !== undefined && (
        <ItemFormModal
          item={editingItem}
          categories={categories}
          branches={branches}
          overrides={overrides}
          onClose={() => setEditingItem(undefined)}
          onSave={() => { void refreshOverrides(); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Tab 2: Waiter Order Panel ──────────────────────────────────────────────────

interface WaiterOrderPanelProps {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
}

function WaiterOrderPanel({ categories, items }: WaiterOrderPanelProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  const [sending, setSending] = useState(false);
  const notesRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('number');
      setTables((data ?? []) as RestaurantTable[]);
    })();
  }, []);

  // When table selected, check for existing open order
  useEffect(() => {
    if (!selectedTableId) { setExistingOrderId(null); return; }
    void (async () => {
      const { data } = await supabase
        .from('table_orders')
        .select('id')
        .eq('table_id', selectedTableId)
        .eq('status', 'open')
        .limit(1);
      setExistingOrderId((data ?? [])[0]?.id ?? null);
    })();
  }, [selectedTableId]);

  const displayedItems = items.filter(i => {
    if (!i.is_active) return false;
    const matchesCat = selectedCatId === 'all' || i.category_id === selectedCatId;
    const matchesSearch = search
      ? i.name.toLowerCase().includes(search.toLowerCase()) || (i.name_ar ?? '').includes(search)
      : true;
    return matchesCat && matchesSearch;
  });

  const addToOrder = (item: RestaurantMenuItem) => {
    setOrderLines(prev => {
      const existing = prev.find(l => l.item.id === item.id);
      if (existing) return prev.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { item, qty: 1, notes: '' }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setOrderLines(prev => prev
      .map(l => l.item.id === itemId ? { ...l, qty: Math.max(0, l.qty + delta) } : l)
      .filter(l => l.qty > 0),
    );
  };

  const updateNotes = (itemId: string, notes: string) => {
    setOrderLines(prev => prev.map(l => l.item.id === itemId ? { ...l, notes } : l));
  };

  const orderTotal = orderLines.reduce((s, l) => s + l.item.base_price_usd * l.qty, 0);

  const sendToKDS = async () => {
    if (!selectedTableId) { toast.error('Please select a table'); return; }
    if (orderLines.length === 0) { toast.error('Order is empty'); return; }
    setSending(true);
    try {
      let orderId = existingOrderId;
      if (!orderId) {
        const { data, error } = await supabase
          .from('table_orders')
          .insert({ table_id: selectedTableId, status: 'open', current_course: 'mains' })
          .select('id')
          .single();
        if (error || !data) throw error ?? new Error('Failed to create order');
        orderId = (data as { id: string }).id;
        setExistingOrderId(orderId);
      }
      const orderItems = orderLines.map(l => ({
        order_id: orderId,
        menu_item_id: l.item.id,
        product_name: l.item.name,
        quantity: l.qty,
        unit_price: l.item.base_price_usd,
        course: 'mains',
        status: 'pending',
        notes: l.notes || null,
        modifiers: [],
      }));
      const { error: itemsErr } = await supabase.from('restaurant_order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;
      toast.success(`Order sent to kitchen — Table ${tables.find(t => t.id === selectedTableId)?.number ?? '?'}`);
      setOrderLines([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send order');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left: Item browser */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Table selector */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <select
              value={selectedTableId}
              onChange={e => setSelectedTableId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/20 bg-slate-800 py-3 pl-4 pr-8 text-sm font-semibold text-white focus:border-indigo-500/50 focus:outline-none"
            >
              <option value="">Select table…</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  Table {t.number}{t.name ? ` — ${t.name}` : ''} · {t.section} {t.status !== 'available' ? '🔴' : '🟢'}
                </option>
              ))}
            </select>
          </div>
          {existingOrderId && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300">
              Open tab — adding to existing order
            </span>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCatId('all')}
            className={`flex-shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              selectedCatId === 'all'
                ? 'border border-amber-500/30 bg-amber-500/15 text-amber-200 shadow-lg shadow-amber-500/10'
                : 'border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`flex-shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                selectedCatId === cat.id
                  ? 'border border-amber-500/30 bg-amber-500/15 text-amber-200 shadow-lg shadow-amber-500/10'
                  : 'border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:border-indigo-500/30 focus:outline-none"
            placeholder="Quick search…"
          />
        </div>

        {/* Items grid — large touch-friendly */}
        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
          {displayedItems.map(item => (
            <button
              key={item.id}
              onClick={() => addToOrder(item)}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/8 to-white/3 text-left transition-all active:scale-95 hover:border-indigo-500/40 hover:from-indigo-500/15 hover:to-indigo-500/5 min-h-[44px]"
            >
              {/* Photo */}
              <div className="relative h-20 overflow-hidden bg-white/5">
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl opacity-30">🍽️</div>
                )}
                {/* Qty badge if in order */}
                {orderLines.find(l => l.item.id === item.id) && (
                  <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {orderLines.find(l => l.item.id === item.id)?.qty ?? 0}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-white leading-tight">{item.name}</p>
                <p className="mt-0.5 text-xs font-bold text-emerald-400">${item.base_price_usd.toFixed(2)}</p>
              </div>
            </button>
          ))}
          {displayedItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-white/30">No items found</div>
          )}
        </div>
      </div>

      {/* Right: Running order */}
      <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <ShoppingCart className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Order</h3>
          {orderLines.length > 0 && (
            <span className="ml-auto text-xs text-white/40">{orderLines.reduce((s, l) => s + l.qty, 0)} items</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="mb-2 h-8 w-8 text-white/15" />
              <p className="text-xs text-white/30">Tap items to add</p>
            </div>
          ) : (
            orderLines.map(line => (
              <div key={line.item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-white leading-tight">{line.item.name}</p>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">
                    ${(line.item.base_price_usd * line.qty).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(line.item.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="Decrease"
                  >
                    <span className="text-sm font-bold">−</span>
                  </button>
                  <span className="w-5 text-center text-sm font-semibold text-white">{line.qty}</span>
                  <button
                    onClick={() => updateQty(line.item.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="Increase"
                  >
                    <span className="text-sm font-bold">+</span>
                  </button>
                </div>
                <input
                  ref={el => { if (el) notesRefs.current.set(line.item.id, el); }}
                  value={line.notes}
                  onChange={e => updateNotes(line.item.id, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80 placeholder-white/25 focus:border-indigo-500/30 focus:outline-none"
                  placeholder="Notes (no onion, extra sauce…)"
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-3">
          {orderLines.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-white/50">Total</span>
              <span className="text-base font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">${orderTotal.toFixed(2)}</span>
            </div>
          )}
          <button
            onClick={() => { void sendToKDS(); }}
            disabled={sending || orderLines.length === 0 || !selectedTableId}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to Kitchen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table QR Codes Section ─────────────────────────────────────────────────────

interface TableQRSectionProps {
  tenantId: string;
  tenantSlug: string;
}

function TableQRSection({ tenantId, tenantSlug }: TableQRSectionProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const loadTables = useCallback(async () => {
    if (!tenantId) return;
    setLoadingTables(true);
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('id, number, section, status, name, tenant_id, seats, x, y')
      .eq('tenant_id', tenantId)
      .order('number');
    if (error) { toast.error(error.message); }
    setTables((data ?? []) as RestaurantTable[]);
    setLoadingTables(false);
  }, [tenantId]);

  useEffect(() => { void loadTables(); }, [loadTables]);

  // Render QR codes into canvases after tables load
  useEffect(() => {
    if (loadingTables || tables.length === 0) return;
    // Give DOM a tick to mount canvases
    const id = setTimeout(() => {
      tables.forEach(table => {
        const canvas = canvasRefs.current.get(table.id);
        if (!canvas) return;
        const url = `${window.location.origin}/menu/${tenantSlug}/${table.id}`;
        void QRCode.toCanvas(canvas, url, {
          width: 160,
          margin: 1,
          color: { dark: '#ffffff', light: '#1e293b' },
        });
      });
    }, 50);
    return () => clearTimeout(id);
  }, [tables, loadingTables, tenantSlug]);

  const downloadQR = (tableId: string, tableNumber: number) => {
    const canvas = canvasRefs.current.get(tableId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `table-${tableNumber}-qr.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const copyTableUrl = async (tableId: string) => {
    const url = `${window.location.origin}/menu/${tenantSlug}/${tableId}`;
    await navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const handlePrintAll = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Could not open print window — check popup blocker'); return; }

    const cards = tables.map(table => {
      const canvas = canvasRefs.current.get(table.id);
      const dataUrl = canvas ? canvas.toDataURL() : '';
      const label = table.section !== 'indoor'
        ? `Table ${table.number} · ${table.section.charAt(0).toUpperCase() + table.section.slice(1)}`
        : `Table ${table.number}`;
      return `
        <div class="card">
          ${dataUrl ? `<img src="${dataUrl}" alt="QR Table ${table.number}" />` : '<div class="qr-placeholder">QR</div>'}
          <p>${label}</p>
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Table QR Codes</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: sans-serif; margin: 0; padding: 0; background: #fff; }
    h1 { font-size: 14px; color: #333; margin: 0 0 12px; text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .card { display: flex; flex-direction: column; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
    .card img { width: 120px; height: 120px; }
    .qr-placeholder { width: 120px; height: 120px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; }
    .card p { margin: 8px 0 0; font-size: 11px; font-weight: 600; color: #1e293b; text-align: center; }
  </style>
</head>
<body>
  <h1>Table QR Codes</h1>
  <div class="grid">${cards}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const getTableLabel = (table: RestaurantTable) =>
    table.section !== 'indoor'
      ? `Table ${table.number} · ${table.section.charAt(0).toUpperCase() + table.section.slice(1)}`
      : `Table ${table.number}`;

  if (loadingTables) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Table QR Codes</h3>
          <p className="mt-0.5 text-xs text-white/40">
            Print individual QR codes for each table — guests scan to order directly from their seat
          </p>
        </div>
        {tables.length > 0 && (
          <button
            onClick={handlePrintAll}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print All
          </button>
        )}
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 py-12 text-center">
          <QrCode className="mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">No tables found</p>
          <p className="mt-1 text-xs text-white/25">
            Add tables in{' '}
            <a href="/restaurant/tables" className="text-indigo-400 hover:underline">
              Table Management
            </a>{' '}
            first
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map(table => (
            <div
              key={table.id}
              className="flex flex-col items-center rounded-xl border border-white/10 bg-slate-800/50 p-4 text-center"
            >
              {/* QR canvas */}
              <div className="mb-3 overflow-hidden rounded-lg bg-slate-700/60 p-1">
                <canvas
                  ref={el => {
                    if (el) canvasRefs.current.set(table.id, el);
                    else canvasRefs.current.delete(table.id);
                  }}
                  width={160}
                  height={160}
                />
              </div>

              {/* Table label */}
              <p className="mb-3 text-sm font-semibold text-white">{getTableLabel(table)}</p>

              {/* Actions */}
              <div className="flex w-full gap-2">
                <button
                  onClick={() => downloadQR(table.id, table.number)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label={`Download QR for Table ${table.number}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  onClick={() => { void copyTableUrl(table.id); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label={`Copy URL for Table ${table.number}`}
                >
                  <Link className="h-3.5 w-3.5" />
                  Copy URL
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: QR Menu Settings ────────────────────────────────────────────────────

interface QRMenuSettingsProps {
  items: RestaurantMenuItem[];
  onRefresh: () => void;
}

function QRMenuSettings({ items, onRefresh }: QRMenuSettingsProps) {
  const { currentTenant } = useApp();
  const tenantSlug = currentTenant?.slug ?? '';
  const tenantId = currentTenant?.id ?? '';
  const qrBase = `${window.location.origin}/menu/${tenantSlug}`;

  // Per-table QR URL selector
  const [qrTableId, setQrTableId] = useState<string>('');
  const [qrTables, setQrTables] = useState<RestaurantTable[]>([]);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load tables for the dropdown
  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      const { data } = await supabase
        .from('restaurant_tables')
        .select('id, number, section, status, name, tenant_id, seats, x, y')
        .eq('tenant_id', tenantId)
        .order('number');
      setQrTables((data ?? []) as RestaurantTable[]);
    })();
  }, [tenantId]);

  // Compute the QR URL (base + optional ?table=N)
  const selectedTable = qrTables.find(t => t.id === qrTableId);
  const qrPreviewUrl = selectedTable
    ? `${qrBase}/main?table=${selectedTable.number}`
    : `${qrBase}/main`;

  // Render QR into preview canvas whenever URL changes
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, qrPreviewUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#ffffff', light: '#1e293b' },
    });
  }, [qrPreviewUrl]);

  const handleCopyUrl = async (tableNum?: number) => {
    const url = tableNum ? `${qrBase}/table-${tableNum}` : `${qrBase}/main`;
    await navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const handleToggleItemQR = async (item: RestaurantMenuItem) => {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    onRefresh();
  };

  const currentPalette = currentTenant?.qr_menu_palette ?? 'dark-luxury';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Palette preview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white/70">Current QR Menu Theme</h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {QR_PALETTES.map(p => (
            <div
              key={p.key}
              className={`relative rounded-xl border p-3 text-center ${p.preview} ${
                p.key === currentPalette ? 'ring-2 ring-indigo-400' : 'opacity-60'
              }`}
            >
              <p className="text-[10px] font-semibold text-white leading-tight">{p.label}</p>
              {p.key === currentPalette && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white font-bold">✓</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/30">
          Change theme in Restaurant Settings → QR Menu Palette
        </p>
      </div>

      {/* Per-table QR generator */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-white/70">Generate Table QR</h3>
        <p className="mb-3 text-xs text-white/30">
          Select a table to generate a QR code that pre-selects it when guests scan
        </p>
        <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4 space-y-4">
          {/* Table dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              Pre-select table (optional)
            </label>
            <select
              value={qrTableId}
              onChange={e => setQrTableId(e.target.value)}
              className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 w-full text-sm focus:border-indigo-500/50 focus:outline-none"
            >
              <option value="">— Main menu (no table) —</option>
              {qrTables.map(t => (
                <option key={t.id} value={t.id}>
                  Table {t.number}{t.name ? ` — ${t.name}` : ''}{t.section !== 'indoor' ? ` · ${t.section}` : ''}
                </option>
              ))}
            </select>
            {selectedTable && (
              <p className="mt-1.5 text-[11px] text-amber-400/70">
                Scan this QR to auto-select Table {selectedTable.number}
              </p>
            )}
          </div>

          {/* URL display */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="flex-1 truncate text-xs text-white/50">{qrPreviewUrl}</p>
            <button
              onClick={() => { void navigator.clipboard.writeText(qrPreviewUrl).then(() => toast.success('URL copied')); }}
              className="flex-shrink-0 flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>

          {/* QR preview canvas */}
          <div className="flex flex-col items-center gap-3">
            <div className="overflow-hidden rounded-xl bg-slate-700/60 p-2">
              <canvas ref={qrCanvasRef} width={200} height={200} />
            </div>
            <button
              onClick={() => {
                const canvas = qrCanvasRef.current;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = selectedTable ? `table-${selectedTable.number}-qr.png` : 'menu-qr.png';
                link.href = canvas.toDataURL();
                link.click();
              }}
              className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download QR
            </button>
          </div>
        </div>
      </div>

      {/* QR URLs */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white/70">QR Menu URLs</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 backdrop-blur-sm bg-gradient-to-br from-white/8 to-white/3 shadow-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Main Menu URL</p>
              <p className="mt-0.5 text-xs text-white/40 truncate">{qrBase}/main</p>
            </div>
            <button
              onClick={() => { void handleCopyUrl(); }}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex items-center justify-between rounded-xl border border-white/10 backdrop-blur-sm bg-gradient-to-br from-white/6 to-white/2 px-4 py-2">
              <p className="text-sm text-white/60">Table {n}</p>
              <button
                onClick={() => { void handleCopyUrl(n); }}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Copy className="h-3 w-3" />
                {`/table-${n}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Items QR visibility */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white/70">Item Visibility on QR Menu</h3>
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 backdrop-blur-sm bg-gradient-to-br from-white/6 to-white/2 px-4 py-2.5 hover:border-amber-500/20 transition-colors">
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{item.name}</p>
                <p className="text-xs text-white/40">${item.base_price_usd.toFixed(2)}</p>
              </div>
              <button
                onClick={() => void handleToggleItemQR(item)}
                className={`ml-4 h-6 w-11 flex-shrink-0 rounded-full border transition-all ${
                  item.is_active
                    ? 'border-emerald-500/50 bg-emerald-500/30'
                    : 'border-white/20 bg-white/10'
                }`}
                aria-label={item.is_active ? 'Hide from QR menu' : 'Show on QR menu'}
              >
                <span className={`block h-4 w-4 rounded-full transition-transform ${
                  item.is_active ? 'translate-x-6 bg-emerald-400' : 'translate-x-1 bg-white/30'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Table QR Codes */}
      <div className="rounded-xl border border-white/10 bg-slate-800/30 p-5">
        <TableQRSection tenantId={tenantId} tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type Tab = 'builder' | 'waiter' | 'qr';

export default function MenuManagement() {
  const navigate = useNavigate();
  const { currentTenant } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const [catRes, itemRes] = await Promise.all([
      supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      supabase.from('restaurant_menu_items').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
    ]);
    setCategories((catRes.data ?? []) as RestaurantMenuCategory[]);
    setItems((itemRes.data ?? []) as RestaurantMenuItem[]);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { void loadData(); }, [loadData]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'builder', label: 'Menu Builder', icon: <ChefHat className="h-4 w-4" /> },
    { key: 'waiter', label: 'Waiter Order', icon: <ShoppingCart className="h-4 w-4" /> },
    { key: 'qr', label: 'QR Menu', icon: <QrCode className="h-4 w-4" /> },
  ];

  return (
    <Layout>
      <div className="flex h-full flex-col p-4 md:p-6">
        {/* Page Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => { void navigate(-1); }}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg shadow-amber-500/30">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Menu Management</h1>
            <p className="text-xs text-white/40">{items.length} items · {categories.length} categories</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white shadow-lg shadow-amber-500/25'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              {activeTab === 'builder' && (
                <MenuBuilder categories={categories} items={items} onRefresh={() => { void loadData(); }} />
              )}
              {activeTab === 'waiter' && (
                <WaiterOrderPanel categories={categories} items={items} />
              )}
              {activeTab === 'qr' && (
                <QRMenuSettings items={items} onRefresh={() => { void loadData(); }} />
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
