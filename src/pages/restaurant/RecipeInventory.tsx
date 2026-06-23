import {
  ChefHat,
  Plus,
  Search,
  RefreshCw,
  X,
  Package,
  TrendingDown,
  Truck,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Edit2,
  BarChart3,
  MessageCircle,
  Info,
  Save,
  ShoppingCart,
  ClipboardList,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type {
  RestaurantIngredient,
  RestaurantRecipe,
  RecipeIngredientLine,
  IngredientSupplier,
  WasteLogEntry,
  IngredientMovement,
  RestaurantPurchaseOrder,
  RestaurantPOItem,
} from '@/types/restaurant';
import {
  getIngredientStockStatus,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABELS,
  SUGGESTED_WASTE_FACTORS,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Tab types ─────────────────────────────────────────────────
type Tab = 'ingredients' | 'recipes' | 'food-cost' | 'suppliers' | 'waste' | 'purchase-orders';

// ── Auto-86 helper ────────────────────────────────────────────
/**
 * When an ingredient's stock crosses zero, mark all menu items that use it
 * (via recipe chain: ingredient → recipe_ingredients → menu_item_recipes → menu_items)
 * as is_eighty_sixd = true. Reverses when stock goes positive again.
 *
 * Returns the count of affected menu items for toast messaging.
 */
async function applyAutoEightySix(
  tenantId: string,
  ingredientId: string,
  newQty: number,
  ingredientName: string,
): Promise<void> {
  const markAs = newQty <= 0;

  // Step 1: find recipes that use this ingredient (with tenant_id, fallback without)
  let recipeIngredients: Array<{ recipe_id: string }> = [];
  const { data: riWithTenant } = await supabase
    .from('restaurant_recipe_ingredients')
    .select('recipe_id')
    .eq('ingredient_id', ingredientId)
    .eq('tenant_id', tenantId);

  if (riWithTenant && riWithTenant.length > 0) {
    recipeIngredients = riWithTenant;
  } else {
    // Fallback: restaurant_recipe_ingredients may not have tenant_id on older rows
    const { data: riWithoutTenant } = await supabase
      .from('restaurant_recipe_ingredients')
      .select('recipe_id')
      .eq('ingredient_id', ingredientId);
    recipeIngredients = (riWithoutTenant ?? []) as Array<{ recipe_id: string }>;
  }

  if (recipeIngredients.length === 0) return;

  const recipeIds = recipeIngredients.map((r) => r.recipe_id);

  // Step 2: find menu items linked to those recipes
  const { data: menuItemRecipesData } = await supabase
    .from('restaurant_menu_item_recipes')
    .select('menu_item_id')
    .in('recipe_id', recipeIds)
    .eq('tenant_id', tenantId);

  const menuItemIds = (menuItemRecipesData ?? [])
    .map((r) => (r as { menu_item_id: string }).menu_item_id);

  if (menuItemIds.length === 0) return;

  // Step 3: update is_eighty_sixd on restaurant_menu_items
  const { error } = await supabase
    .from('restaurant_menu_items')
    .update({ is_eighty_sixd: markAs })
    .in('id', menuItemIds)
    .eq('tenant_id', tenantId);

  if (error) {
    console.warn('[AutoEightySix] update error:', error.message);
    return;
  }

  const count = menuItemIds.length;
  if (markAs) {
    toast.warning(
      `Auto-86: ${count} item${count !== 1 ? 's' : ''} marked unavailable — ${ingredientName} out of stock`,
    );
  } else {
    toast.success(
      `Stock restored: ${count} item${count !== 1 ? 's' : ''} back on menu`,
    );
  }
}

// ── Small helpers ─────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function fmtUSD(n: number) {
  return `$${fmt(n, 4)}`;
}

function foodCostColor(pct: number): string {
  if (pct < 30) return 'text-emerald-400';
  if (pct < 40) return 'text-amber-400';
  return 'text-red-400';
}

function foodCostBg(pct: number): string {
  if (pct < 30) return 'bg-emerald-500/15 text-emerald-300';
  if (pct < 40) return 'bg-amber-500/15 text-amber-300';
  return 'bg-red-500/15 text-red-300';
}

// ── Modal component ───────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Stock status badge ────────────────────────────────────────
function StockBadge({ ingredient }: { ingredient: RestaurantIngredient }) {
  const status = getIngredientStockStatus(ingredient);
  if (status === 'good') return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
      <CheckCircle className="h-3 w-3" /> Good
    </span>
  );
  if (status === 'low') return (
    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
      <AlertTriangle className="h-3 w-3" /> Low
    </span>
  );
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400 animate-pulse">
      <AlertTriangle className="h-3 w-3" /> Order Now!
    </span>
  );
}

// ── Input helper ──────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/70">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLASS = 'w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30';
const SELECT_CLASS = 'w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30';

