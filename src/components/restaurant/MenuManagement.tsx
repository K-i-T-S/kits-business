import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Edit2, Eye, EyeOff, GripVertical,
  Layers, List, Palette, Plus, QrCode, Save, Search, Star, Tag, Trash2, X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import type {
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantModifierGroup,
  RestaurantModifier,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────

type AdminTab = 'categories' | 'items' | 'modifiers' | 'eightysix' | 'qr';

const FOOD_EMOJIS = ['🍽️', '🍕', '🍔', '🍜', '🥗', '🍣', '🥩', '🍰', '🥤', '🍸', '🍺', '☕', '🥪', '🌮', '🥘', '🍝', '🍲', '🧆', '🧁', '🍦'];
const ALLERGENS = ['nuts', 'gluten', 'dairy', 'eggs', 'shellfish', 'fish', 'soy', 'sesame'];
const ALLERGEN_LABELS: Record<string, string> = {
  nuts: '🥜 Nuts', gluten: '🌾 Gluten', dairy: '🥛 Dairy', eggs: '🥚 Eggs',
  shellfish: '🦐 Shellfish', fish: '🐟 Fish', soy: '🫘 Soy', sesame: '🌾 Sesame',
};
const PALETTE_OPTIONS = [
  { id: 'dark-luxury', label: 'Dark Luxury', colors: ['#08060f', '#c9a84c'] },
  { id: 'beirut-night', label: 'Beirut Night', colors: ['#020818', '#7c3aed'] },
  { id: 'mediterranean', label: 'Mediterranean', colors: ['#faf6f0', '#c2622b'] },
  { id: 'lebanese-garden', label: 'Lebanese Garden', colors: ['#0c1a0e', '#4ade80'] },
  { id: 'classic-bistro', label: 'Classic Bistro', colors: ['#0f0508', '#e8b04a'] },
  { id: 'modern-minimal', label: 'Modern Minimal', colors: ['#000000', '#ffffff'] },
];

// ── Tab header ─────────────────────────────────────────────────────────────

function TabButton({ id, icon: Icon, label, active, onClick }: { id: AdminTab; icon: typeof List; label: string; active: boolean; onClick: (t: AdminTab) => void }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
        active ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ── Inline input helpers ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-white/50">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50';

// ── Categories Tab ─────────────────────────────────────────────────────────

function CategoriesTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', name_ar: '', icon: '🍽️', active_breakfast: true, active_lunch: true, active_dinner: true, active_allday: true });
  const [showAdd, setShowAdd] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', tenantId).order('sort_order');
    if (data) setCategories(data as RestaurantMenuCategory[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('restaurant.menu.nameRequired', 'Name is required')); return; }
    if (editingId) {
      const { error } = await supabase.from('restaurant_menu_categories').update({ ...form }).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success(t('restaurant.menu.categorySaved', 'Category saved'));
    } else {
      const { error } = await supabase.from('restaurant_menu_categories').insert({ ...form, tenant_id: tenantId, sort_order: categories.length });
      if (error) { toast.error(error.message); return; }
      toast.success(t('restaurant.menu.categoryAdded', 'Category added'));
    }
    setForm({ name: '', name_ar: '', icon: '🍽️', active_breakfast: true, active_lunch: true, active_dinner: true, active_allday: true });
    setEditingId(null);
    setShowAdd(false);
    void load();
  };

  const del = async (id: string) => {
    await supabase.from('restaurant_menu_categories').delete().eq('id', id);
    void load();
    toast.success(t('restaurant.menu.categoryDeleted', 'Category deleted'));
  };

  const startEdit = (cat: RestaurantMenuCategory) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, name_ar: cat.name_ar ?? '', icon: cat.icon, active_breakfast: cat.active_breakfast, active_lunch: cat.active_lunch, active_dinner: cat.active_dinner, active_allday: cat.active_allday });
    setShowAdd(true);
  };

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const fromIdx = categories.findIndex((c) => c.id === dragging);
    const toIdx = categories.findIndex((c) => c.id === targetId);
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    if (!moved) return;
    reordered.splice(toIdx, 0, moved);
    setCategories(reordered);
    setDragging(null);
    setDragOver(null);
    for (let i = 0; i < reordered.length; i++) {
      const cat = reordered[i];
      if (cat) await supabase.from('restaurant_menu_categories').update({ sort_order: i }).eq('id', cat.id);
    }
  };

  if (loading) return <div className="py-16 text-center text-white/30">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.categories', 'Categories')}</h3>
        <button onClick={() => { setEditingId(null); setForm({ name: '', name_ar: '', icon: '🍽️', active_breakfast: true, active_lunch: true, active_dinner: true, active_allday: true }); setShowAdd(true); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all">
          <Plus className="h-4 w-4" />
          {t('restaurant.menu.addCategory', 'Add Category')}
        </button>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">{editingId ? t('restaurant.menu.editCategory', 'Edit Category') : t('restaurant.menu.newCategory', 'New Category')}</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('restaurant.menu.nameEN', 'Name (EN)')}>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={INPUT_CLS} placeholder="e.g. Mains" />
            </Field>
            <Field label={t('restaurant.menu.nameAR', 'Name (AR)')}>
              <input value={form.name_ar} onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))} className={INPUT_CLS} placeholder="الأطباق الرئيسية" dir="rtl" />
            </Field>
          </div>
          <Field label={t('restaurant.menu.icon', 'Emoji Icon')}>
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white">
                <span className="text-lg">{form.icon}</span>
                <span className="text-white/50">{t('restaurant.menu.changeIcon', 'Change')}</span>
                <ChevronDown className="h-3 w-3 text-white/30" />
              </button>
              {showEmojiPicker && (
                <div className="absolute left-0 top-10 z-10 grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
                  {FOOD_EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={() => { setForm((p) => ({ ...p, icon: emoji })); setShowEmojiPicker(false); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-white/10 transition-all">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <div>
            <p className="mb-2 text-xs font-semibold text-white/50">{t('restaurant.menu.availability', 'Show During')}</p>
            <div className="flex flex-wrap gap-2">
              {(['active_breakfast', 'active_lunch', 'active_dinner', 'active_allday'] as const).map((slot) => {
                const labels = { active_breakfast: '☀️ Breakfast', active_lunch: '🌤️ Lunch', active_dinner: '🌙 Dinner', active_allday: '🕐 All Day' };
                return (
                  <button key={slot} onClick={() => setForm((p) => ({ ...p, [slot]: !p[slot] }))} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${form[slot] ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                    {labels[slot]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { void save(); }} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all">
              <Save className="mr-2 inline h-4 w-4" />
              {t('common.save', 'Save')}
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/40 hover:bg-white/5 transition-all">
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.length === 0 && (
          <div className="py-8 text-center text-white/30 text-sm">{t('restaurant.menu.noCategoriesYet', 'No categories yet — add one above')}</div>
        )}
        {categories.map((cat) => (
          <div
            key={cat.id}
            draggable
            onDragStart={() => setDragging(cat.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(cat.id); }}
            onDrop={() => { void handleDrop(cat.id); }}
            onDragEnd={() => { setDragging(null); setDragOver(null); }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all cursor-grab ${
              dragOver === cat.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 bg-white/5'
            } ${dragging === cat.id ? 'opacity-50' : ''}`}
          >
            <GripVertical className="h-4 w-4 flex-shrink-0 text-white/20" />
            <span className="text-xl">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{cat.name}</p>
              {cat.name_ar && <p className="text-xs text-white/40" dir="rtl">{cat.name_ar}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(cat)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-all" aria-label={`Edit ${cat.name}`}>
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { void del(cat.id); }} className="rounded-lg p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-all" aria-label={`Delete ${cat.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Menu Items Tab ─────────────────────────────────────────────────────────

interface ItemFormState {
  name: string; name_ar: string; description: string; description_ar: string;
  photo_url: string; category_id: string; base_price_usd: number; base_price_lbp: number | '';
  cost_price_usd: number | ''; calories: number | ''; allergens: string[];
  is_featured: boolean; is_chef_pick: boolean; is_active: boolean;
  active_breakfast: boolean; active_lunch: boolean; active_dinner: boolean;
}

const BLANK_ITEM: ItemFormState = {
  name: '', name_ar: '', description: '', description_ar: '', photo_url: '', category_id: '',
  base_price_usd: 0, base_price_lbp: '', cost_price_usd: '', calories: '',
  allergens: [], is_featured: false, is_chef_pick: false, is_active: true,
  active_breakfast: true, active_lunch: true, active_dinner: true,
};

function ItemsTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<RestaurantMenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ItemFormState>(BLANK_ITEM);
  const [saving, setSaving] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const load = useCallback(async () => {
    const [iRes, cRes] = await Promise.all([
      supabase.from('restaurant_menu_items').select('*').eq('tenant_id', tenantId).order('sort_order'),
      supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
    ]);
    if (iRes.data) setItems(iRes.data as RestaurantMenuItem[]);
    if (cRes.data) setCategories(cRes.data as RestaurantMenuCategory[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm(BLANK_ITEM); setShowModal(true); };
  const openEdit = (item: RestaurantMenuItem) => {
    setEditItem(item);
    setForm({
      name: item.name, name_ar: item.name_ar ?? '', description: item.description ?? '',
      description_ar: item.description_ar ?? '', photo_url: item.photo_url ?? '',
      category_id: item.category_id ?? '', base_price_usd: item.base_price_usd,
      base_price_lbp: item.base_price_lbp ?? '', cost_price_usd: item.cost_price_usd ?? '',
      calories: item.calories ?? '', allergens: item.allergens,
      is_featured: item.is_featured, is_chef_pick: item.is_chef_pick, is_active: item.is_active,
      active_breakfast: item.active_breakfast, active_lunch: item.active_lunch, active_dinner: item.active_dinner,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('restaurant.menu.nameRequired', 'Name is required')); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), name_ar: form.name_ar.trim() || null,
        description: form.description.trim() || null, description_ar: form.description_ar.trim() || null,
        photo_url: form.photo_url.trim() || null, category_id: form.category_id || null,
        base_price_usd: form.base_price_usd, base_price_lbp: form.base_price_lbp === '' ? null : Number(form.base_price_lbp),
        cost_price_usd: form.cost_price_usd === '' ? null : Number(form.cost_price_usd),
        calories: form.calories === '' ? null : Number(form.calories),
        allergens: form.allergens, is_featured: form.is_featured, is_chef_pick: form.is_chef_pick,
        is_active: form.is_active, active_breakfast: form.active_breakfast, active_lunch: form.active_lunch, active_dinner: form.active_dinner,
      };
      if (editItem) {
        const { error } = await supabase.from('restaurant_menu_items').update(payload).eq('id', editItem.id);
        if (error) throw error;
        toast.success(t('restaurant.menu.itemSaved', 'Item saved'));
      } else {
        const { error } = await supabase.from('restaurant_menu_items').insert({ ...payload, tenant_id: tenantId, sort_order: items.length });
        if (error) throw error;
        toast.success(t('restaurant.menu.itemAdded', 'Item added'));
      }
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving item');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    await supabase.from('restaurant_menu_items').delete().eq('id', id);
    void load();
    toast.success(t('restaurant.menu.itemDeleted', 'Item deleted'));
  };

  const toggle86 = async (item: RestaurantMenuItem) => {
    const { error } = await supabase.from('restaurant_menu_items').update({ is_eighty_sixd: !item.is_eighty_sixd }).eq('id', item.id);
    if (!error) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_eighty_sixd: !i.is_eighty_sixd } : i));
      toast.success(item.is_eighty_sixd ? t('restaurant.menu.itemRestored', 'Item restored') : t('restaurant.menu.item86d', 'Item 86\'d'));
    }
  };

  const toggleAllergen = (a: string) => {
    setForm((p) => ({ ...p, allergens: p.allergens.includes(a) ? p.allergens.filter((x) => x !== a) : [...p.allergens, a] }));
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || (i.name_ar ?? '').includes(search));
  const foodCostPct = (item: RestaurantMenuItem) => {
    if (!item.cost_price_usd || !item.base_price_usd) return null;
    return ((item.cost_price_usd / item.base_price_usd) * 100).toFixed(0);
  };

  if (loading) return <div className="py-16 text-center text-white/30">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('restaurant.menu.searchItems', 'Search items...')} className="rounded-xl bg-white/5 border border-white/10 py-2 pl-9 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 w-56" />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all">
          <Plus className="h-4 w-4" />
          {t('restaurant.menu.addItem', 'Add Item')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.item', 'Item')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.category', 'Category')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.price', 'Price')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.foodCost', 'Food Cost')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.status', 'Status')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-white/30">{t('restaurant.menu.noItems', 'No items found')}</td></tr>
            )}
            {filtered.map((item) => {
              const fc = foodCostPct(item);
              const cat = categories.find((c) => c.id === item.category_id);
              return (
                <tr key={item.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="h-9 w-9 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg">🍽️</div>
                      )}
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        {item.name_ar && <p className="text-xs text-white/30" dir="rtl">{item.name_ar}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50">{cat?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-white">${item.base_price_usd.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {fc ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${Number(fc) < 30 ? 'bg-emerald-500/15 text-emerald-400' : Number(fc) < 45 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                        {fc}%
                      </span>
                    ) : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {item.is_eighty_sixd && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">86&apos;d</span>
                      )}
                      {item.is_featured && <Star className="h-3.5 w-3.5 text-indigo-400" />}
                      {!item.is_active && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">Hidden</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggle86(item)} className={`rounded-lg p-1.5 transition-all ${item.is_eighty_sixd ? 'text-amber-400 hover:bg-amber-500/10' : 'text-white/30 hover:bg-white/10 hover:text-white/60'}`} title={item.is_eighty_sixd ? 'Restore item' : "86 this item"}>
                        {item.is_eighty_sixd ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white transition-all" title="Edit item">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { void del(item.id); }} className="rounded-lg p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Delete item">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editItem ? t('restaurant.menu.editItem', 'Edit Item') : t('restaurant.menu.addItem', 'Add Item')}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-xl p-2 text-white/40 hover:bg-white/10 transition-all"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('restaurant.menu.nameEN', 'Name (EN) *')}>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={INPUT_CLS} placeholder="Grilled Chicken" />
                </Field>
                <Field label={t('restaurant.menu.nameAR', 'Name (AR)')}>
                  <input value={form.name_ar} onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))} className={INPUT_CLS} placeholder="دجاج مشوي" dir="rtl" />
                </Field>
              </div>
              {/* Description */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/50">{t('restaurant.menu.descEN', 'Description (EN)')}</label>
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-white/30">
                    {descExpanded ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />} {t('restaurant.menu.arabic', 'Arabic')}
                  </button>
                </div>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="Describe the dish..." />
                {descExpanded && (
                  <textarea value={form.description_ar} onChange={(e) => setForm((p) => ({ ...p, description_ar: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none mt-2`} placeholder="وصف الطبق..." dir="rtl" />
                )}
              </div>
              {/* Photo */}
              <Field label={t('restaurant.menu.photoUrl', 'Photo URL')}>
                <input value={form.photo_url} onChange={(e) => setForm((p) => ({ ...p, photo_url: e.target.value }))} className={INPUT_CLS} placeholder="https://..." />
                {form.photo_url && <img src={form.photo_url} alt="" className="mt-2 h-24 w-full rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </Field>
              {/* Category + Price */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Field label={t('restaurant.menu.category', 'Category')}>
                    <select value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))} className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2 text-sm focus:outline-none">
                      <option value="">{t('restaurant.menu.uncategorized', 'Uncategorized')}</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={t('restaurant.menu.priceUSD', 'Price (USD) *')}>
                  <input type="number" min={0} step={0.5} value={form.base_price_usd} onChange={(e) => setForm((p) => ({ ...p, base_price_usd: parseFloat(e.target.value) || 0 }))} className={INPUT_CLS} />
                </Field>
                <Field label={t('restaurant.menu.priceLBP', 'Price (LBP)')}>
                  <input type="number" min={0} value={form.base_price_lbp} onChange={(e) => setForm((p) => ({ ...p, base_price_lbp: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))} className={INPUT_CLS} placeholder="Optional" />
                </Field>
              </div>
              {/* Cost + Calories */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('restaurant.menu.costPrice', 'Cost Price (USD)')}>
                  <input type="number" min={0} step={0.1} value={form.cost_price_usd} onChange={(e) => setForm((p) => ({ ...p, cost_price_usd: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }))} className={INPUT_CLS} placeholder="Optional" />
                </Field>
                <Field label={t('restaurant.menu.calories', 'Calories')}>
                  <input type="number" min={0} value={form.calories} onChange={(e) => setForm((p) => ({ ...p, calories: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))} className={INPUT_CLS} placeholder="Optional" />
                </Field>
              </div>
              {/* Allergens */}
              <div>
                <p className="mb-2 text-xs font-semibold text-white/50">{t('restaurant.menu.allergens', 'Allergens')}</p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map((a) => (
                    <button key={a} onClick={() => toggleAllergen(a)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${form.allergens.includes(a) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10'}`}>
                      {ALLERGEN_LABELS[a] ?? a}
                    </button>
                  ))}
                </div>
              </div>
              {/* Toggles */}
              <div>
                <p className="mb-2 text-xs font-semibold text-white/50">{t('restaurant.menu.flags', 'Flags')}</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'is_featured', label: '⭐ Featured' },
                    { key: 'is_chef_pick', label: '👨‍🍳 Chef\'s Pick' },
                    { key: 'is_active', label: '👁 Visible' },
                    { key: 'active_breakfast', label: '☀️ Breakfast' },
                    { key: 'active_lunch', label: '🌤️ Lunch' },
                    { key: 'active_dinner', label: '🌙 Dinner' },
                  ] as { key: keyof ItemFormState; label: string }[]).map(({ key, label }) => {
                    const val = form[key] as boolean;
                    return (
                      <button key={key} onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${val ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => { void save(); }} disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? t('common.saving', 'Saving...') : (editItem ? t('common.saveChanges', 'Save Changes') : t('restaurant.menu.addItem', 'Add Item'))}
              </button>
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/40 hover:bg-white/5 transition-all">
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modifier Groups Tab ────────────────────────────────────────────────────

function ModifiersTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<RestaurantModifierGroup[]>([]);
  const [modifiers, setModifiers] = useState<RestaurantModifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ name: '', name_ar: '', is_required: false, min_selections: 0, max_selections: 1 });
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newMod, setNewMod] = useState<Record<string, { name: string; name_ar: string; price_delta: number }>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [gRes, mRes] = await Promise.all([
      supabase.from('restaurant_modifier_groups').select('*').eq('tenant_id', tenantId),
      supabase.from('restaurant_modifiers').select('*').eq('tenant_id', tenantId).order('sort_order'),
    ]);
    if (gRes.data) setGroups(gRes.data as RestaurantModifierGroup[]);
    if (mRes.data) setModifiers(mRes.data as RestaurantModifier[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const addGroup = async () => {
    if (!newGroup.name.trim()) { toast.error(t('restaurant.menu.nameRequired', 'Name required')); return; }
    const { error } = await supabase.from('restaurant_modifier_groups').insert({ ...newGroup, tenant_id: tenantId });
    if (error) { toast.error(error.message); return; }
    toast.success(t('restaurant.menu.groupAdded', 'Group added'));
    setNewGroup({ name: '', name_ar: '', is_required: false, min_selections: 0, max_selections: 1 });
    setShowGroupForm(false);
    void load();
  };

  const delGroup = async (id: string) => {
    await supabase.from('restaurant_modifier_groups').delete().eq('id', id);
    void load();
  };

  const addModifier = async (groupId: string) => {
    const m = newMod[groupId];
    if (!m?.name.trim()) return;
    const { error } = await supabase.from('restaurant_modifiers').insert({
      group_id: groupId, tenant_id: tenantId, name: m.name.trim(), name_ar: m.name_ar || null, price_delta: m.price_delta, sort_order: modifiers.filter((x) => x.group_id === groupId).length,
    });
    if (error) { toast.error(error.message); return; }
    setNewMod((p) => ({ ...p, [groupId]: { name: '', name_ar: '', price_delta: 0 } }));
    void load();
  };

  const delModifier = async (id: string) => {
    await supabase.from('restaurant_modifiers').delete().eq('id', id);
    void load();
  };

  if (loading) return <div className="py-16 text-center text-white/30">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.modifierGroups', 'Modifier Groups')}</h3>
        <button onClick={() => setShowGroupForm(!showGroupForm)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all">
          <Plus className="h-4 w-4" />
          {t('restaurant.menu.addGroup', 'Add Group')}
        </button>
      </div>

      {showGroupForm && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('restaurant.menu.nameEN', 'Group Name (EN)')}>
              <input value={newGroup.name} onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))} className={INPUT_CLS} placeholder="Choose your size" />
            </Field>
            <Field label={t('restaurant.menu.nameAR', 'Group Name (AR)')}>
              <input value={newGroup.name_ar} onChange={(e) => setNewGroup((p) => ({ ...p, name_ar: e.target.value }))} className={INPUT_CLS} placeholder="اختر الحجم" dir="rtl" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field label={t('restaurant.menu.minSelections', 'Min Selections')}>
              <input type="number" min={0} value={newGroup.min_selections} onChange={(e) => setNewGroup((p) => ({ ...p, min_selections: parseInt(e.target.value) || 0 }))} className={`${INPUT_CLS} w-24`} />
            </Field>
            <Field label={t('restaurant.menu.maxSelections', 'Max Selections')}>
              <input type="number" min={1} value={newGroup.max_selections} onChange={(e) => setNewGroup((p) => ({ ...p, max_selections: parseInt(e.target.value) || 1 }))} className={`${INPUT_CLS} w-24`} />
            </Field>
            <div className="flex items-end">
              <button onClick={() => setNewGroup((p) => ({ ...p, is_required: !p.is_required }))} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${newGroup.is_required ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                {t('restaurant.menu.required', 'Required')}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { void addGroup(); }} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all">
              {t('restaurant.menu.addGroup', 'Add Group')}
            </button>
            <button onClick={() => setShowGroupForm(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/40 hover:bg-white/5 transition-all">
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {groups.length === 0 && <p className="py-8 text-center text-sm text-white/30">{t('restaurant.menu.noGroups', 'No modifier groups yet')}</p>}
        {groups.map((group) => {
          const groupMods = modifiers.filter((m) => m.group_id === group.id);
          const isExpanded = expandedGroup === group.id;
          const modState = newMod[group.id] ?? { name: '', name_ar: '', price_delta: 0 };

          return (
            <div key={group.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)} className="flex flex-1 items-center gap-3 text-left">
                  <Layers className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{group.name}</p>
                    <p className="text-xs text-white/40">
                      {group.is_required ? '⚠️ Required · ' : ''}
                      {groupMods.length} {t('restaurant.menu.options', 'options')} ·
                      {group.max_selections === 1 ? ` Pick 1` : ` Up to ${group.max_selections}`}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="ml-auto h-4 w-4 text-white/30" /> : <ChevronDown className="ml-auto h-4 w-4 text-white/30" />}
                </button>
                <button onClick={() => { void delGroup(group.id); }} className="ml-3 rounded-lg p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-all" aria-label="Delete group">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 px-4 py-3 space-y-2">
                  {groupMods.map((mod) => (
                    <div key={mod.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <div>
                        <p className="text-sm text-white">{mod.name}</p>
                        {mod.name_ar && <p className="text-xs text-white/30" dir="rtl">{mod.name_ar}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {mod.price_delta !== 0 && (
                          <span className="text-sm font-semibold text-indigo-400">{mod.price_delta > 0 ? '+' : ''}${mod.price_delta.toFixed(2)}</span>
                        )}
                        <button onClick={() => { void delModifier(mod.id); }} className="text-white/20 hover:text-red-400 transition-colors" aria-label={`Delete ${mod.name}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add modifier inline */}
                  <div className="flex gap-2 pt-1">
                    <input
                      placeholder={t('restaurant.menu.optionName', 'Option (e.g. Large)')}
                      value={modState.name}
                      onChange={(e) => setNewMod((p) => ({ ...p, [group.id]: { ...modState, name: e.target.value } }))}
                      className="flex-1 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
                    />
                    <input
                      placeholder={t('restaurant.menu.priceDelta', '+$0.00')}
                      type="number"
                      step={0.5}
                      value={modState.price_delta}
                      onChange={(e) => setNewMod((p) => ({ ...p, [group.id]: { ...modState, price_delta: parseFloat(e.target.value) || 0 } }))}
                      className="w-20 rounded-xl bg-slate-800 border border-white/10 px-2 py-2 text-sm text-white focus:outline-none"
                    />
                    <button onClick={() => { void addModifier(group.id); }} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-all">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 86 Board Tab ───────────────────────────────────────────────────────────

function EightySixTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('restaurant_menu_items').select('id, name, name_ar, is_eighty_sixd, category_id, base_price_usd, photo_url').eq('tenant_id', tenantId).order('name');
    if (data) setItems(data as RestaurantMenuItem[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (item: RestaurantMenuItem) => {
    const { error } = await supabase.from('restaurant_menu_items').update({ is_eighty_sixd: !item.is_eighty_sixd }).eq('id', item.id);
    if (!error) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_eighty_sixd: !i.is_eighty_sixd } : i));
    }
  };

  const count86 = items.filter((i) => i.is_eighty_sixd).length;

  if (loading) return <div className="py-16 text-center text-white/30">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="space-y-4">
      {count86 > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
          <p className="text-sm font-semibold text-amber-400">
            {count86} {t('restaurant.menu.itemsCurrently86d', `item${count86 !== 1 ? 's' : ''} currently 86'd`)}
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              item.is_eighty_sixd ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5 hover:bg-white/8'
            }`}
          >
            {item.photo_url ? (
              <img src={item.photo_url} alt={item.name} className="h-9 w-9 rounded-lg object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-base">🍽️</div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${item.is_eighty_sixd ? 'text-white/40 line-through' : 'text-white'}`}>
                {item.name}
              </p>
              <p className="text-xs text-white/30">${item.base_price_usd.toFixed(2)}</p>
            </div>
            <button
              onClick={() => { void toggle(item); }}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                item.is_eighty_sixd
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
              aria-pressed={item.is_eighty_sixd}
            >
              {item.is_eighty_sixd ? (
                <><Check className="h-3 w-3" /> {t('restaurant.menu.restore', 'Restore')}</>
              ) : (
                <><EyeOff className="h-3 w-3" /> 86&apos;d</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QR & Palette Tab ───────────────────────────────────────────────────────

function QRTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const [palette, setPalette] = useState<string>(currentTenant?.qr_menu_palette ?? 'dark-luxury');
  const [slug, setSlug] = useState<string>(currentTenant?.tenant_slug ?? '');
  const [banner, setBanner] = useState<string>(currentTenant?.qr_menu_promotional_banner ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      qr_menu_palette: palette,
      tenant_slug: slug.trim() || null,
      qr_menu_promotional_banner: banner.trim() || null,
    }).eq('id', tenantId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t('restaurant.menu.qrSettingsSaved', 'QR settings saved'));
  };

  const tables = [1, 2, 3, 4, 5];
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/menu` : '';

  return (
    <div className="space-y-6">
      {/* Tenant slug */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.menuSlug', 'Menu URL Slug')}</h4>
        <Field label={t('restaurant.menu.slug', 'Your unique menu slug (letters, numbers, hyphens)')}>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className={INPUT_CLS} placeholder="my-restaurant" />
        </Field>
        {slug && (
          <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-white/50">
            {baseUrl}/{slug}/TABLE_1
          </p>
        )}
      </div>

      {/* Palette picker */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.palette', 'Theme Palette')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PALETTE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPalette(opt.id)}
              className={`relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${palette === opt.id ? 'border-indigo-500' : 'border-white/10 hover:border-white/20'}`}
            >
              {/* Color swatch */}
              <div className="mb-3 flex gap-2">
                {opt.colors.map((color, i) => (
                  <div key={i} className="h-6 w-6 rounded-full" style={{ background: color, border: '1px solid rgba(255,255,255,0.1)' }} />
                ))}
              </div>
              <p className="text-sm font-semibold text-white">{opt.label}</p>
              {palette === opt.id && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Promotional banner */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.promotionalBanner', 'Promotional Banner')}</h4>
        <Field label={t('restaurant.menu.bannerText', 'Banner text shown after Fa7em / coal request (optional)')}>
          <input value={banner} onChange={(e) => setBanner(e.target.value)} className={INPUT_CLS} placeholder="While you wait — freshly made desserts 🍮" />
        </Field>
      </div>

      {/* QR URL preview per table */}
      {slug && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">{t('restaurant.menu.qrUrls', 'Table QR URLs')}</h4>
          <div className="space-y-2">
            {tables.map((n) => (
              <div key={n} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5">
                <QrCode className="h-4 w-4 flex-shrink-0 text-white/30" />
                <span className="flex-1 font-mono text-xs text-white/50 truncate">
                  {baseUrl}/{slug}/{n}
                </span>
                <button
                  onClick={() => { void navigator.clipboard.writeText(`${baseUrl}/${slug}/${n}`); toast.success('Copied!'); }}
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white transition-all"
                >
                  Copy
                </button>
              </div>
            ))}
            <p className="text-xs text-white/20 mt-2">{t('restaurant.menu.tableIdNote', 'Replace the number with your actual table IDs from the Floor Plan.')}</p>
          </div>
        </div>
      )}

      <button
        onClick={() => { void save(); }}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? t('common.saving', 'Saving...') : t('restaurant.menu.saveQRSettings', 'Save QR Settings')}
      </button>
    </div>
  );
}

// ── Root export ─────────────────────────────────────────────────────────────

export default function MenuManagement() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const [tab, setTab] = useState<AdminTab>('categories');

  if (!currentTenant) return <div className="py-16 text-center text-white/30">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <TabButton id="categories" icon={Tag} label={t('restaurant.menu.tabCategories', 'Categories')} active={tab === 'categories'} onClick={setTab} />
        <TabButton id="items" icon={List} label={t('restaurant.menu.tabItems', 'Menu Items')} active={tab === 'items'} onClick={setTab} />
        <TabButton id="modifiers" icon={Layers} label={t('restaurant.menu.tabModifiers', 'Modifiers')} active={tab === 'modifiers'} onClick={setTab} />
        <TabButton id="eightysix" icon={AlertTriangle} label={t('restaurant.menu.tab86', '86 Board')} active={tab === 'eightysix'} onClick={setTab} />
        <TabButton id="qr" icon={Palette} label={t('restaurant.menu.tabQR', 'QR & Themes')} active={tab === 'qr'} onClick={setTab} />
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {tab === 'categories' && <CategoriesTab tenantId={currentTenant.id} />}
        {tab === 'items' && <ItemsTab tenantId={currentTenant.id} />}
        {tab === 'modifiers' && <ModifiersTab tenantId={currentTenant.id} />}
        {tab === 'eightysix' && <EightySixTab tenantId={currentTenant.id} />}
        {tab === 'qr' && <QRTab tenantId={currentTenant.id} />}
      </div>
    </div>
  );
}
