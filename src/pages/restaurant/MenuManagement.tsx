import {
  ArrowLeft,
  ChefHat,
  Copy,
  Edit2,
  GripVertical,
  Loader2,
  Plus,
  QrCode,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type {
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantTable,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

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
  onEdit: (item: RestaurantMenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailable: (item: RestaurantMenuItem) => void;
}

function MenuItemCard({ item, onEdit, onDelete, onToggleAvailable }: MenuItemCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm shadow-lg transition-all duration-300 hover:border-white/30 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5">
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
  onClose: () => void;
  onSave: () => void;
}

function ItemFormModal({ item, categories, onClose, onSave }: ItemFormModalProps) {
  const [form, setForm] = useState<ItemFormState>(() => {
    if (!item) return EMPTY_ITEM_FORM;
    return {
      name: item.name,
      name_ar: item.name_ar ?? '',
      description: item.description ?? '',
      category_id: item.category_id ?? '',
      base_price_usd: String(item.base_price_usd),
      cost_price_usd: item.cost_price_usd !== null && item.cost_price_usd !== undefined ? String(item.cost_price_usd) : '',
      allergens: (item.allergens ?? []) as Allergen[],
      is_active: item.is_active,
      is_featured: item.is_featured,
      active_breakfast: item.active_breakfast,
      active_lunch: item.active_lunch,
      active_dinner: item.active_dinner,
    };
  });
  const [saving, setSaving] = useState(false);

  const toggleAllergen = (a: Allergen) => {
    setForm(f => ({
      ...f,
      allergens: f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_price_usd) {
      toast.error('Name and price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        description: form.description.trim() || null,
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
            <label className="mb-1.5 block text-xs font-medium text-white/60">Description</label>
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RestaurantMenuItem | null | undefined>(undefined);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [search, setSearch] = useState('');

  const displayedItems = items.filter(i => {
    const matchesCat = selectedCategoryId ? i.category_id === selectedCategoryId : true;
    const matchesSearch = search
      ? i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.name_ar ?? '').includes(search)
      : true;
    return matchesCat && matchesSearch;
  });

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    const { error } = await supabase.from('restaurant_menu_categories').insert({
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
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Categories</p>
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
              ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-300'
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
                  ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-300'
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
          onClose={() => setEditingItem(undefined)}
          onSave={onRefresh}
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
    supabase
      .from('restaurant_tables')
      .select('*')
      .order('number')
      .then(({ data }) => setTables((data ?? []) as RestaurantTable[]));
  }, []);

  // When table selected, check for existing open order
  useEffect(() => {
    if (!selectedTableId) { setExistingOrderId(null); return; }
    supabase
      .from('table_orders')
      .select('id')
      .eq('table_id', selectedTableId)
      .eq('status', 'open')
      .limit(1)
      .then(({ data }) => {
        setExistingOrderId((data ?? [])[0]?.id ?? null);
      });
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
                ? 'bg-indigo-600 text-white'
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
                  ? 'bg-indigo-600 text-white'
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
      <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
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
              <span className="text-base font-bold text-white">${orderTotal.toFixed(2)}</span>
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

// ── Tab 3: QR Menu Settings ────────────────────────────────────────────────────

interface QRMenuSettingsProps {
  items: RestaurantMenuItem[];
  onRefresh: () => void;
}

function QRMenuSettings({ items, onRefresh }: QRMenuSettingsProps) {
  const { currentTenant } = useApp();
  const tenantSlug = currentTenant?.tenant_slug ?? '';
  const qrBase = `${window.location.origin}/menu/${tenantSlug}`;

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
    <div className="space-y-6 max-w-2xl">
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

      {/* QR URLs */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white/70">QR Menu URLs</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
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
            <div key={n} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2">
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
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
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
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type Tab = 'builder' | 'waiter' | 'qr';

export default function MenuManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catRes, itemRes] = await Promise.all([
      supabase.from('restaurant_menu_categories').select('*').order('sort_order'),
      supabase.from('restaurant_menu_items').select('*').order('sort_order'),
    ]);
    setCategories((catRes.data ?? []) as RestaurantMenuCategory[]);
    setItems((itemRes.data ?? []) as RestaurantMenuItem[]);
    setLoading(false);
  }, []);

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
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25">
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
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-500/25'
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
                <MenuBuilder categories={categories} items={items} onRefresh={loadData} />
              )}
              {activeTab === 'waiter' && (
                <WaiterOrderPanel categories={categories} items={items} />
              )}
              {activeTab === 'qr' && (
                <QRMenuSettings items={items} onRefresh={loadData} />
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
