import {
  Plus, Edit2, X, Check, BarChart3, Package, AlertTriangle,
  Scale, Tag, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type {
  SupermarketDepartment,
  PluCode,
  BulkPricingRule,
} from '@/types/supermarket';
import { GROCERY_DEPARTMENT_DEFAULTS } from '@/types/supermarket';
import { supabase } from '@/utils/supabaseClient';

type ActiveTab = 'departments' | 'plu' | 'bulk';

interface DeptFormData {
  name: string;
  code: string;
  emoji: string;
  color: string;
  shrinkage_target: string;
}

const EMPTY_DEPT: DeptFormData = { name: '', code: '', emoji: '🛒', color: '#10b981', shrinkage_target: '2.0' };

interface PluFormData {
  plu_code: string;
  name: string;
  price_per_kg: string;
  department_id: string;
}

const EMPTY_PLU: PluFormData = { plu_code: '', name: '', price_per_kg: '', department_id: '' };

interface BulkFormData {
  product_id: string;
  rule_type: BulkPricingRule['rule_type'];
  min_quantity: string;
  discount_percent: string;
  fixed_price_usd: string;
  free_qty: string;
}

const EMPTY_BULK: BulkFormData = {
  product_id: '',
  rule_type: 'qty_break',
  min_quantity: '2',
  discount_percent: '',
  fixed_price_usd: '',
  free_qty: '',
};

export default function DepartmentManager() {
  const { t } = useTranslation();
  const { currentTenant, products } = useApp();
  const tenantId = currentTenant?.id;

  const [tab, setTab] = useState<ActiveTab>('departments');
  const [departments, setDepartments] = useState<SupermarketDepartment[]>([]);
  const [pluCodes, setPluCodes] = useState<PluCode[]>([]);
  const [bulkRules, setBulkRules] = useState<BulkPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // Department form
  const [deptModal, setDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<SupermarketDepartment | null>(null);
  const [deptForm, setDeptForm] = useState<DeptFormData>(EMPTY_DEPT);
  const [savingDept, setSavingDept] = useState(false);

  // PLU form
  const [pluModal, setPluModal] = useState(false);
  const [pluForm, setPluForm] = useState<PluFormData>(EMPTY_PLU);
  const [savingPlu, setSavingPlu] = useState(false);

  // Bulk pricing form
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkFormData>(EMPTY_BULK);
  const [savingBulk, setSavingBulk] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [deptsResult, pluResult, bulkResult] = await Promise.all([
        supabase.from('supermarket_departments').select('*').eq('tenant_id', tenantId).order('name'),
        supabase.from('plu_codes').select('*').eq('tenant_id', tenantId).order('plu_code'),
        supabase.from('bulk_pricing_rules').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      ]);
      setDepartments((deptsResult.data ?? []) as SupermarketDepartment[]);
      setPluCodes((pluResult.data ?? []) as PluCode[]);
      setBulkRules((bulkResult.data ?? []) as BulkPricingRule[]);
    } catch {
      toast.error(t('supermarket.loadError', 'Failed to load supermarket data'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Seed default departments if none exist
  const seedDefaults = async () => {
    if (!tenantId || departments.length > 0) return;
    try {
      const rows = GROCERY_DEPARTMENT_DEFAULTS.map(d => ({ ...d, tenant_id: tenantId }));
      await supabase.from('supermarket_departments').insert(rows);
      await loadData();
      toast.success(t('supermarket.defaultsSeeded', '8 default departments created'));
    } catch {
      toast.error(t('supermarket.seedError', 'Failed to seed departments'));
    }
  };

  // ── Department CRUD ────────────────────────────────────────────────────────
  const openAddDept = () => { setEditDept(null); setDeptForm(EMPTY_DEPT); setDeptModal(true); };
  const openEditDept = (dept: SupermarketDepartment) => {
    setEditDept(dept);
    setDeptForm({ name: dept.name, code: dept.code, emoji: dept.emoji, color: dept.color, shrinkage_target: String(dept.shrinkage_target) });
    setDeptModal(true);
  };

  const saveDept = async () => {
    if (!tenantId || !deptForm.name.trim() || !deptForm.code.trim()) {
      toast.error(t('supermarket.deptRequired', 'Name and code are required'));
      return;
    }
    setSavingDept(true);
    try {
      const payload = {
        tenant_id: tenantId,
        name: deptForm.name.trim(),
        code: deptForm.code.trim().toUpperCase(),
        emoji: deptForm.emoji.trim() || '🛒',
        color: deptForm.color,
        shrinkage_target: parseFloat(deptForm.shrinkage_target) || 2.0,
      };
      if (editDept) {
        await supabase.from('supermarket_departments').update(payload).eq('id', editDept.id);
        toast.success(t('supermarket.deptUpdated', 'Department updated'));
      } else {
        await supabase.from('supermarket_departments').insert(payload);
        toast.success(t('supermarket.deptAdded', 'Department added'));
      }
      setDeptModal(false);
      await loadData();
    } catch {
      toast.error(t('supermarket.deptSaveError', 'Failed to save department'));
    } finally {
      setSavingDept(false);
    }
  };

  const deleteDept = async (id: string) => {
    if (!confirm(t('supermarket.confirmDeleteDept', 'Delete this department? Products will be unassigned.'))) return;
    await supabase.from('supermarket_departments').delete().eq('id', id);
    await loadData();
  };

  // ── PLU CRUD ───────────────────────────────────────────────────────────────
  const savePlu = async () => {
    if (!tenantId || !pluForm.plu_code.trim() || !pluForm.name.trim()) {
      toast.error(t('supermarket.pluRequired', 'PLU code and name are required'));
      return;
    }
    setSavingPlu(true);
    try {
      await supabase.from('plu_codes').insert({
        tenant_id: tenantId,
        plu_code: pluForm.plu_code.trim(),
        name: pluForm.name.trim(),
        price_per_kg: parseFloat(pluForm.price_per_kg) || 0,
        department_id: pluForm.department_id || null,
        active: true,
      });
      toast.success(t('supermarket.pluAdded', 'PLU code added'));
      setPluModal(false);
      setPluForm(EMPTY_PLU);
      await loadData();
    } catch {
      toast.error(t('supermarket.pluSaveError', 'Failed to save PLU code'));
    } finally {
      setSavingPlu(false);
    }
  };

  const togglePlu = async (plu: PluCode) => {
    await supabase.from('plu_codes').update({ active: !plu.active }).eq('id', plu.id);
    await loadData();
  };

  // ── Bulk pricing CRUD ──────────────────────────────────────────────────────
  const saveBulk = async () => {
    if (!tenantId || !bulkForm.product_id) {
      toast.error(t('supermarket.bulkRequired', 'Select a product'));
      return;
    }
    setSavingBulk(true);
    try {
      await supabase.from('bulk_pricing_rules').insert({
        tenant_id: tenantId,
        product_id: bulkForm.product_id,
        rule_type: bulkForm.rule_type,
        min_quantity: parseInt(bulkForm.min_quantity) || 2,
        discount_percent: bulkForm.discount_percent ? parseFloat(bulkForm.discount_percent) : null,
        fixed_price_usd: bulkForm.fixed_price_usd ? parseFloat(bulkForm.fixed_price_usd) : null,
        free_qty: bulkForm.free_qty ? parseInt(bulkForm.free_qty) : null,
        active: true,
      });
      toast.success(t('supermarket.bulkAdded', 'Pricing rule added'));
      setBulkModal(false);
      setBulkForm(EMPTY_BULK);
      await loadData();
    } catch {
      toast.error(t('supermarket.bulkSaveError', 'Failed to save pricing rule'));
    } finally {
      setSavingBulk(false);
    }
  };

  const toggleBulk = async (rule: BulkPricingRule) => {
    await supabase.from('bulk_pricing_rules').update({ active: !rule.active }).eq('id', rule.id);
    await loadData();
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name ?? id;

  const BULK_TYPE_LABELS: Record<BulkPricingRule['rule_type'], string> = {
    qty_break: t('supermarket.bulkTypeQtyBreak', 'Quantity Break'),
    bogo: t('supermarket.bulkTypeBogo', 'Buy X Get Y Free'),
    case_price: t('supermarket.bulkTypeCasePrice', 'Case Price'),
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/15 border border-green-500/30 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('supermarket.departments', 'Departments')}</h1>
              <p className="text-white/50 text-xs">{t('supermarket.departmentsSubtitle', 'Manage grocery departments, PLU codes, and bulk pricing')}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {(['departments', 'plu', 'bulk'] as const).map(t_ => (
            <button
              key={t_}
              onClick={() => setTab(t_)}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                tab === t_
                  ? 'bg-green-500/10 text-green-400 border-b-2 border-green-400'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t_ === 'departments' && t('supermarket.tabDepts', 'Departments')}
              {t_ === 'plu' && t('supermarket.tabPlu', 'PLU Codes')}
              {t_ === 'bulk' && t('supermarket.tabBulk', 'Bulk Pricing')}
            </button>
          ))}
        </div>

        {/* ── Departments tab ── */}
        {tab === 'departments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-sm">
                {departments.length === 0
                  ? t('supermarket.noDepts', 'No departments yet')
                  : t('supermarket.deptCount', '{{n}} departments', { n: departments.length })}
              </p>
              <div className="flex gap-2">
                {departments.length === 0 && (
                  <button
                    onClick={() => { void seedDefaults(); }}
                    className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                  >
                    {t('supermarket.seedDefaults', 'Add 8 Default Departments')}
                  </button>
                )}
                <button
                  onClick={openAddDept}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-lime-600 text-white text-sm font-medium hover:from-green-500 hover:to-lime-500 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t('supermarket.addDept', 'Add Department')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {departments.map(dept => {
                const deptProducts = products.filter(() => true); // All products (department filtering in full version)
                const isExpanded = expandedDept === dept.id;
                return (
                  <div
                    key={dept.id}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{dept.emoji}</span>
                          <div>
                            <div className="text-white font-semibold text-sm">{dept.name}</div>
                            <div className="text-white/40 text-xs">{dept.code}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditDept(dept)} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { void deleteDept(dept.id); }} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/5 rounded-xl p-2 text-center">
                          <Package className="w-3.5 h-3.5 text-white/40 mx-auto mb-0.5" />
                          <div className="text-white text-sm font-semibold">{deptProducts.length}</div>
                          <div className="text-white/40 text-[10px]">{t('supermarket.products', 'Products')}</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2 text-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-0.5" />
                          <div className="text-yellow-400 text-sm font-semibold">{dept.shrinkage_target}%</div>
                          <div className="text-white/40 text-[10px]">{t('supermarket.shrinkageTarget', 'Shrinkage')}</div>
                        </div>
                      </div>

                      <div
                        className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-3"
                        title={`Color: ${dept.color}`}
                      >
                        <div className="h-full rounded-full" style={{ backgroundColor: dept.color, width: '100%' }} />
                      </div>

                      <button
                        onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                        className="w-full flex items-center justify-center gap-1 text-white/40 text-xs hover:text-white/70 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? t('supermarket.collapse', 'Collapse') : t('supermarket.viewDetails', 'Details')}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">{t('supermarket.stockValue', 'Stock Value')}</span>
                          <span className="text-white">$0.00</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">{t('supermarket.wasteMonth', 'Waste (month)')}</span>
                          <span className="text-red-400">$0.00</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">{t('supermarket.expiringSoon', 'Expiring Soon')}</span>
                          <span className="text-amber-400">0 {t('supermarket.lots', 'lots')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {departments.length === 0 && (
              <div className="text-center py-16 text-white/40">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{t('supermarket.noDepts', 'No departments yet')}</p>
                <p className="text-sm mt-1">{t('supermarket.noDeptsSub', 'Add default departments or create your own')}</p>
              </div>
            )}
          </div>
        )}

        {/* ── PLU Codes tab ── */}
        {tab === 'plu' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-sm">{pluCodes.length} {t('supermarket.pluTotal', 'PLU codes')}</p>
              <button
                onClick={() => { setPluForm(EMPTY_PLU); setPluModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-medium hover:from-sky-500 hover:to-blue-500 transition-all"
              >
                <Plus className="w-4 h-4" />
                {t('supermarket.addPlu', 'Add PLU Code')}
              </button>
            </div>

            {pluCodes.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{t('supermarket.noPlu', 'No PLU codes yet')}</p>
                <p className="text-sm mt-1">{t('supermarket.noPluSub', 'Add PLU codes for weight-based produce items')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="text-left py-2 px-3">{t('supermarket.pluCode', 'PLU')}</th>
                      <th className="text-left py-2 px-3">{t('supermarket.itemName', 'Item')}</th>
                      <th className="text-right py-2 px-3">{t('supermarket.pricePerKg', '$/kg')}</th>
                      <th className="text-left py-2 px-3">{t('supermarket.department', 'Dept')}</th>
                      <th className="text-center py-2 px-3">{t('supermarket.statusHeader', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pluCodes.map(plu => {
                      const dept = departments.find(d => d.id === plu.department_id);
                      return (
                        <tr key={plu.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-sky-400 font-semibold">{plu.plu_code}</td>
                          <td className="py-2.5 px-3 text-white">{plu.name}</td>
                          <td className="py-2.5 px-3 text-right text-green-400">${plu.price_per_kg.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-white/60">{dept ? `${dept.emoji} ${dept.name}` : '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => { void togglePlu(plu); }}
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                plu.active
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                  : 'bg-white/5 text-white/40 border border-white/10'
                              }`}
                            >
                              {plu.active ? t('supermarket.active', 'Active') : t('supermarket.inactive', 'Inactive')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Bulk Pricing tab ── */}
        {tab === 'bulk' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-sm">{bulkRules.length} {t('supermarket.bulkTotal', 'pricing rules')}</p>
              <button
                onClick={() => { setBulkForm(EMPTY_BULK); setBulkModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-500 hover:to-violet-500 transition-all"
              >
                <Plus className="w-4 h-4" />
                {t('supermarket.addBulk', 'Add Rule')}
              </button>
            </div>

            {bulkRules.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{t('supermarket.noBulk', 'No bulk pricing rules yet')}</p>
                <p className="text-sm mt-1">{t('supermarket.noBulkSub', 'Create quantity breaks, BOGO deals, or case prices')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bulkRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        rule.rule_type === 'qty_break'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : rule.rule_type === 'bogo'
                            ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {BULK_TYPE_LABELS[rule.rule_type]}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{productName(rule.product_id)}</div>
                        <div className="text-white/50 text-xs">
                          {t('supermarket.minQty', 'Min: {{n}} units', { n: rule.min_quantity })}
                          {rule.discount_percent !== null && ` · ${rule.discount_percent}% off`}
                          {rule.fixed_price_usd !== null && ` · $${rule.fixed_price_usd.toFixed(2)} fixed`}
                          {rule.free_qty !== null && ` · +${rule.free_qty} free`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { void toggleBulk(rule); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.active
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}
                    >
                      {rule.active ? t('supermarket.active', 'Active') : t('supermarket.inactive', 'Inactive')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Department Modal ── */}
      {deptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">
                {editDept ? t('supermarket.editDept', 'Edit Department') : t('supermarket.addDept', 'Add Department')}
              </h3>
              <button onClick={() => setDeptModal(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">{t('supermarket.emoji', 'Emoji')}</label>
                  <input
                    type="text"
                    value={deptForm.emoji}
                    onChange={e => setDeptForm(f => ({ ...f, emoji: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-center text-2xl"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">{t('supermarket.color', 'Color')}</label>
                  <input
                    type="color"
                    value={deptForm.color}
                    onChange={e => setDeptForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full h-10 bg-slate-800 border border-white/20 rounded-xl cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.deptName', 'Department Name')}</label>
                <input
                  type="text"
                  value={deptForm.name}
                  onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Produce"
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.deptCode', 'Code (unique)')}</label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={e => setDeptForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="PRODUCE"
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 font-mono uppercase placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.shrinkageTarget', 'Shrinkage Target (%)')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={deptForm.shrinkage_target}
                  onChange={e => setDeptForm(f => ({ ...f, shrinkage_target: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeptModal(false)} className="flex-1 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => { void saveDept(); }}
                disabled={savingDept}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-600 to-lime-600 text-white text-sm font-medium hover:from-green-500 hover:to-lime-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingDept ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLU Modal ── */}
      {pluModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{t('supermarket.addPlu', 'Add PLU Code')}</h3>
              <button onClick={() => setPluModal(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.pluCode', 'PLU Code (4-digit)')}</label>
                <input
                  type="text"
                  value={pluForm.plu_code}
                  onChange={e => setPluForm(f => ({ ...f, plu_code: e.target.value }))}
                  placeholder="3001"
                  maxLength={6}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 font-mono placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.itemName', 'Item Name')}</label>
                <input
                  type="text"
                  value={pluForm.name}
                  onChange={e => setPluForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Bananas"
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.pricePerKg', 'Price per kg (USD)')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pluForm.price_per_kg}
                  onChange={e => setPluForm(f => ({ ...f, price_per_kg: e.target.value }))}
                  placeholder="2.50"
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.department', 'Department')}</label>
                <select
                  value={pluForm.department_id}
                  onChange={e => setPluForm(f => ({ ...f, department_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                >
                  <option value="">{t('supermarket.selectDept', 'Select department')}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPluModal(false)} className="flex-1 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => { void savePlu(); }}
                disabled={savingPlu}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-medium hover:from-sky-500 hover:to-blue-500 transition-all disabled:opacity-50"
              >
                {savingPlu ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Pricing Modal ── */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{t('supermarket.addBulk', 'Add Pricing Rule')}</h3>
              <button onClick={() => setBulkModal(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.product', 'Product')}</label>
                <select
                  value={bulkForm.product_id}
                  onChange={e => setBulkForm(f => ({ ...f, product_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                >
                  <option value="">{t('supermarket.selectProduct', 'Select product')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.ruleType', 'Rule Type')}</label>
                <select
                  value={bulkForm.rule_type}
                  onChange={e => setBulkForm(f => ({ ...f, rule_type: e.target.value as BulkPricingRule['rule_type'] }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                >
                  <option value="qty_break">{t('supermarket.bulkTypeQtyBreak', 'Quantity Break')}</option>
                  <option value="bogo">{t('supermarket.bulkTypeBogo', 'Buy X Get Y Free')}</option>
                  <option value="case_price">{t('supermarket.bulkTypeCasePrice', 'Case Price')}</option>
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">{t('supermarket.minQtyLabel', 'Minimum Quantity')}</label>
                <input
                  type="number"
                  min="2"
                  value={bulkForm.min_quantity}
                  onChange={e => setBulkForm(f => ({ ...f, min_quantity: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                />
              </div>
              {bulkForm.rule_type === 'qty_break' && (
                <div>
                  <label className="block text-white/60 text-xs mb-1">{t('supermarket.discountPct', 'Discount %')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={bulkForm.discount_percent}
                    onChange={e => setBulkForm(f => ({ ...f, discount_percent: e.target.value }))}
                    placeholder="10"
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                  />
                </div>
              )}
              {bulkForm.rule_type === 'bogo' && (
                <div>
                  <label className="block text-white/60 text-xs mb-1">{t('supermarket.freeQty', 'Free Units Given')}</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkForm.free_qty}
                    onChange={e => setBulkForm(f => ({ ...f, free_qty: e.target.value }))}
                    placeholder="1"
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                  />
                </div>
              )}
              {bulkForm.rule_type === 'case_price' && (
                <div>
                  <label className="block text-white/60 text-xs mb-1">{t('supermarket.fixedPrice', 'Fixed Case Price (USD)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkForm.fixed_price_usd}
                    onChange={e => setBulkForm(f => ({ ...f, fixed_price_usd: e.target.value }))}
                    placeholder="24.99"
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setBulkModal(false)} className="flex-1 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => { void saveBulk(); }}
                disabled={savingBulk}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-500 hover:to-violet-500 transition-all disabled:opacity-50"
              >
                {savingBulk ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
