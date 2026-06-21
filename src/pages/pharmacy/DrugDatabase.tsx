import {
  Search, Plus, X, Pill, AlertTriangle, Package, Edit2, CheckCircle,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import ExpiryAlertDashboard from '@/components/pharmacy/ExpiryAlertDashboard';
import { useApp } from '@/context/AppContext';
import type { Drug, DrugClassification, DrugLot } from '@/types/pharmacy';
import {
  DRUG_CLASSIFICATION_COLORS,
  DRUG_CLASSIFICATION_LABELS,
} from '@/types/pharmacy';
import { supabase } from '@/utils/supabaseClient';

interface DrugFormData {
  trade_name: string;
  generic_name: string;
  atc_code: string;
  manufacturer: string;
  classification: DrugClassification;
  form: string;
  strength: string;
  vat_rate: number;
  barcode: string;
}

const EMPTY_FORM: DrugFormData = {
  trade_name: '',
  generic_name: '',
  atc_code: '',
  manufacturer: '',
  classification: 'otc',
  form: '',
  strength: '',
  vat_rate: 0,
  barcode: '',
};

const DRUG_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Suppository', 'Patch', 'Other'];

interface LotFormData {
  lot_number: string;
  expiry_date: string;
  quantity_received: number;
  unit_cost: number;
}

const EMPTY_LOT: LotFormData = {
  lot_number: '',
  expiry_date: '',
  quantity_received: 0,
  unit_cost: 0,
};

type ViewTab = 'drugs' | 'expiry';

export default function DrugDatabase() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [tab, setTab] = useState<ViewTab>('drugs');
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [lots, setLots] = useState<DrugLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<DrugClassification | 'all'>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [editDrug, setEditDrug] = useState<Drug | null>(null);
  const [form, setForm] = useState<DrugFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [addLotOpen, setAddLotOpen] = useState(false);
  const [lotTargetDrug, setLotTargetDrug] = useState<Drug | null>(null);
  const [lotForm, setLotForm] = useState<LotFormData>(EMPTY_LOT);
  const [savingLot, setSavingLot] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [drugsRes, lotsRes] = await Promise.all([
        supabase.from('drugs').select('*').eq('tenant_id', tenantId).order('trade_name'),
        supabase.from('drug_lots').select('*').eq('tenant_id', tenantId).order('expiry_date'),
      ]);
      if (drugsRes.error) throw drugsRes.error;
      if (lotsRes.error) throw lotsRes.error;
      setDrugs((drugsRes.data as Drug[]) ?? []);
      setLots((lotsRes.data as DrugLot[]) ?? []);
    } catch (err) {
      toast.error(t('pharmacy.loadError', 'Failed to load drug database'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadData(); }, [loadData]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditDrug(null); setAddOpen(true); };
  const openEdit = (drug: Drug) => {
    setForm({
      trade_name: drug.trade_name,
      generic_name: drug.generic_name,
      atc_code: drug.atc_code ?? '',
      manufacturer: drug.manufacturer ?? '',
      classification: drug.classification,
      form: drug.form ?? '',
      strength: drug.strength ?? '',
      vat_rate: drug.vat_rate,
      barcode: drug.barcode ?? '',
    });
    setEditDrug(drug);
    setAddOpen(true);
  };

  const saveDrug = async () => {
    if (!tenantId || !form.trade_name || !form.generic_name) {
      toast.error(t('pharmacy.requiredFields', 'Trade name and generic name are required'));
      return;
    }
    setSaving(true);
    try {
      if (editDrug) {
        const { error } = await supabase.from('drugs').update({
          trade_name: form.trade_name,
          generic_name: form.generic_name,
          atc_code: form.atc_code || null,
          manufacturer: form.manufacturer || null,
          classification: form.classification,
          form: form.form || null,
          strength: form.strength || null,
          vat_rate: form.vat_rate,
          barcode: form.barcode || null,
        }).eq('id', editDrug.id);
        if (error) throw error;
        toast.success(t('pharmacy.drugUpdated', 'Drug updated'));
      } else {
        const { error } = await supabase.from('drugs').insert({
          tenant_id: tenantId,
          trade_name: form.trade_name,
          generic_name: form.generic_name,
          atc_code: form.atc_code || null,
          manufacturer: form.manufacturer || null,
          classification: form.classification,
          form: form.form || null,
          strength: form.strength || null,
          vat_rate: form.vat_rate,
          barcode: form.barcode || null,
        });
        if (error) throw error;
        toast.success(t('pharmacy.drugAdded', 'Drug added to database'));
      }
      setAddOpen(false);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.saveError', 'Failed to save drug'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openAddLot = (drug: Drug) => {
    setLotTargetDrug(drug);
    setLotForm(EMPTY_LOT);
    setAddLotOpen(true);
  };

  const saveLot = async () => {
    if (!tenantId || !lotTargetDrug || !lotForm.lot_number || !lotForm.expiry_date) {
      toast.error(t('pharmacy.lotRequiredFields', 'Lot number and expiry date are required'));
      return;
    }
    setSavingLot(true);
    try {
      const { error } = await supabase.from('drug_lots').insert({
        tenant_id: tenantId,
        drug_id: lotTargetDrug.id,
        lot_number: lotForm.lot_number,
        expiry_date: lotForm.expiry_date,
        quantity_received: lotForm.quantity_received,
        quantity_remaining: lotForm.quantity_received,
        unit_cost: lotForm.unit_cost,
      });
      if (error) throw error;
      toast.success(t('pharmacy.lotAdded', 'Lot added'));
      setAddLotOpen(false);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.saveLotError', 'Failed to save lot'));
      console.error(err);
    } finally {
      setSavingLot(false);
    }
  };

  const filtered = drugs.filter(d => {
    const q = search.toLowerCase();
    const matchesSearch = !q || d.trade_name.toLowerCase().includes(q)
      || d.generic_name.toLowerCase().includes(q)
      || (d.atc_code?.toLowerCase().includes(q) ?? false)
      || (d.manufacturer?.toLowerCase().includes(q) ?? false);
    const matchesClass = classFilter === 'all' || d.classification === classFilter;
    return matchesSearch && matchesClass;
  });

  const getDrugLots = (drugId: string) => lots.filter(l => l.drug_id === drugId && l.quantity_remaining > 0);

  const today = new Date();
  const getExpiryStatus = (expiryDate: string) => {
    const exp = new Date(expiryDate);
    const diffDays = Math.floor((exp.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'critical';
    if (diffDays <= 30) return 'warning';
    return 'ok';
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('pharmacy.drugDatabase', 'Drug Database')}</h1>
            <p className="text-white/50 text-sm mt-1">
              {t('pharmacy.drugDatabaseDesc', 'Manage drugs, lots, and FEFO expiry tracking')}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {t('pharmacy.addDrug', 'Add Drug')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['drugs', 'expiry'] as ViewTab[]).map(v => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === v
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {v === 'drugs' ? t('pharmacy.drugs', 'Drugs') : t('pharmacy.expiryAlerts', 'Expiry Alerts')}
            </button>
          ))}
        </div>

        {tab === 'expiry' && (
          <ExpiryAlertDashboard lots={lots} drugs={drugs} onRefresh={() => void loadData()} />
        )}

        {tab === 'drugs' && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('pharmacy.searchDrugs', 'Search by trade name, generic, ATC, manufacturer…')}
                  className="w-full bg-slate-800 border border-white/10 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value as DrugClassification | 'all')}
                className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              >
                <option value="all">{t('pharmacy.allClasses', 'All Classes')}</option>
                <option value="otc">{DRUG_CLASSIFICATION_LABELS.otc}</option>
                <option value="prescription_required">{DRUG_CLASSIFICATION_LABELS.prescription_required}</option>
                <option value="controlled">{DRUG_CLASSIFICATION_LABELS.controlled}</option>
              </select>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('pharmacy.totalDrugs', 'Total Drugs'), value: drugs.length, icon: Pill, color: 'text-indigo-400' },
                { label: t('pharmacy.otcDrugs', 'OTC'), value: drugs.filter(d => d.classification === 'otc').length, icon: CheckCircle, color: 'text-emerald-400' },
                { label: t('pharmacy.rxDrugs', 'Prescription'), value: drugs.filter(d => d.classification === 'prescription_required').length, icon: Package, color: 'text-amber-400' },
                { label: t('pharmacy.controlledDrugs', 'Controlled'), value: drugs.filter(d => d.classification === 'controlled').length, icon: AlertTriangle, color: 'text-red-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-white/50 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Drug list */}
            {loading ? (
              <div className="text-white/40 text-center py-12">{t('common.loading', 'Loading…')}</div>
            ) : filtered.length === 0 ? (
              <div className="text-white/40 text-center py-12">
                <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
                {search ? t('pharmacy.noResults', 'No drugs match your search') : t('pharmacy.noDrugs', 'No drugs yet — add your first drug')}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(drug => {
                  const drugLots = getDrugLots(drug.id);
                  const totalStock = drugLots.reduce((s, l) => s + l.quantity_remaining, 0);
                  const earliestExpiry = drugLots.length > 0
                    ? drugLots.reduce((earliest, l) => l.expiry_date < earliest ? l.expiry_date : earliest, drugLots[0]!.expiry_date)
                    : null;
                  const expiryStatus = earliestExpiry ? getExpiryStatus(earliestExpiry) : null;
                  const classColors = DRUG_CLASSIFICATION_COLORS[drug.classification];

                  return (
                    <div
                      key={drug.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{drug.trade_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${classColors.bg} ${classColors.text} ${classColors.border}`}>
                              {DRUG_CLASSIFICATION_LABELS[drug.classification]}
                            </span>
                            {drug.vat_rate === 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                                {t('pharmacy.vatExempt', 'VAT Exempt')}
                              </span>
                            )}
                            {drug.vat_rate > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                {t('pharmacy.vatRate', 'VAT {{rate}}%', { rate: drug.vat_rate })}
                              </span>
                            )}
                          </div>
                          <div className="text-white/60 text-sm mt-0.5">
                            {drug.generic_name}
                            {drug.strength && <span className="ml-2 text-white/40">{drug.strength}</span>}
                            {drug.form && <span className="ml-2 text-white/40">· {drug.form}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                            {drug.atc_code && <span>ATC: {drug.atc_code}</span>}
                            {drug.manufacturer && <span>{drug.manufacturer}</span>}
                            {drug.barcode && <span>#{drug.barcode}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-white font-medium text-sm">{totalStock} {t('pharmacy.units', 'units')}</div>
                            {earliestExpiry && (
                              <div className={`text-xs mt-0.5 ${
                                expiryStatus === 'expired' ? 'text-red-400' :
                                  expiryStatus === 'critical' ? 'text-red-400' :
                                    expiryStatus === 'warning' ? 'text-amber-400' : 'text-white/40'
                              }`}>
                                {expiryStatus === 'expired'
                                  ? t('pharmacy.expired', 'EXPIRED')
                                  : t('pharmacy.exp', 'Exp: {{date}}', { date: earliestExpiry })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => openAddLot(drug)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            title={t('pharmacy.addLot', 'Add Lot')}
                          >
                            <Package className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(drug)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Lot summary */}
                      {drugLots.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                          {drugLots.map(lot => {
                            const status = getExpiryStatus(lot.expiry_date);
                            return (
                              <span key={lot.id} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                                status === 'expired' ? 'bg-red-500/15 text-red-400' :
                                  status === 'critical' ? 'bg-red-500/10 text-red-400' :
                                    status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                                      'bg-white/5 text-white/50'
                              }`}>
                                {lot.lot_number} · {lot.quantity_remaining} · {t('pharmacy.exp', 'Exp: {{date}}', { date: lot.expiry_date })}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Drug Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editDrug ? t('pharmacy.editDrug', 'Edit Drug') : t('pharmacy.addDrug', 'Add Drug')}
                </h2>
                <button onClick={() => setAddOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.tradeName', 'Trade Name')} *</label>
                  <input
                    type="text"
                    value={form.trade_name}
                    onChange={e => setForm(f => ({ ...f, trade_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Panadol"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.genericName', 'Generic Name')} *</label>
                  <input
                    type="text"
                    value={form.generic_name}
                    onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Paracetamol"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.strength', 'Strength')}</label>
                    <input
                      type="text"
                      value={form.strength}
                      onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.form', 'Form')}</label>
                    <select
                      value={form.form}
                      onChange={e => setForm(f => ({ ...f, form: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">{t('pharmacy.selectForm', 'Select form')}</option>
                      {DRUG_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.classification', 'Classification')}</label>
                  <select
                    value={form.classification}
                    onChange={e => setForm(f => ({ ...f, classification: e.target.value as DrugClassification }))}
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="otc">{t('pharmacy.otc', 'OTC — Over The Counter')}</option>
                    <option value="prescription_required">{t('pharmacy.rxRequired', 'Prescription Required')}</option>
                    <option value="controlled">{t('pharmacy.controlled', 'Controlled Substance (Narcotics)')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.atcCode', 'ATC Code')}</label>
                    <input
                      type="text"
                      value={form.atc_code}
                      onChange={e => setForm(f => ({ ...f, atc_code: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. N02BE01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.manufacturer', 'Manufacturer')}</label>
                    <input
                      type="text"
                      value={form.manufacturer}
                      onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. GSK"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.vatRate', 'VAT Rate %')}</label>
                    <select
                      value={form.vat_rate}
                      onChange={e => setForm(f => ({ ...f, vat_rate: parseFloat(e.target.value) }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                    >
                      <option value={0}>{t('pharmacy.vatExemptOption', '0% — Medication (Exempt)')}</option>
                      <option value={11}>{t('pharmacy.vatParapharmacy', '11% — Parapharmacy/Cosmetics')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.barcode', 'Barcode')}</label>
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Scan or enter"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setAddOpen(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => void saveDrug()}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lot Modal */}
      {addLotOpen && lotTargetDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-white">{t('pharmacy.addLot', 'Add Lot')}</h2>
                <button onClick={() => setAddLotOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/50 text-sm mb-6">{lotTargetDrug.trade_name} — {lotTargetDrug.generic_name}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.lotNumber', 'Lot Number')} *</label>
                  <input
                    type="text"
                    value={lotForm.lot_number}
                    onChange={e => setLotForm(f => ({ ...f, lot_number: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. LOT2026A"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.expiryDate', 'Expiry Date')} *</label>
                  <input
                    type="date"
                    value={lotForm.expiry_date}
                    onChange={e => setLotForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.qtyReceived', 'Quantity Received')}</label>
                    <input
                      type="number"
                      min={0}
                      value={lotForm.quantity_received}
                      onChange={e => setLotForm(f => ({ ...f, quantity_received: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.unitCostUSD', 'Unit Cost (USD)')}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={lotForm.unit_cost}
                      onChange={e => setLotForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setAddLotOpen(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => void saveLot()}
                  disabled={savingLot}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingLot ? t('common.saving', 'Saving…') : t('pharmacy.saveLot', 'Save Lot')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