// ── Main page ─────────────────────────────────────────────────
export default function RecipeInventory() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [loading, setLoading] = useState(true);

  // Data
  const [ingredients, setIngredients] = useState<RestaurantIngredient[]>([]);
  const [recipes, setRecipes] = useState<RestaurantRecipe[]>([]);
  const [recipeLines, setRecipeLines] = useState<RecipeIngredientLine[]>([]);
  const [suppliers, setSuppliers] = useState<IngredientSupplier[]>([]);
  const [wasteLog, setWasteLog] = useState<WasteLogEntry[]>([]);
  const [movements, setMovements] = useState<IngredientMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<RestaurantPurchaseOrder[]>([]);
  // Maps menu item ids → names for recipe display
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string; price: number }>>([]);
  // Maps recipe_id → menu_item_id
  const [menuItemRecipes, setMenuItemRecipes] = useState<Record<string, string>>({});

  // UI state
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientCategory, setIngredientCategory] = useState('all');
  const [recipeSearch, setRecipeSearch] = useState('');

  // Modal state
  const [addIngredientOpen, setAddIngredientOpen] = useState(false);
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [receiveStockOpen, setReceiveStockOpen] = useState(false);
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const [editRecipeOpen, setEditRecipeOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [logWasteOpen, setLogWasteOpen] = useState(false);
  const [editIngredientOpen, setEditIngredientOpen] = useState(false);
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [poSubmitting, setPOSubmitting] = useState(false);
  const [receivingPOId, setReceivingPOId] = useState<string | null>(null);

  const [selectedIngredient, setSelectedIngredient] = useState<RestaurantIngredient | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RestaurantRecipe | null>(null);

  // Forms
  const [ingForm, setIngForm] = useState({
    name: '', name_ar: '', category: 'general', unit: 'g',
    cost_per_unit: '', current_stock: '', reorder_level: '',
    par_level: '', shelf_life_days: '', storage_location: '',
    supplier_id: '',
  });

  const [receiveForm, setReceiveForm] = useState({
    ingredient_id: '', qty: '', unit_cost: '', notes: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    ingredient_id: '', qty: '', notes: '',
  });

  const [recipeForm, setRecipeForm] = useState({
    name: '', yield_quantity: '1', yield_unit: 'portion', notes: '',
    menu_item_id: '',
  });

  // Recipe ingredient builder
  const [recipeLines2, setRecipeLines2] = useState<Array<{
    ingredient_id: string; quantity: string; unit: string; waste_factor: string;
  }>>([]);

  const [supplierForm, setSupplierForm] = useState({
    name: '', contact_name: '', phone: '', whatsapp: '',
    email: '', address: '', payment_terms: '', notes: '',
  });

  const [wasteForm, setWasteForm] = useState({
    ingredient_id: '', quantity: '', unit: 'g', reason: 'prep_waste', cost_value: '',
  });

  // PO form state
  const [poForm, setPOForm] = useState({
    supplier_id: '', notes: '', expected_date: '',
  });
  const [poItems, setPOItems] = useState<Array<{
    ingredient_id: string; quantity: string; unit_cost: string;
  }>>([]);

  // Inline waste log form state (used in the Waste tab — separate from modal)
  const [inlineWasteIngredientId, setInlineWasteIngredientId] = useState('');
  const [inlineWasteQty, setInlineWasteQty] = useState('');
  const [inlineWasteReason, setInlineWasteReason] = useState('spoilage');
  const [inlineWasteSubmitting, setInlineWasteSubmitting] = useState(false);

  // ── Load all data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [ingRes, recRes, rlRes, supRes, wlRes, mvRes, menuRes, mirRes, poRes] = await Promise.all([
        supabase.from('restaurant_ingredients').select('*').eq('tenant_id', tenantId).order('name'),
        supabase.from('restaurant_recipes').select('*').eq('tenant_id', tenantId).order('name'),
        supabase.from('restaurant_recipe_ingredients').select('*').eq('tenant_id', tenantId),
        supabase.from('restaurant_ingredient_suppliers').select('*').eq('tenant_id', tenantId).order('name'),
        supabase.from('restaurant_waste_log').select('*').eq('tenant_id', tenantId).order('logged_at', { ascending: false }).limit(100),
        supabase.from('restaurant_ingredient_movements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500),
        supabase.from('products').select('id, name, price').eq('tenant_id', tenantId).order('name'),
        supabase.from('restaurant_menu_item_recipes').select('*').eq('tenant_id', tenantId),
        supabase.from('restaurant_purchase_orders').select('*, items:restaurant_purchase_order_items(*)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
      ]);

      if (ingRes.data) setIngredients(ingRes.data as RestaurantIngredient[]);
      if (recRes.data) setRecipes(recRes.data as RestaurantRecipe[]);
      if (rlRes.data) setRecipeLines(rlRes.data as RecipeIngredientLine[]);
      if (supRes.data) setSuppliers(supRes.data as IngredientSupplier[]);
      if (wlRes.data) setWasteLog(wlRes.data as WasteLogEntry[]);
      if (mvRes.data) setMovements(mvRes.data as IngredientMovement[]);
      if (menuRes.data) setMenuItems(menuRes.data as Array<{ id: string; name: string; price: number }>);
      if (mirRes.data) {
        const map: Record<string, string> = {};
        for (const row of mirRes.data as Array<{ recipe_id: string; menu_item_id: string }>) {
          map[row.recipe_id] = row.menu_item_id;
        }
        setMenuItemRecipes(map);
      }
      if (poRes.data) setPurchaseOrders(poRes.data as RestaurantPurchaseOrder[]);
    } catch (err) {
      console.error('[RecipeInventory] load error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Derived data ──────────────────────────────────────────
  const ingredientMap = useMemo(() => {
    const m = new Map<string, RestaurantIngredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const menuItemMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; price: number }>();
    for (const mi of menuItems) m.set(mi.id, mi);
    return m;
  }, [menuItems]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((i) => {
      const matchSearch = i.name.toLowerCase().includes(ingredientSearch.toLowerCase()) ||
        (i.name_ar ?? '').includes(ingredientSearch);
      const matchCat = ingredientCategory === 'all' || i.category === ingredientCategory;
      return matchSearch && matchCat;
    });
  }, [ingredients, ingredientSearch, ingredientCategory]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) =>
      r.name.toLowerCase().includes(recipeSearch.toLowerCase()),
    );
  }, [recipes, recipeSearch]);

  // Calculate recipe cost from lines
  function getRecipeCost(recipeId: string): number {
    const lines = recipeLines.filter((l) => l.recipe_id === recipeId);
    return lines.reduce((sum, line) => {
      const ing = ingredientMap.get(line.ingredient_id);
      if (!ing) return sum;
      return sum + line.quantity * line.waste_factor * ing.cost_per_unit;
    }, 0);
  }

  function getRecipeIngredientCount(recipeId: string): number {
    return recipeLines.filter((l) => l.recipe_id === recipeId).length;
  }

  // 30-day deduction movements total (by ingredient)
  const deductionTotals = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const totals = new Map<string, number>();
    for (const mv of movements) {
      if (mv.movement_type !== 'deduct') continue;
      if (new Date(mv.created_at) < cutoff) continue;
      totals.set(mv.ingredient_id, (totals.get(mv.ingredient_id) ?? 0) + mv.quantity);
    }
    return totals;
  }, [movements]);

  // Food cost dashboard metrics
  const foodCostMetrics = useMemo(() => {
    // Per-recipe metrics: cost, selling price, cost %
    return recipes.map((r) => {
      const cost = getRecipeCost(r.id);
      const menuItemId = menuItemRecipes[r.id];
      const menuItem = menuItemId ? menuItemMap.get(menuItemId) : undefined;
      const price = menuItem?.price ?? 0;
      const costPct = price > 0 ? (cost / price) * 100 : 0;
      return { recipe: r, cost, price, costPct, menuItemName: menuItem?.name ?? 'Unlinked' };
    }).sort((a, b) => b.costPct - a.costPct);
  }, [recipes, recipeLines, ingredientMap, menuItemRecipes, menuItemMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Waste last 30 days
  const wasteLast30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return wasteLog.filter((w) => new Date(w.logged_at) >= cutoff);
  }, [wasteLog]);

  const totalWasteCost30 = wasteLast30.reduce((s, w) => s + (w.cost_value ?? 0), 0);

  // By-reason cost breakdown (last 30d) — keyed by reason string
  const wasteByReason = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wasteLast30) {
      const key = w.reason ?? 'other';
      m.set(key, (m.get(key) ?? 0) + (w.cost_value ?? 0));
    }
    return m;
  }, [wasteLast30]);

  // By-ingredient cost breakdown (last 30d) — keyed by ingredient name
  const wasteByIngredient = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wasteLast30) {
      const name = ingredientMap.get(w.ingredient_id)?.name ?? 'Unknown';
      m.set(name, (m.get(name) ?? 0) + (w.cost_value ?? 0));
    }
    return m;
  }, [wasteLast30, ingredientMap]);

  const mostWastedIngredient = useMemo(() => {
    const entries = [...wasteByIngredient.entries()];
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [wasteByIngredient]);

  const mostCommonReason = useMemo(() => {
    const entries = [...wasteByReason.entries()];
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [wasteByReason]);

  // Daily waste for the past 7 days
  const dailyWaste = useMemo(() => {
    const days: Array<{ label: string; cost: number }> = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const label = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStr = date.toISOString().split('T')[0] ?? '';
      const cost = wasteLog
        .filter((w) => w.logged_at.startsWith(dayStr))
        .reduce((s, w) => s + (w.cost_value ?? 0), 0);
      days.push({ label, cost });
    }
    return days;
  }, [wasteLog]);

  // ── Handlers ──────────────────────────────────────────────

  async function handleAddIngredient() {
    if (!tenantId || !ingForm.name || !ingForm.unit) {
      toast.error('Name and unit are required');
      return;
    }
    const { error } = await supabase.from('restaurant_ingredients').insert({
      tenant_id: tenantId,
      name: ingForm.name,
      name_ar: ingForm.name_ar || null,
      category: ingForm.category,
      unit: ingForm.unit,
      cost_per_unit: parseFloat(ingForm.cost_per_unit) || 0,
      current_stock: parseFloat(ingForm.current_stock) || 0,
      reorder_level: parseFloat(ingForm.reorder_level) || 0,
      par_level: parseFloat(ingForm.par_level) || 0,
      shelf_life_days: ingForm.shelf_life_days ? parseInt(ingForm.shelf_life_days) : null,
      storage_location: ingForm.storage_location || null,
      supplier_id: ingForm.supplier_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Ingredient added');
    setAddIngredientOpen(false);
    setIngForm({ name: '', name_ar: '', category: 'general', unit: 'g', cost_per_unit: '', current_stock: '', reorder_level: '', par_level: '', shelf_life_days: '', storage_location: '', supplier_id: '' });
    void loadData();
  }

  async function handleEditIngredient() {
    if (!selectedIngredient || !tenantId) return;
    const { error } = await supabase.from('restaurant_ingredients').update({
      name: ingForm.name,
      name_ar: ingForm.name_ar || null,
      category: ingForm.category,
      unit: ingForm.unit,
      cost_per_unit: parseFloat(ingForm.cost_per_unit) || 0,
      reorder_level: parseFloat(ingForm.reorder_level) || 0,
      par_level: parseFloat(ingForm.par_level) || 0,
      shelf_life_days: ingForm.shelf_life_days ? parseInt(ingForm.shelf_life_days) : null,
      storage_location: ingForm.storage_location || null,
      supplier_id: ingForm.supplier_id || null,
    }).eq('id', selectedIngredient.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Ingredient updated');
    setEditIngredientOpen(false);
    setSelectedIngredient(null);
    void loadData();
  }

  async function handleReceiveStock() {
    if (!tenantId || !receiveForm.ingredient_id || !receiveForm.qty) {
      toast.error('Select ingredient and enter quantity');
      return;
    }
    const qty = parseFloat(receiveForm.qty);
    const unitCost = parseFloat(receiveForm.unit_cost) || 0;
    const ing = ingredientMap.get(receiveForm.ingredient_id);
    if (!ing) return;

    // Weighted average cost update
    const newStock = ing.current_stock + qty;
    const newCostPerUnit = newStock > 0
      ? (ing.current_stock * ing.cost_per_unit + qty * unitCost) / newStock
      : unitCost;

    const { error: updateError } = await supabase.from('restaurant_ingredients').update({
      current_stock: newStock,
      cost_per_unit: newCostPerUnit,
      last_restocked_at: new Date().toISOString(),
    }).eq('id', ing.id);

    if (updateError) { toast.error(updateError.message); return; }

    const { error: mvError } = await supabase.from('restaurant_ingredient_movements').insert({
      tenant_id: tenantId,
      ingredient_id: ing.id,
      movement_type: 'receive',
      quantity: qty,
      unit_cost: unitCost || null,
      notes: receiveForm.notes || null,
    });
    if (mvError) console.warn('[RecipeInventory] movement log error:', mvError.message);

    // Auto-86 check: receiving stock may un-86 items if ingredient was at 0
    await applyAutoEightySix(tenantId, ing.id, newStock, ing.name);

    toast.success(`Stock received: +${qty} ${ing.unit} of ${ing.name}`);
    setReceiveStockOpen(false);
    setReceiveForm({ ingredient_id: '', qty: '', unit_cost: '', notes: '' });
    void loadData();
  }

  async function handleAdjustStock() {
    if (!tenantId || !adjustForm.ingredient_id || !adjustForm.qty) {
      toast.error('Select ingredient and enter adjustment');
      return;
    }
    const delta = parseFloat(adjustForm.qty);
    const ing = ingredientMap.get(adjustForm.ingredient_id);
    if (!ing) return;

    const adjustedQty = Math.max(0, ing.current_stock + delta);
    const { error } = await supabase.from('restaurant_ingredients').update({
      current_stock: adjustedQty,
    }).eq('id', ing.id);
    if (error) { toast.error(error.message); return; }

    await supabase.from('restaurant_ingredient_movements').insert({
      tenant_id: tenantId,
      ingredient_id: ing.id,
      movement_type: 'adjustment',
      quantity: Math.abs(delta),
      notes: adjustForm.notes || null,
    });

    // Auto-86 check: adjustment may zero out or restore stock
    await applyAutoEightySix(tenantId, ing.id, adjustedQty, ing.name);

    toast.success(`Stock adjusted for ${ing.name}`);
    setAdjustStockOpen(false);
    setAdjustForm({ ingredient_id: '', qty: '', notes: '' });
    void loadData();
  }

  async function handleSaveRecipe() {
    if (!tenantId || !recipeForm.name) {
      toast.error('Recipe name is required');
      return;
    }

    const { data: recipeData, error: recipeError } = await supabase.from('restaurant_recipes').insert({
      tenant_id: tenantId,
      name: recipeForm.name,
      yield_quantity: parseFloat(recipeForm.yield_quantity) || 1,
      yield_unit: recipeForm.yield_unit || 'portion',
      notes: recipeForm.notes || null,
    }).select().single();

    if (recipeError || !recipeData) { toast.error(recipeError?.message ?? 'Failed to create recipe'); return; }

    const recipe = recipeData as RestaurantRecipe;

    // Insert recipe lines
    if (recipeLines2.length > 0) {
      const lines = recipeLines2
        .filter((l) => l.ingredient_id && l.quantity)
        .map((l) => ({
          recipe_id: recipe.id,
          ingredient_id: l.ingredient_id,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          waste_factor: parseFloat(l.waste_factor) || 1.0,
        }));
      if (lines.length > 0) {
        const { error: lineError } = await supabase.from('restaurant_recipe_ingredients').insert(lines);
        if (lineError) toast.error(`Recipe saved but ingredient lines failed: ${lineError.message}`);
      }
    }

    // Link to menu item
    if (recipeForm.menu_item_id) {
      await supabase.from('restaurant_menu_item_recipes').upsert({
        menu_item_id: recipeForm.menu_item_id,
        recipe_id: recipe.id,
        tenant_id: tenantId,
      });
    }

    toast.success(`Recipe "${recipeForm.name}" created`);
    setAddRecipeOpen(false);
    setRecipeForm({ name: '', yield_quantity: '1', yield_unit: 'portion', notes: '', menu_item_id: '' });
    setRecipeLines2([]);
    void loadData();
  }

  async function handleAddSupplier() {
    if (!tenantId || !supplierForm.name) {
      toast.error('Supplier name is required');
      return;
    }
    const { error } = await supabase.from('restaurant_ingredient_suppliers').insert({
      tenant_id: tenantId,
      name: supplierForm.name,
      contact_name: supplierForm.contact_name || null,
      phone: supplierForm.phone || null,
      whatsapp: supplierForm.whatsapp || null,
      email: supplierForm.email || null,
      address: supplierForm.address || null,
      payment_terms: supplierForm.payment_terms || null,
      notes: supplierForm.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Supplier added');
    setAddSupplierOpen(false);
    setSupplierForm({ name: '', contact_name: '', phone: '', whatsapp: '', email: '', address: '', payment_terms: '', notes: '' });
    void loadData();
  }

  async function handleLogWaste() {
    if (!tenantId || !wasteForm.ingredient_id || !wasteForm.quantity) {
      toast.error('Select ingredient and enter quantity');
      return;
    }
    const qty = parseFloat(wasteForm.quantity);
    const ing = ingredientMap.get(wasteForm.ingredient_id);
    if (!ing) return;

    const costValue = wasteForm.cost_value ? parseFloat(wasteForm.cost_value) : qty * ing.cost_per_unit;

    // Insert waste log
    const { error: wlError } = await supabase.from('restaurant_waste_log').insert({
      tenant_id: tenantId,
      ingredient_id: ing.id,
      quantity: qty,
      unit: wasteForm.unit || ing.unit,
      reason: wasteForm.reason || null,
      cost_value: costValue,
    });
    if (wlError) { toast.error(wlError.message); return; }

    // Deduct from stock
    const wasteNewQty = Math.max(0, ing.current_stock - qty);
    await supabase.from('restaurant_ingredients').update({
      current_stock: wasteNewQty,
    }).eq('id', ing.id);

    await supabase.from('restaurant_ingredient_movements').insert({
      tenant_id: tenantId,
      ingredient_id: ing.id,
      movement_type: 'waste',
      quantity: qty,
      notes: wasteForm.reason || null,
    });

    // Auto-86 check: waste may bring ingredient to zero
    await applyAutoEightySix(tenantId, ing.id, wasteNewQty, ing.name);

    toast.success(`Waste logged: ${qty} ${ing.unit} of ${ing.name}`);
    setLogWasteOpen(false);
    setWasteForm({ ingredient_id: '', quantity: '', unit: 'g', reason: 'prep_waste', cost_value: '' });
    void loadData();
  }

  async function handleInlineLogWaste() {
    if (!tenantId || !inlineWasteIngredientId || !inlineWasteQty) {
      toast.error('Select ingredient and enter quantity');
      return;
    }
    const qty = parseFloat(inlineWasteQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    const ing = ingredientMap.get(inlineWasteIngredientId);
    if (!ing) return;

    setInlineWasteSubmitting(true);
    try {
      const costValue = qty * ing.cost_per_unit;

      const { error: wlError } = await supabase.from('restaurant_waste_log').insert({
        tenant_id: tenantId,
        ingredient_id: ing.id,
        quantity: qty,
        unit: ing.unit,
        reason: inlineWasteReason || null,
        cost_value: costValue,
      });
      if (wlError) { toast.error(wlError.message); return; }

      // Deduct from stock
      const newQty = Math.max(0, ing.current_stock - qty);
      await supabase.from('restaurant_ingredients').update({
        current_stock: newQty,
      }).eq('id', ing.id).eq('tenant_id', tenantId);

      await supabase.from('restaurant_ingredient_movements').insert({
        tenant_id: tenantId,
        ingredient_id: ing.id,
        movement_type: 'waste',
        quantity: qty,
        notes: inlineWasteReason || null,
      });

      // Auto-86 check
      await applyAutoEightySix(tenantId, ing.id, newQty, ing.name);

      toast.success(`Waste logged: ${qty} ${ing.unit} of ${ing.name}`);
      setInlineWasteIngredientId('');
      setInlineWasteQty('');
      setInlineWasteReason('spoilage');
      void loadData();
    } finally {
      setInlineWasteSubmitting(false);
    }
  }

  // ── Purchase Order helpers ────────────────────────────────

  function generatePONumber(): string {
    const now = new Date();
    return `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`;
  }

  async function handleCreatePO() {
    if (!tenantId) return;
    const validItems = poItems.filter((l) => l.ingredient_id && l.quantity);
    if (validItems.length === 0) {
      toast.error('Add at least one item to the purchase order');
      return;
    }
    setPOSubmitting(true);
    try {
      const totalEstimated = validItems.reduce((sum, l) => {
        const q = parseFloat(l.quantity) || 0;
        const c = parseFloat(l.unit_cost) || 0;
        return sum + q * c;
      }, 0);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data: poData, error: poError } = await supabase
        .from('restaurant_purchase_orders')
        .insert({
          tenant_id: tenantId,
          supplier_id: poForm.supplier_id || null,
          order_number: generatePONumber(),
          status: 'draft',
          expected_date: poForm.expected_date || null,
          notes: poForm.notes || null,
          total_estimated: totalEstimated,
        })
        .select()
        .single();

      if (poError || !poData) { toast.error(poError?.message ?? 'Failed to create PO'); return; }

      const po = poData as RestaurantPurchaseOrder;

      const itemRows = validItems.map((l) => ({
        purchase_order_id: po.id,
        ingredient_id: l.ingredient_id,
        quantity_ordered: parseFloat(l.quantity) || 0,
        quantity_received: 0,
        unit_cost: parseFloat(l.unit_cost) || 0,
      }));

      const { error: itemError } = await supabase
        .from('restaurant_purchase_order_items')
        .insert(itemRows);

      if (itemError) toast.error(`PO created but items failed: ${itemError.message}`);

      toast.success(`Purchase order ${po.order_number} created`);
      setCreatePOOpen(false);
      setPOForm({ supplier_id: '', notes: '', expected_date: '' });
      setPOItems([]);
      void loadData();
    } finally {
      setPOSubmitting(false);
    }
  }

  async function handleMarkPOOrdered(poId: string, orderNumber: string) {
    const { error } = await supabase
      .from('restaurant_purchase_orders')
      .update({ status: 'ordered' })
      .eq('id', poId);
    if (error) { toast.error(error.message); return; }
    toast.success(`${orderNumber} marked as ordered`);
    void loadData();
  }

  async function handleReceivePO(po: RestaurantPurchaseOrder) {
    if (!tenantId || !po.items || po.items.length === 0) {
      toast.error('No items on this PO');
      return;
    }
    setReceivingPOId(po.id);
    try {
      for (const item of po.items) {
        if (item.quantity_ordered <= 0) continue;
        const ing = ingredientMap.get(item.ingredient_id);
        if (!ing) continue;

        const newStock = ing.current_stock + item.quantity_ordered;
        const newCost = newStock > 0
          ? (ing.current_stock * ing.cost_per_unit + item.quantity_ordered * item.unit_cost) / newStock
          : item.unit_cost;

        const { error: stockErr } = await supabase
          .from('restaurant_ingredients')
          .update({
            current_stock: newStock,
            cost_per_unit: newCost,
            last_restocked_at: new Date().toISOString(),
          })
          .eq('id', ing.id);

        if (stockErr) { toast.error(`Stock update failed for ${ing.name}: ${stockErr.message}`); continue; }

        await supabase.from('restaurant_ingredient_movements').insert({
          tenant_id: tenantId,
          ingredient_id: ing.id,
          movement_type: 'receive',
          quantity: item.quantity_ordered,
          unit_cost: item.unit_cost || null,
          reference_id: po.id,
          reference_type: 'purchase_order',
          notes: `PO ${po.order_number}`,
        });

        await supabase
          .from('restaurant_purchase_order_items')
          .update({ quantity_received: item.quantity_ordered })
          .eq('id', item.id);

        await applyAutoEightySix(tenantId, ing.id, newStock, ing.name);
      }

      await supabase
        .from('restaurant_purchase_orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', po.id);

      toast.success(`PO ${po.order_number} received — stock updated for ${po.items.length} ingredient${po.items.length !== 1 ? 's' : ''}`);
      void loadData();
    } finally {
      setReceivingPOId(null);
    }
  }

  async function handleAutoCreatePO(lowStockItems: RestaurantIngredient[]) {
    if (!tenantId || lowStockItems.length === 0) return;
    setPOSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data: poData, error: poError } = await supabase
        .from('restaurant_purchase_orders')
        .insert({
          tenant_id: tenantId,
          supplier_id: null,
          order_number: generatePONumber(),
          status: 'draft',
          notes: 'Auto-generated from low stock alert',
          total_estimated: 0,
        })
        .select()
        .single();

      if (poError || !poData) { toast.error(poError?.message ?? 'Failed to create PO'); return; }

      const po = poData as RestaurantPurchaseOrder;

      const itemRows = lowStockItems.map((ing) => ({
        purchase_order_id: po.id,
        ingredient_id: ing.id,
        quantity_ordered: Math.max(0, (ing.par_level ?? 0) - ing.current_stock),
        quantity_received: 0,
        unit_cost: ing.cost_per_unit,
      }));

      const { error: itemError } = await supabase
        .from('restaurant_purchase_order_items')
        .insert(itemRows);

      if (itemError) toast.error(`PO created but items failed: ${itemError.message}`);

      toast.success(`Auto-PO ${po.order_number} created with ${itemRows.length} items`);
      setActiveTab('purchase-orders');
      void loadData();
    } finally {
      setPOSubmitting(false);
    }
  }

  // ── Live recipe cost for builder ──────────────────────────
  const builderCost = recipeLines2.reduce((sum, line) => {
    if (!line.ingredient_id || !line.quantity) return sum;
    const ing = ingredientMap.get(line.ingredient_id);
    if (!ing) return sum;
    return sum + parseFloat(line.quantity) * (parseFloat(line.waste_factor) || 1) * ing.cost_per_unit;
  }, 0);

  // ── Max waste bar chart scale ─────────────────────────────
  const maxDailyWaste = Math.max(...dailyWaste.map((d) => d.cost), 0.01);

  // Low stock items (below par level) for PO banner
  const lowStockIngredients = useMemo(
    () => ingredients.filter((i) => i.is_active && i.par_level > 0 && i.current_stock < i.par_level),
    [ingredients],
  );

  // ── Tab config ────────────────────────────────────────────
  const tabs: Array<{ id: Tab; label: string; icon: typeof ChefHat; badge?: number }> = [
    { id: 'ingredients', label: t('recipes.tabs.ingredients', 'Ingredients'), icon: Package },
    { id: 'recipes', label: t('recipes.tabs.recipes', 'Recipes'), icon: ChefHat },
    { id: 'food-cost', label: t('recipes.tabs.foodCost', 'Food Cost'), icon: BarChart3 },
    { id: 'suppliers', label: t('recipes.tabs.suppliers', 'Suppliers'), icon: Truck },
    { id: 'waste', label: t('recipes.tabs.waste', 'Waste Log'), icon: Trash2 },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, badge: lowStockIngredients.length > 0 ? lowStockIngredients.length : undefined },
  ];

  const criticalCount = ingredients.filter((i) => i.is_active && getIngredientStockStatus(i) === 'critical').length;

  // Ingredients that are at or below zero stock (eighty-six threshold)
  const eightySixdIngredients = ingredients.filter((i) => i.is_active && i.current_stock <= 0);
  const eightySixdIngredientCount = eightySixdIngredients.length;

  // Count of auto-86'd menu items: menu items linked (via recipe chain) to zero-stock ingredients
  const eightySixdMenuItemCount = useMemo(() => {
    const zeroIngIds = new Set(ingredients.filter((i) => i.current_stock <= 0).map((i) => i.id));
    if (zeroIngIds.size === 0) return 0;
    // Recipe IDs that use any zero-stock ingredient
    const affectedRecipeIds = new Set(
      recipeLines.filter((l) => zeroIngIds.has(l.ingredient_id)).map((l) => l.recipe_id),
    );
    if (affectedRecipeIds.size === 0) return 0;
    // Menu item IDs linked to those recipes (via menuItemRecipes map)
    const affectedMenuItemIds = new Set(
      Object.entries(menuItemRecipes)
        .filter(([recipeId]) => affectedRecipeIds.has(recipeId))
        .map(([, menuItemId]) => menuItemId),
    );
    return affectedMenuItemIds.size;
  }, [ingredients, recipeLines, menuItemRecipes]);

  return (
    <Layout>
      <div className="min-h-screen bg-slate-950 p-4 md:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('recipes.title', 'Recipes & Inventory')}</h1>
              <p className="text-sm text-white/50">{t('recipes.subtitle', 'Food cost control & ingredient management')}</p>
            </div>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} critical
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { void loadData(); }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh', 'Refresh')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: Ingredients ── */}
        {activeTab === 'ingredients' && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder={t('recipes.searchIngredients', 'Search ingredients...')}
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 py-2.5 pe-3 ps-9 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                  />
                </div>
                <select
                  value={ingredientCategory}
                  onChange={(e) => setIngredientCategory(e.target.value)}
                  className={SELECT_CLASS + ' max-w-[160px]'}
                >
                  <option value="all">All Categories</option>
                  {INGREDIENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{INGREDIENT_CATEGORY_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setReceiveStockOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Package className="h-4 w-4" /> {t('recipes.receiveStock', 'Receive Stock')}
                </button>
                <button
                  onClick={() => setAdjustStockOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <Edit2 className="h-4 w-4" /> {t('recipes.adjustStock', 'Adjust')}
                </button>
                <button
                  onClick={() => setAddIngredientOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" /> {t('recipes.addIngredient', 'Add Ingredient')}
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total Items', value: ingredients.filter((i) => i.is_active).length, color: 'text-white' },
                { label: 'Good Stock', value: ingredients.filter((i) => i.is_active && getIngredientStockStatus(i) === 'good').length, color: 'text-emerald-400' },
                { label: 'Low Stock', value: ingredients.filter((i) => i.is_active && getIngredientStockStatus(i) === 'low').length, color: 'text-amber-400' },
                { label: 'Critical', value: ingredients.filter((i) => i.is_active && getIngredientStockStatus(i) === 'critical').length, color: 'text-red-400' },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="mt-1 text-xs text-white/50">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Auto-86 summary banner */}
            {eightySixdIngredientCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
                <span className="text-red-300">
                  <span className="font-semibold">{eightySixdIngredientCount} ingredient{eightySixdIngredientCount !== 1 ? 's' : ''} out of stock</span>
                  {eightySixdMenuItemCount > 0 && (
                    <span className="text-red-400/80"> · {eightySixdMenuItemCount} menu item{eightySixdMenuItemCount !== 1 ? 's' : ''} auto-86'd</span>
                  )}
                </span>
              </div>
            )}

            {/* Ingredient table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 font-medium text-white/50">Name</th>
                    <th className="px-4 py-3 font-medium text-white/50">Category</th>
                    <th className="px-4 py-3 font-medium text-white/50">Unit</th>
                    <th className="px-4 py-3 font-medium text-white/50 text-right">Cost/Unit</th>
                    <th className="px-4 py-3 font-medium text-white/50 text-right">In Stock</th>
                    <th className="px-4 py-3 font-medium text-white/50 text-right">Reorder At</th>
                    <th className="px-4 py-3 font-medium text-white/50">Status</th>
                    <th className="px-4 py-3 font-medium text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="py-12 text-center text-white/40">Loading...</td></tr>
                  ) : filteredIngredients.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-white/40">No ingredients found. Add your first ingredient to get started.</td></tr>
                  ) : filteredIngredients.map((ing) => (
                    <tr key={ing.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{ing.name}</span>
                          {ing.current_stock <= 0 && (
                            <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">86'd</span>
                          )}
                        </div>
                        {ing.name_ar && <div className="text-xs text-white/40 mt-0.5">{ing.name_ar}</div>}
                        {ing.storage_location && <div className="text-xs text-white/30">{ing.storage_location}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/60 capitalize">{INGREDIENT_CATEGORY_LABELS[ing.category] ?? ing.category}</td>
                      <td className="px-4 py-3 text-white/60">{ing.unit}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/80">{fmtUSD(ing.cost_per_unit)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={getIngredientStockStatus(ing) === 'critical' ? 'text-red-400 font-semibold' : getIngredientStockStatus(ing) === 'low' ? 'text-amber-400' : 'text-white/80'}>
                          {fmt(ing.current_stock, 1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/50">{fmt(ing.reorder_level, 1)}</td>
                      <td className="px-4 py-3"><StockBadge ingredient={ing} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedIngredient(ing);
                            setIngForm({
                              name: ing.name, name_ar: ing.name_ar ?? '',
                              category: ing.category, unit: ing.unit,
                              cost_per_unit: String(ing.cost_per_unit),
                              current_stock: String(ing.current_stock),
                              reorder_level: String(ing.reorder_level),
                              par_level: String(ing.par_level),
                              shelf_life_days: ing.shelf_life_days ? String(ing.shelf_life_days) : '',
                              storage_location: ing.storage_location ?? '',
                              supplier_id: ing.supplier_id ?? '',
                            });
                            setEditIngredientOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: Recipes ── */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder={t('recipes.searchRecipes', 'Search recipes...')}
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-slate-800 py-2.5 pe-3 ps-9 text-sm text-white placeholder-white/30 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setAddRecipeOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" /> {t('recipes.createRecipe', 'Create Recipe')}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <div className="col-span-3 py-12 text-center text-white/40">Loading...</div>
              ) : filteredRecipes.length === 0 ? (
                <div className="col-span-3 rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <ChefHat className="mx-auto mb-3 h-10 w-10 text-white/20" />
                  <p className="text-white/40">No recipes yet. Create your first recipe to start tracking food cost.</p>
                </div>
              ) : filteredRecipes.map((recipe) => {
                const cost = getRecipeCost(recipe.id);
                const menuItemId = menuItemRecipes[recipe.id];
                const menuItem = menuItemId ? menuItemMap.get(menuItemId) : undefined;
                const price = menuItem?.price ?? 0;
                const costPct = price > 0 ? (cost / price) * 100 : 0;
                const lineCount = getRecipeIngredientCount(recipe.id);
                return (
                  <div key={recipe.id} className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{recipe.name}</h3>
                        <p className="text-xs text-white/50 mt-0.5">
                          {menuItem?.name ?? <span className="text-white/30 italic">Unlinked menu item</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => { setSelectedRecipe(recipe); setEditRecipeOpen(true); }}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Food Cost</div>
                        <div className="font-bold text-white">${fmt(cost)}</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Sell Price</div>
                        <div className="font-bold text-white">{price > 0 ? `$${fmt(price)}` : '—'}</div>
                      </div>
                    </div>

                    {price > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-white/50">Food Cost %</span>
                          <span className={`font-bold ${foodCostColor(costPct)}`}>{fmt(costPct, 1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${costPct < 30 ? 'bg-emerald-500' : costPct < 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(costPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                      <span>{lineCount} ingredient{lineCount !== 1 ? 's' : ''}</span>
                      <span>{recipe.yield_quantity} {recipe.yield_unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: Food Cost Dashboard ── */}
        {activeTab === 'food-cost' && (
          <div className="space-y-6">
            {/* Overview KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20">
                    <BarChart3 className="h-5 w-5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70">Recipes Tracked</span>
                </div>
                <div className="text-3xl font-bold text-white">{recipes.length}</div>
                <div className="text-xs text-white/40 mt-1">{recipes.length > 0 ? `${recipes.filter((r) => menuItemRecipes[r.id]).length} linked to menu` : 'Create recipes to track cost'}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
                    <TrendingDown className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70">Avg Food Cost %</span>
                </div>
                {(() => {
                  const linked = foodCostMetrics.filter((m) => m.price > 0);
                  const avg = linked.length > 0 ? linked.reduce((s, m) => s + m.costPct, 0) / linked.length : 0;
                  return (
                    <>
                      <div className={`text-3xl font-bold ${foodCostColor(avg)}`}>{fmt(avg, 1)}%</div>
                      <div className="text-xs text-white/40 mt-1">Target: &lt; 30% • Industry avg: 28-35%</div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </div>
                  <span className="text-sm font-medium text-white/70">Waste Cost (30d)</span>
                </div>
                <div className="text-3xl font-bold text-red-400">${fmt(totalWasteCost30)}</div>
                <div className="text-xs text-white/40 mt-1">{wasteLast30.length} waste events logged</div>
              </div>
            </div>

            {/* Most costly dishes */}
            {foodCostMetrics.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Dishes by Food Cost % — Highest First
                </h3>
                <div className="space-y-3">
                  {foodCostMetrics.slice(0, 10).map((m) => (
                    <div key={m.recipe.id} className="flex items-center gap-4">
                      <div className="w-40 flex-shrink-0">
                        <div className="text-sm font-medium text-white truncate">{m.recipe.name}</div>
                        <div className="text-xs text-white/40 truncate">{m.menuItemName}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/50">Cost ${fmt(m.cost)} / Sell ${fmt(m.price)}</span>
                          <span className={`font-bold ${foodCostColor(m.costPct)}`}>
                            {m.price > 0 ? `${fmt(m.costPct, 1)}%` : 'No price'}
                          </span>
                        </div>
                        {m.price > 0 && (
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.costPct < 30 ? 'bg-emerald-500' : m.costPct < 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(m.costPct, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${foodCostBg(m.costPct)}`}>
                        {m.costPct < 30 ? 'Excellent' : m.costPct < 40 ? 'Monitor' : 'Review Price'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex gap-4 text-xs text-white/40 pt-4 border-t border-white/5">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-500 inline-block" />&lt; 30% Excellent</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-500 inline-block" />30-40% Monitor</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-red-500 inline-block" />&gt; 40% Review</span>
                </div>
              </div>
            )}

            {/* Most profitable dishes */}
            {foodCostMetrics.filter((m) => m.price > 0).length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  Most Profitable Dishes (by Margin $)
                </h3>
                <div className="space-y-2">
                  {[...foodCostMetrics]
                    .filter((m) => m.price > 0)
                    .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
                    .slice(0, 5)
                    .map((m, idx) => (
                      <div key={m.recipe.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3">
                        <span className="text-lg font-bold text-white/20 w-6">#{idx + 1}</span>
                        <div className="flex-1">
                          <span className="font-medium text-white">{m.recipe.name}</span>
                          <span className="ms-2 text-xs text-white/40">{m.menuItemName}</span>
                        </div>
                        <span className="text-emerald-400 font-bold">${fmt(m.price - m.cost)} margin</span>
                        <span className={`text-xs ${foodCostColor(m.costPct)}`}>{fmt(m.costPct, 1)}% cost</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Ingredient deduction activity */}
            {deductionTotals.size > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 font-semibold text-white flex items-center gap-2">
                  <Info className="h-4 w-4 text-sky-400" />
                  Top Ingredients Used (last 30 days, auto-deducted from orders)
                </h3>
                <div className="space-y-2">
                  {[...deductionTotals.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([ingId, qty]) => {
                      const ing = ingredientMap.get(ingId);
                      if (!ing) return null;
                      const cost = qty * ing.cost_per_unit;
                      return (
                        <div key={ingId} className="flex items-center gap-3 text-sm">
                          <span className="flex-1 text-white/80">{ing.name}</span>
                          <span className="text-white/50 font-mono">{fmt(qty, 1)} {ing.unit}</span>
                          <span className="text-amber-400 font-mono">${fmt(cost)}</span>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )}

            {recipes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-white/20" />
                <p className="text-white/40">Create recipes and link them to menu items to see food cost analytics here.</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Suppliers ── */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setAddSupplierOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" /> {t('recipes.addSupplier', 'Add Supplier')}
              </button>
            </div>

            {suppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <Truck className="mx-auto mb-3 h-10 w-10 text-white/20" />
                <p className="text-white/40">No suppliers yet. Add your ingredient suppliers to track sourcing.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suppliers.map((sup) => (
                  <div key={sup.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{sup.name}</h3>
                        {sup.contact_name && <p className="text-xs text-white/50">{sup.contact_name}</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sup.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {sup.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {sup.phone && (
                      <div className="text-xs text-white/60">{sup.phone}</div>
                    )}

                    {sup.whatsapp && (
                      <a
                        href={`https://wa.me/${sup.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp: {sup.whatsapp}
                      </a>
                    )}

                    {sup.payment_terms && (
                      <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">
                        Terms: {sup.payment_terms}
                      </div>
                    )}

                    {sup.notes && (
                      <div className="text-xs text-white/40 italic">{sup.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Waste Log ── */}
        {activeTab === 'waste' && (
          <div className="space-y-4">

            {/* Inline Log Waste form */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-white/80 text-sm font-medium mb-3">Log Waste</h4>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={inlineWasteIngredientId}
                  onChange={(e) => setInlineWasteIngredientId(e.target.value)}
                  className="col-span-2 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Quantity"
                  value={inlineWasteQty}
                  onChange={(e) => setInlineWasteQty(e.target.value)}
                  min="0"
                  step="0.001"
                  className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 placeholder-white/30"
                />
                <select
                  value={inlineWasteReason}
                  onChange={(e) => setInlineWasteReason(e.target.value)}
                  className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="spoilage">Spoilage</option>
                  <option value="overproduction">Overproduction</option>
                  <option value="spill">Spill/Accident</option>
                  <option value="prep_waste">Trim/Prep waste</option>
                  <option value="expired">Expired</option>
                  <option value="quality">Quality rejection</option>
                  <option value="dropped">Dropped/Accident</option>
                  <option value="overcooked">Overcooked/Burnt</option>
                  <option value="customer_return">Customer Return</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {inlineWasteIngredientId && inlineWasteQty && (
                <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
                  Estimated cost: ${fmt((parseFloat(inlineWasteQty) || 0) * (ingredientMap.get(inlineWasteIngredientId)?.cost_per_unit ?? 0))}
                </div>
              )}
              <button
                onClick={() => { void handleInlineLogWaste(); }}
                disabled={inlineWasteSubmitting}
                className="mt-3 w-full bg-red-600/30 hover:bg-red-600/50 disabled:opacity-50 text-red-300 border border-red-500/30 rounded-xl px-4 py-2 text-sm transition-colors"
              >
                {inlineWasteSubmitting ? 'Logging...' : 'Log Waste'}
              </button>
            </div>

            {/* 30-day summary stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="text-xs text-white/50 mb-1">Total Waste Cost (30d)</div>
                <div className="text-2xl font-bold text-red-400">${fmt(totalWasteCost30)}</div>
                <div className="text-xs text-white/40 mt-1">{wasteLast30.length} events logged</div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="text-xs text-white/50 mb-1">Most Wasted Ingredient</div>
                <div className="text-lg font-bold text-amber-400 truncate">
                  {mostWastedIngredient ? mostWastedIngredient[0] : '—'}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {mostWastedIngredient ? `$${fmt(mostWastedIngredient[1])} wasted` : 'No data yet'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50 mb-1">Most Common Reason</div>
                <div className="text-lg font-bold text-white capitalize truncate">
                  {mostCommonReason ? mostCommonReason[0].replace(/_/g, ' ') : '—'}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {mostCommonReason ? `$${fmt(mostCommonReason[1])} cost` : 'No data yet'}
                </div>
              </div>
            </div>

            {/* 7-day waste chart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 font-semibold text-white text-sm">Daily Waste Cost — Last 7 Days</h3>
              <div className="flex items-end gap-2 h-32">
                {dailyWaste.map((day) => {
                  const pct = (day.cost / maxDailyWaste) * 100;
                  return (
                    <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-white/40">${fmt(day.cost, 0)}</span>
                      <div className="w-full rounded-t-md bg-red-500/30 flex items-end" style={{ height: '80px' }}>
                        <div
                          className="w-full rounded-t-md bg-red-500/70 transition-all"
                          style={{ height: `${Math.max(pct, day.cost > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-white/40">{day.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm border-t border-white/5 pt-3">
                <span className="text-white/50">Total (7 days)</span>
                <span className="font-semibold text-red-400">
                  ${fmt(dailyWaste.reduce((s, d) => s + d.cost, 0))}
                </span>
              </div>
            </div>

            {/* Waste log table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 font-medium text-white/50">Time</th>
                    <th className="px-4 py-3 font-medium text-white/50">Ingredient</th>
                    <th className="px-4 py-3 font-medium text-white/50">Qty</th>
                    <th className="px-4 py-3 font-medium text-white/50">Reason</th>
                    <th className="px-4 py-3 font-medium text-white/50 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteLog.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-white/40">No waste logged yet.</td></tr>
                  ) : wasteLog.slice(0, 50).map((entry) => {
                    const ing = ingredientMap.get(entry.ingredient_id);
                    const isHighCost = (entry.cost_value ?? 0) > 10;
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-white/5 transition-colors ${isHighCost ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-white/3'}`}
                      >
                        <td className="px-4 py-3 text-white/50 text-xs">
                          {new Date(entry.logged_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-white">{ing?.name ?? entry.ingredient_id}</td>
                        <td className="px-4 py-3 font-mono text-white/70">{fmt(entry.quantity, 2)} {entry.unit}</td>
                        <td className="px-4 py-3 text-white/60 capitalize">{(entry.reason ?? '—').replace(/_/g, ' ')}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${isHighCost ? 'text-red-300' : 'text-red-400'}`}>
                          ${fmt(entry.cost_value ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: Purchase Orders ── */}
        {activeTab === 'purchase-orders' && (
          <div className="space-y-5">

            {/* Low Stock Alert Banner */}
            {lowStockIngredients.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300 text-sm">
                    {lowStockIngredients.length} ingredient{lowStockIngredients.length !== 1 ? 's' : ''} below par level
                  </span>
                </div>
                <button
                  onClick={() => { void handleAutoCreatePO(lowStockIngredients); }}
                  disabled={poSubmitting}
                  className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {poSubmitting ? 'Creating…' : 'Auto-create PO'}
                </button>
              </div>
            )}

            {/* Suppliers compact list */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Truck className="h-4 w-4 text-sky-400" /> Suppliers
                </h3>
                <button
                  onClick={() => setAddSupplierOpen(true)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Supplier
                </button>
              </div>
              {suppliers.length === 0 ? (
                <p className="text-xs text-white/40 italic">No suppliers yet. Add a supplier to attach to purchase orders.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {suppliers.map((sup) => (
                    <div key={sup.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{sup.name}</div>
                        {sup.contact_name && <div className="text-xs text-white/50">{sup.contact_name}</div>}
                        {sup.phone && <div className="text-xs text-white/40">{sup.phone}</div>}
                      </div>
                      {sup.is_active ? (
                        <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5">Active</span>
                      ) : (
                        <span className="text-[10px] rounded-full bg-white/10 text-white/40 px-2 py-0.5">Inactive</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PO List header + Create button */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-400" />
                Purchase Orders
                <span className="text-xs text-white/40 font-normal">Last 20</span>
              </h3>
              <button
                onClick={() => setCreatePOOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" /> New PO
              </button>
            </div>

            {/* PO cards */}
            {purchaseOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-white/20" />
                <p className="text-white/40">No purchase orders yet. Create your first PO to track ingredient ordering.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.map((po) => {
                  const sup = suppliers.find((s) => s.id === po.supplier_id);
                  const itemCount = po.items?.length ?? 0;
                  const statusColors: Record<string, string> = {
                    draft: 'bg-white/10 text-white/60',
                    ordered: 'bg-sky-500/15 text-sky-400',
                    received: 'bg-emerald-500/15 text-emerald-400',
                    cancelled: 'bg-red-500/15 text-red-400',
                  };
                  const isReceiving = receivingPOId === po.id;
                  return (
                    <div key={po.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{po.order_number}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[po.status] ?? 'bg-white/10 text-white/50'}`}>
                              {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">
                            {new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {sup && <span> · {sup.name}</span>}
                            {po.expected_date && <span> · Expected {po.expected_date}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-white">${fmt(po.total_estimated)}</div>
                          <div className="text-xs text-white/40">{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
                        </div>
                      </div>

                      {/* PO items */}
                      {po.items && po.items.length > 0 && (
                        <div className="rounded-xl border border-white/5 bg-white/3 divide-y divide-white/5">
                          {po.items.map((item: RestaurantPOItem) => {
                            const ing = ingredientMap.get(item.ingredient_id);
                            return (
                              <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                                <span className="flex-1 text-white/80">{ing?.name ?? item.ingredient_id}</span>
                                <span className="text-white/50 font-mono">{fmt(item.quantity_ordered, 2)} {ing?.unit ?? ''}</span>
                                <span className="text-white/40 font-mono">@ ${fmt(item.unit_cost, 4)}</span>
                                <span className="text-white/60 font-mono">${fmt(item.quantity_ordered * item.unit_cost)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {po.notes && (
                        <p className="text-xs text-white/40 italic">{po.notes}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        {po.status === 'draft' && (
                          <button
                            onClick={() => { void handleMarkPOOrdered(po.id, po.order_number); }}
                            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20 transition-colors"
                          >
                            <Truck className="h-3.5 w-3.5" /> Mark as Ordered
                          </button>
                        )}
                        {po.status === 'ordered' && (
                          <button
                            onClick={() => { void handleReceivePO(po); }}
                            disabled={isReceiving}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                          >
                            <Package className="h-3.5 w-3.5" />
                            {isReceiving ? 'Receiving…' : 'Mark as Received'}
                          </button>
                        )}
                        {po.status === 'received' && po.received_at && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400/70">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Received {new Date(po.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Add / Edit Ingredient */}
      {(addIngredientOpen || editIngredientOpen) && (
        <Modal
          title={editIngredientOpen ? 'Edit Ingredient' : t('recipes.addIngredient', 'Add Ingredient')}
          onClose={() => { setAddIngredientOpen(false); setEditIngredientOpen(false); setSelectedIngredient(null); }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name (English) *">
              <input className={INPUT_CLASS} value={ingForm.name} onChange={(e) => setIngForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Salmon Fillet" />
            </FormField>
            <FormField label="Name (Arabic)">
              <input className={INPUT_CLASS} dir="rtl" value={ingForm.name_ar} onChange={(e) => setIngForm((p) => ({ ...p, name_ar: e.target.value }))} placeholder="فيليه سمك السلمون" />
            </FormField>
            <FormField label="Category">
              <select className={SELECT_CLASS} value={ingForm.category} onChange={(e) => setIngForm((p) => ({ ...p, category: e.target.value }))}>
                {INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{INGREDIENT_CATEGORY_LABELS[c] ?? c}</option>)}
              </select>
            </FormField>
            <FormField label="Unit *">
              <select className={SELECT_CLASS} value={ingForm.unit} onChange={(e) => setIngForm((p) => ({ ...p, unit: e.target.value }))}>
                {['g', 'kg', 'ml', 'L', 'unit', 'oz', 'lb', 'bunch', 'slice', 'tbsp', 'tsp'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </FormField>
            <FormField label="Cost per Unit (USD)">
              <input className={INPUT_CLASS} type="number" step="0.0001" min="0" value={ingForm.cost_per_unit} onChange={(e) => setIngForm((p) => ({ ...p, cost_per_unit: e.target.value }))} placeholder="0.0000" />
            </FormField>
            <FormField label="Current Stock">
              <input className={INPUT_CLASS} type="number" step="0.001" min="0" value={ingForm.current_stock} onChange={(e) => setIngForm((p) => ({ ...p, current_stock: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Reorder Level">
              <input className={INPUT_CLASS} type="number" step="0.001" min="0" value={ingForm.reorder_level} onChange={(e) => setIngForm((p) => ({ ...p, reorder_level: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Par Level">
              <input className={INPUT_CLASS} type="number" step="0.001" min="0" value={ingForm.par_level} onChange={(e) => setIngForm((p) => ({ ...p, par_level: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Shelf Life (days)">
              <input className={INPUT_CLASS} type="number" min="0" value={ingForm.shelf_life_days} onChange={(e) => setIngForm((p) => ({ ...p, shelf_life_days: e.target.value }))} placeholder="e.g. 3" />
            </FormField>
            <FormField label="Storage Location">
              <input className={INPUT_CLASS} value={ingForm.storage_location} onChange={(e) => setIngForm((p) => ({ ...p, storage_location: e.target.value }))} placeholder="e.g. Walk-in cooler, shelf A2" />
            </FormField>
            <FormField label="Supplier">
              <select className={SELECT_CLASS} value={ingForm.supplier_id} onChange={(e) => setIngForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => { setAddIngredientOpen(false); setEditIngredientOpen(false); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button
              onClick={() => { void (editIngredientOpen ? handleEditIngredient() : handleAddIngredient()); }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Save className="h-4 w-4" /> {editIngredientOpen ? 'Save Changes' : 'Add Ingredient'}
            </button>
          </div>
        </Modal>
      )}

      {/* Receive Stock */}
      {receiveStockOpen && (
        <Modal title={t('recipes.receiveStock', 'Receive Stock')} onClose={() => setReceiveStockOpen(false)}>
          <div className="space-y-4">
            <FormField label="Ingredient *">
              <select className={SELECT_CLASS} value={receiveForm.ingredient_id} onChange={(e) => setReceiveForm((p) => ({ ...p, ingredient_id: e.target.value }))}>
                <option value="">Select ingredient...</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} (current: {fmt(i.current_stock, 1)} {i.unit})</option>)}
              </select>
            </FormField>
            <FormField label="Quantity Received *">
              <input className={INPUT_CLASS} type="number" step="0.001" min="0" value={receiveForm.qty} onChange={(e) => setReceiveForm((p) => ({ ...p, qty: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Unit Cost (USD) — used for weighted average">
              <input className={INPUT_CLASS} type="number" step="0.0001" min="0" value={receiveForm.unit_cost} onChange={(e) => setReceiveForm((p) => ({ ...p, unit_cost: e.target.value }))} placeholder="Leave blank to keep current cost" />
            </FormField>
            <FormField label="Notes">
              <input className={INPUT_CLASS} value={receiveForm.notes} onChange={(e) => setReceiveForm((p) => ({ ...p, notes: e.target.value }))} placeholder="PO number, supplier delivery note..." />
            </FormField>
            {receiveForm.ingredient_id && receiveForm.qty && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                New stock: {fmt((ingredientMap.get(receiveForm.ingredient_id)?.current_stock ?? 0) + parseFloat(receiveForm.qty || '0'), 1)} {ingredientMap.get(receiveForm.ingredient_id)?.unit}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setReceiveStockOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={() => { void handleReceiveStock(); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              <Package className="h-4 w-4" /> Confirm Receipt
            </button>
          </div>
        </Modal>
      )}

      {/* Adjust Stock */}
      {adjustStockOpen && (
        <Modal title={t('recipes.adjustStock', 'Adjust Stock')} onClose={() => setAdjustStockOpen(false)}>
          <div className="space-y-4">
            <FormField label="Ingredient *">
              <select className={SELECT_CLASS} value={adjustForm.ingredient_id} onChange={(e) => setAdjustForm((p) => ({ ...p, ingredient_id: e.target.value }))}>
                <option value="">Select ingredient...</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} (current: {fmt(i.current_stock, 1)} {i.unit})</option>)}
              </select>
            </FormField>
            <FormField label="Adjustment (+/−)">
              <input className={INPUT_CLASS} type="number" step="0.001" value={adjustForm.qty} onChange={(e) => setAdjustForm((p) => ({ ...p, qty: e.target.value }))} placeholder="Use negative to reduce: -5" />
            </FormField>
            <FormField label="Reason / Notes">
              <input className={INPUT_CLASS} value={adjustForm.notes} onChange={(e) => setAdjustForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Cycle count correction, spillage..." />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setAdjustStockOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={() => { void handleAdjustStock(); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              <Save className="h-4 w-4" /> Apply Adjustment
            </button>
          </div>
        </Modal>
      )}

      {/* Create Recipe */}
      {addRecipeOpen && (
        <Modal title={t('recipes.createRecipe', 'Create Recipe')} onClose={() => { setAddRecipeOpen(false); setRecipeLines2([]); }}>
          <div className="space-y-5">
            {/* Step 1: Recipe info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Recipe Name *">
                <input className={INPUT_CLASS} value={recipeForm.name} onChange={(e) => setRecipeForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Grilled Salmon Fillet" />
              </FormField>
              <FormField label="Link to Menu Item">
                <select className={SELECT_CLASS} value={recipeForm.menu_item_id} onChange={(e) => setRecipeForm((p) => ({ ...p, menu_item_id: e.target.value }))}>
                  <option value="">None (unlinked)</option>
                  {menuItems.map((mi) => <option key={mi.id} value={mi.id}>{mi.name} (${fmt(mi.price)})</option>)}
                </select>
              </FormField>
              <FormField label="Yield Quantity">
                <input className={INPUT_CLASS} type="number" step="0.01" min="0.01" value={recipeForm.yield_quantity} onChange={(e) => setRecipeForm((p) => ({ ...p, yield_quantity: e.target.value }))} />
              </FormField>
              <FormField label="Yield Unit">
                <input className={INPUT_CLASS} value={recipeForm.yield_unit} onChange={(e) => setRecipeForm((p) => ({ ...p, yield_unit: e.target.value }))} placeholder="portion, plate, batch..." />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Notes / Method">
                  <textarea className={INPUT_CLASS} rows={2} value={recipeForm.notes} onChange={(e) => setRecipeForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Prep notes, cooking method..." />
                </FormField>
              </div>
            </div>

            {/* Step 2: Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Ingredients</h3>
                <button
                  onClick={() => setRecipeLines2((p) => [...p, { ingredient_id: '', quantity: '', unit: 'g', waste_factor: '1.0' }])}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Line
                </button>
              </div>

              {recipeLines2.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">
                  Click "Add Line" to add ingredients to this recipe
                </div>
              ) : (
                <div className="space-y-2">
                  {recipeLines2.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Ingredient</div>}
                        <select
                          className={SELECT_CLASS}
                          value={line.ingredient_id}
                          onChange={(e) => {
                            const ing = ingredientMap.get(e.target.value);
                            setRecipeLines2((p) => p.map((l, i) => i === idx ? { ...l, ingredient_id: e.target.value, unit: ing?.unit ?? l.unit } : l));
                          }}
                        >
                          <option value="">Select...</option>
                          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Qty</div>}
                        <input
                          className={INPUT_CLASS}
                          type="number" step="0.001" min="0"
                          value={line.quantity}
                          onChange={(e) => setRecipeLines2((p) => p.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Unit</div>}
                        <input
                          className={INPUT_CLASS}
                          value={line.unit}
                          onChange={(e) => setRecipeLines2((p) => p.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && (
                          <div className="text-[10px] text-white/40 mb-1 flex items-center gap-1">
                            Waste Factor
                            <span title="1.0 = no waste. 1.35 = 35% trimming waste." className="text-white/20 hover:text-white/50 cursor-help">ⓘ</span>
                          </div>
                        )}
                        <select
                          className={SELECT_CLASS + ' text-xs'}
                          value={line.waste_factor}
                          onChange={(e) => setRecipeLines2((p) => p.map((l, i) => i === idx ? { ...l, waste_factor: e.target.value } : l))}
                        >
                          {Object.entries(SUGGESTED_WASTE_FACTORS).map(([key, wf]) => (
                            <option key={key} value={String(wf.factor)}>{wf.factor.toFixed(2)} — {wf.label}</option>
                          ))}
                          <option value={line.waste_factor}>{line.waste_factor} (custom)</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => setRecipeLines2((p) => p.filter((_, i) => i !== idx))} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-red-400 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Live cost */}
              {recipeLines2.length > 0 && (
                <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Theoretical food cost</span>
                  <span className="text-lg font-bold text-indigo-300">${fmt(builderCost)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => { setAddRecipeOpen(false); setRecipeLines2([]); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={() => { void handleSaveRecipe(); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              <Save className="h-4 w-4" /> Save Recipe
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Recipe (basic — shows recipe details) */}
      {editRecipeOpen && selectedRecipe && (
        <Modal title={`Edit: ${selectedRecipe.name}`} onClose={() => { setEditRecipeOpen(false); setSelectedRecipe(null); }}>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="text-sm text-white/60">Recipe: <span className="text-white font-medium">{selectedRecipe.name}</span></div>
              <div className="text-sm text-white/60">Yield: <span className="text-white">{selectedRecipe.yield_quantity} {selectedRecipe.yield_unit}</span></div>
              {selectedRecipe.notes && <div className="text-sm text-white/60">Notes: <span className="text-white/80">{selectedRecipe.notes}</span></div>}
            </div>

            <h4 className="text-sm font-medium text-white">Current Ingredients</h4>
            {recipeLines.filter((l) => l.recipe_id === selectedRecipe.id).length === 0 ? (
              <div className="text-sm text-white/40 italic">No ingredients added yet.</div>
            ) : recipeLines.filter((l) => l.recipe_id === selectedRecipe.id).map((line) => {
              const ing = ingredientMap.get(line.ingredient_id);
              const lineCost = line.quantity * line.waste_factor * (ing?.cost_per_unit ?? 0);
              return (
                <div key={line.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3 text-sm">
                  <div className="flex-1">
                    <span className="text-white">{ing?.name ?? line.ingredient_id}</span>
                    <span className="ms-2 text-white/40">{fmt(line.quantity, 3)} {line.unit}</span>
                    {line.waste_factor > 1 && <span className="ms-1 text-amber-400/70 text-xs">×{line.waste_factor} waste</span>}
                  </div>
                  <span className="text-white/60 font-mono">${fmt(lineCost)}</span>
                </div>
              );
            })}

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-center justify-between">
              <span className="text-sm text-white/60">Total food cost</span>
              <span className="font-bold text-indigo-300">${fmt(getRecipeCost(selectedRecipe.id))}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => { setEditRecipeOpen(false); setSelectedRecipe(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Close</button>
          </div>
        </Modal>
      )}

      {/* Add Supplier */}
      {addSupplierOpen && (
        <Modal title={t('recipes.addSupplier', 'Add Supplier')} onClose={() => setAddSupplierOpen(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company Name *">
              <input className={INPUT_CLASS} value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Chtaura Fresh Produce" />
            </FormField>
            <FormField label="Contact Name">
              <input className={INPUT_CLASS} value={supplierForm.contact_name} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_name: e.target.value }))} placeholder="Abu Hassan" />
            </FormField>
            <FormField label="Phone">
              <input className={INPUT_CLASS} type="tel" value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+961 X XXX XXX" />
            </FormField>
            <FormField label="WhatsApp">
              <input className={INPUT_CLASS} type="tel" value={supplierForm.whatsapp} onChange={(e) => setSupplierForm((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="+961XXXXXXXX" />
            </FormField>
            <FormField label="Email">
              <input className={INPUT_CLASS} type="email" value={supplierForm.email} onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))} />
            </FormField>
            <FormField label="Payment Terms">
              <input className={INPUT_CLASS} value={supplierForm.payment_terms} onChange={(e) => setSupplierForm((p) => ({ ...p, payment_terms: e.target.value }))} placeholder="Net 30, COD, weekly..." />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Address">
                <input className={INPUT_CLASS} value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} placeholder="Bekaa Valley, Lebanon" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Notes">
                <textarea className={INPUT_CLASS} rows={2} value={supplierForm.notes} onChange={(e) => setSupplierForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Delivery days, minimum order, quality notes..." />
              </FormField>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setAddSupplierOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={() => { void handleAddSupplier(); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              <Save className="h-4 w-4" /> Add Supplier
            </button>
          </div>
        </Modal>
      )}

      {/* Log Waste */}
      {logWasteOpen && (
        <Modal title={t('recipes.logWaste', 'Log Waste')} onClose={() => setLogWasteOpen(false)}>
          <div className="space-y-4">
            <FormField label="Ingredient *">
              <select
                className={SELECT_CLASS}
                value={wasteForm.ingredient_id}
                onChange={(e) => {
                  const ing = ingredientMap.get(e.target.value);
                  setWasteForm((p) => ({ ...p, ingredient_id: e.target.value, unit: ing?.unit ?? p.unit }));
                }}
              >
                <option value="">Select ingredient...</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
            </FormField>
            <FormField label="Quantity Wasted *">
              <input className={INPUT_CLASS} type="number" step="0.001" min="0" value={wasteForm.quantity} onChange={(e) => setWasteForm((p) => ({ ...p, quantity: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Reason">
              <select className={SELECT_CLASS} value={wasteForm.reason} onChange={(e) => setWasteForm((p) => ({ ...p, reason: e.target.value }))}>
                <option value="prep_waste">Prep Waste (trim, peel, bones)</option>
                <option value="spoilage">Spoilage / Expired</option>
                <option value="dropped">Dropped / Accident</option>
                <option value="overcooked">Overcooked / Burnt</option>
                <option value="customer_return">Customer Return</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Cost Value (USD) — auto-calculated if blank">
              <input className={INPUT_CLASS} type="number" step="0.01" min="0" value={wasteForm.cost_value} onChange={(e) => setWasteForm((p) => ({ ...p, cost_value: e.target.value }))} placeholder="Leave blank to auto-calculate" />
            </FormField>
            {wasteForm.ingredient_id && wasteForm.quantity && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
                Cost estimate: ${fmt((parseFloat(wasteForm.quantity) || 0) * (ingredientMap.get(wasteForm.ingredient_id)?.cost_per_unit ?? 0))}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setLogWasteOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={() => { void handleLogWaste(); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
              <Trash2 className="h-4 w-4" /> Log Waste
            </button>
          </div>
        </Modal>
      )}

      {/* Create Purchase Order */}
      {createPOOpen && (
        <Modal title="New Purchase Order" onClose={() => { setCreatePOOpen(false); setPOItems([]); setPOForm({ supplier_id: '', notes: '', expected_date: '' }); }}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Supplier">
                <select className={SELECT_CLASS} value={poForm.supplier_id} onChange={(e) => setPOForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">No supplier assigned</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Expected Delivery Date">
                <input className={INPUT_CLASS} type="date" value={poForm.expected_date} onChange={(e) => setPOForm((p) => ({ ...p, expected_date: e.target.value }))} />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Notes">
                  <input className={INPUT_CLASS} value={poForm.notes} onChange={(e) => setPOForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Delivery notes, reference numbers..." />
                </FormField>
              </div>
            </div>

            {/* PO line items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Items *</h3>
                <button
                  onClick={() => setPOItems((p) => [...p, { ingredient_id: '', quantity: '', unit_cost: '' }])}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>

              {poItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">
                  Click "Add Item" to add ingredients to this PO
                </div>
              ) : (
                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Ingredient</div>}
                        <select
                          className={SELECT_CLASS}
                          value={item.ingredient_id}
                          onChange={(e) => {
                            const ing = ingredientMap.get(e.target.value);
                            setPOItems((p) => p.map((l, i) => i === idx ? {
                              ...l,
                              ingredient_id: e.target.value,
                              unit_cost: ing ? String(ing.cost_per_unit) : l.unit_cost,
                            } : l));
                          }}
                        >
                          <option value="">Select ingredient…</option>
                          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Qty to Order</div>}
                        <input
                          className={INPUT_CLASS}
                          type="number" step="0.001" min="0"
                          value={item.quantity}
                          onChange={(e) => setPOItems((p) => p.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <div className="text-[10px] text-white/40 mb-1">Unit Cost (USD)</div>}
                        <input
                          className={INPUT_CLASS}
                          type="number" step="0.0001" min="0"
                          value={item.unit_cost}
                          onChange={(e) => setPOItems((p) => p.map((l, i) => i === idx ? { ...l, unit_cost: e.target.value } : l))}
                          placeholder="0.0000"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => setPOItems((p) => p.filter((_, i) => i !== idx))} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-red-400 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Live total */}
              {poItems.some((l) => l.quantity && l.unit_cost) && (
                <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Estimated total</span>
                  <span className="text-lg font-bold text-indigo-300">
                    ${fmt(poItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => { setCreatePOOpen(false); setPOItems([]); setPOForm({ supplier_id: '', notes: '', expected_date: '' }); }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleCreatePO(); }}
              disabled={poSubmitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {poSubmitting ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
