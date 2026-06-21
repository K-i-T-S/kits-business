import {
  Plus, X, Search, FileText, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { Drug, Prescription, PrescriptionItem, PrescriptionStatus } from '@/types/pharmacy';
import { PRESCRIPTION_STATUS_COLORS, PRESCRIPTION_STATUS_LABELS } from '@/types/pharmacy';
import { supabase } from '@/utils/supabaseClient';

interface PrescriptionFormData {
  patient_name: string;
  patient_phone: string;
  patient_id_number: string;
  doctor_name: string;
  doctor_license: string;
  issue_date: string;
  notes: string;
}

const EMPTY_FORM: PrescriptionFormData = {
  patient_name: '',
  patient_phone: '',
  patient_id_number: '',
  doctor_name: '',
  doctor_license: '',
  issue_date: new Date().toISOString().split('T')[0]!,
  notes: '',
};

interface PrescriptionItemFormData {
  drug_name: string;
  drug_id: string;
  quantity_prescribed: number;
}

const EMPTY_ITEM: PrescriptionItemFormData = {
  drug_name: '',
  drug_id: '',
  quantity_prescribed: 1,
};

interface PrescriptionWithItems extends Prescription {
  items: PrescriptionItem[];
}

type FilterStatus = PrescriptionStatus | 'all';

export default function Prescriptions() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [prescriptions, setPrescriptions] = useState<PrescriptionWithItems[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<PrescriptionFormData>(EMPTY_FORM);
  const [items, setItems] = useState<PrescriptionItemFormData[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  const [dispenseOpen, setDispenseOpen] = useState(false);
  const [dispensePrescription, setDispensePrescription] = useState<PrescriptionWithItems | null>(null);
  const [pharmacistName, setPharmacistName] = useState('');
  const [dispenseQtys, setDispenseQtys] = useState<Record<string, number>>({});
  const [dispensing, setDispensing] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [pxRes, drugsRes, itemsRes] = await Promise.all([
        supabase.from('prescriptions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('drugs').select('id, trade_name, generic_name, classification').eq('tenant_id', tenantId),
        supabase.from('prescription_items').select('*'),
      ]);
      if (pxRes.error) throw pxRes.error;
      if (drugsRes.error) throw drugsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const pxList = (pxRes.data as Prescription[]) ?? [];
      const itemsList = (itemsRes.data as PrescriptionItem[]) ?? [];

      const withItems: PrescriptionWithItems[] = pxList.map(px => ({
        ...px,
        items: itemsList.filter(i => i.prescription_id === px.id),
      }));

      setPrescriptions(withItems);
      setDrugs((drugsRes.data as Drug[]) ?? []);
    } catch (err) {
      toast.error(t('pharmacy.loadError', 'Failed to load prescriptions'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadData(); }, [loadData]);

  const savePrescription = async () => {
    if (!tenantId || !form.patient_name || !form.doctor_name) {
      toast.error(t('pharmacy.pxRequired', 'Patient and doctor names are required'));
      return;
    }
    if (items.every(i => !i.drug_name)) {
      toast.error(t('pharmacy.pxItemRequired', 'Add at least one medication'));
      return;
    }
    setSaving(true);
    try {
      const pxInsert = await supabase.from('prescriptions').insert({
        tenant_id: tenantId,
        patient_name: form.patient_name,
        patient_phone: form.patient_phone || null,
        patient_id_number: form.patient_id_number || null,
        doctor_name: form.doctor_name,
        doctor_license: form.doctor_license || null,
        issue_date: form.issue_date,
        notes: form.notes || null,
        status: 'pending',
      }).select().single();
      if (pxInsert.error) throw pxInsert.error;
      const pxId = (pxInsert.data as { id: string }).id;

      const validItems = items.filter(i => i.drug_name);
      if (validItems.length > 0) {
        const { error: itemErr } = await supabase.from('prescription_items').insert(
          validItems.map(i => ({
            prescription_id: pxId,
            drug_id: i.drug_id || null,
            drug_name: i.drug_name,
            quantity_prescribed: i.quantity_prescribed,
            quantity_dispensed: 0,
          })),
        );
        if (itemErr) throw itemErr;
      }

      toast.success(t('pharmacy.pxCreated', 'Prescription created'));
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setItems([{ ...EMPTY_ITEM }]);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.savePxError', 'Failed to save prescription'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openDispense = (px: PrescriptionWithItems) => {
    setDispensePrescription(px);
    const qtys: Record<string, number> = {};
    px.items.forEach(item => {
      qtys[item.id] = item.quantity_prescribed - item.quantity_dispensed;
    });
    setDispenseQtys(qtys);
    setPharmacistName('');
    setDispenseOpen(true);
  };

  const confirmDispense = async () => {
    if (!dispensePrescription || !pharmacistName.trim()) {
      toast.error(t('pharmacy.pharmacistRequired', 'Pharmacist name is required'));
      return;
    }
    setDispensing(true);
    try {
      const now = new Date().toISOString();
      for (const item of dispensePrescription.items) {
        const qty = dispenseQtys[item.id] ?? 0;
        if (qty <= 0) continue;
        const newQty = item.quantity_dispensed + qty;
        await supabase.from('prescription_items').update({
          quantity_dispensed: newQty,
          dispensed_at: now,
          dispensing_pharmacist: pharmacistName,
        }).eq('id', item.id);
      }

      // Update prescription status
      const allFilled = dispensePrescription.items.every(item => {
        const dispensed = item.quantity_dispensed + (dispenseQtys[item.id] ?? 0);
        return dispensed >= item.quantity_prescribed;
      });
      const anyFilled = dispensePrescription.items.some(item => (dispenseQtys[item.id] ?? 0) > 0);

      if (anyFilled) {
        await supabase.from('prescriptions').update({
          status: allFilled ? 'filled' : 'partially_filled',
        }).eq('id', dispensePrescription.id);
      }

      toast.success(t('pharmacy.dispensed', 'Prescription dispensed'));
      setDispenseOpen(false);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.dispenseError', 'Failed to record dispensing'));
      console.error(err);
    } finally {
      setDispensing(false);
    }
  };

  const addItem = () => setItems(i => [...i, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(i => i.filter((_, n) => n !== idx));
  const updateItem = (idx: number, update: Partial<PrescriptionItemFormData>) => {
    setItems(i => i.map((item, n) => n === idx ? { ...item, ...update } : item));
  };

  const filtered = prescriptions.filter(px => {
    const q = search.toLowerCase();
    const matchesSearch = !q || px.patient_name.toLowerCase().includes(q) || px.doctor_name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || px.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: PrescriptionStatus) => {
    switch (status) {
      case 'filled': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'partially_filled': return <Clock className="w-4 h-4 text-sky-400" />;
      case 'pending': return <FileText className="w-4 h-4 text-amber-400" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('pharmacy.prescriptions', 'Prescriptions')}</h1>
            <p className="text-white/50 text-sm mt-1">
              {t('pharmacy.prescriptionsDesc', 'Track and fill patient prescriptions')}
            </p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }]); setAddOpen(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {t('pharmacy.newPrescription', 'New Prescription')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { status: 'all', label: t('pharmacy.allPx', 'All'), value: prescriptions.length },
            { status: 'pending', label: t('pharmacy.pending', 'Pending'), value: prescriptions.filter(p => p.status === 'pending').length },
            { status: 'partially_filled', label: t('pharmacy.partialFill', 'Partial'), value: prescriptions.filter(p => p.status === 'partially_filled').length },
            { status: 'filled', label: t('pharmacy.filled', 'Filled'), value: prescriptions.filter(p => p.status === 'filled').length },
          ] as const).map(stat => (
            <button
              key={stat.status}
              onClick={() => setStatusFilter(stat.status as FilterStatus)}
              className={`bg-white/5 border rounded-xl p-4 text-left transition-colors ${
                statusFilter === stat.status ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-white/50 text-xs mt-0.5">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('pharmacy.searchPx', 'Search by patient or doctor name…')}
            className="w-full bg-slate-800 border border-white/10 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-white/40 text-center py-12">{t('common.loading', 'Loading…')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/40 text-center py-12">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {search ? t('pharmacy.noPxResults', 'No prescriptions match') : t('pharmacy.noPrescriptions', 'No prescriptions yet')}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(px => {
              const isExpanded = expandedId === px.id;
              const colors = PRESCRIPTION_STATUS_COLORS[px.status];
              return (
                <div key={px.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : px.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(px.status)}
                      <div>
                        <div className="text-white font-medium text-sm">{px.patient_name}</div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {t('pharmacy.drLabel', 'Dr. {{name}}', { name: px.doctor_name })} · {px.issue_date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {PRESCRIPTION_STATUS_LABELS[px.status]}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/10">
                      {px.items.length === 0 ? (
                        <p className="text-white/40 text-sm py-2">{t('pharmacy.noItems', 'No items recorded')}</p>
                      ) : (
                        <div className="space-y-2 mt-3">
                          {px.items.map(item => {
                            const filled = item.quantity_dispensed >= item.quantity_prescribed;
                            return (
                              <div key={item.id} className="flex items-center justify-between text-sm">
                                <span className="text-white/80">{item.drug_name}</span>
                                <span className={filled ? 'text-emerald-400' : 'text-amber-400'}>
                                  {item.quantity_dispensed} / {item.quantity_prescribed}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {px.notes && (
                        <p className="text-white/40 text-xs mt-3 italic">{px.notes}</p>
                      )}

                      <div className="mt-4 flex gap-2">
                        {px.status !== 'filled' && px.status !== 'cancelled' && (
                          <button
                            onClick={() => openDispense(px)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-sm font-medium transition-colors"
                          >
                            {t('pharmacy.dispense', 'Dispense')}
                          </button>
                        )}
                        {px.status !== 'cancelled' && px.status !== 'filled' && (
                          <button
                            onClick={() => {
                              void supabase.from('prescriptions').update({ status: 'cancelled' }).eq('id', px.id).then(() => loadData());
                            }}
                            className="px-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl py-2 text-sm transition-colors"
                          >
                            {t('pharmacy.cancel', 'Cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Prescription Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">{t('pharmacy.newPrescription', 'New Prescription')}</h2>
                <button onClick={() => setAddOpen(false)} className="text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.patientName', 'Patient Name')} *</label>
                  <input
                    type="text"
                    value={form.patient_name}
                    onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.patientPhone', 'Phone')}</label>
                    <input
                      type="tel"
                      value={form.patient_phone}
                      onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))}
                      placeholder="+961 X XXX XXX"
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.patientId', 'National ID')}</label>
                    <input
                      type="text"
                      value={form.patient_id_number}
                      onChange={e => setForm(f => ({ ...f, patient_id_number: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.doctorName', 'Doctor Name')} *</label>
                    <input
                      type="text"
                      value={form.doctor_name}
                      onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.doctorLicense', 'License #')}</label>
                    <input
                      type="text"
                      value={form.doctor_license}
                      onChange={e => setForm(f => ({ ...f, doctor_license: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.issueDate', 'Issue Date')}</label>
                  <input
                    type="date"
                    value={form.issue_date}
                    onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Medication items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-white/60">{t('pharmacy.medications', 'Medications')}</label>
                    <button onClick={addItem} className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1">
                      <Plus className="w-3 h-3" /> {t('pharmacy.addMed', 'Add')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={item.drug_name}
                            onChange={e => {
                              const val = e.target.value;
                              const match = drugs.find(d => d.trade_name.toLowerCase() === val.toLowerCase());
                              updateItem(idx, { drug_name: val, drug_id: match?.id ?? '' });
                            }}
                            list={`drugs-${idx}`}
                            placeholder={t('pharmacy.drugName', 'Drug name…')}
                            className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                          />
                          <datalist id={`drugs-${idx}`}>
                            {drugs.map(d => (
                              <option key={d.id} value={d.trade_name}>{d.generic_name}</option>
                            ))}
                          </datalist>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity_prescribed}
                          onChange={e => updateItem(idx, { quantity_prescribed: parseInt(e.target.value) || 1 })}
                          className="w-16 bg-slate-800 border border-white/10 text-white rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-indigo-500 text-center"
                        />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-white/30 hover:text-red-400 p-2 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.notes', 'Notes')}</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setAddOpen(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-colors">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => void savePrescription()}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? t('common.saving', 'Saving…') : t('pharmacy.createPx', 'Create Prescription')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {dispenseOpen && dispensePrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-white">{t('pharmacy.dispense', 'Dispense')}</h2>
                <button onClick={() => setDispenseOpen(false)} className="text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/50 text-sm mb-6">{dispensePrescription.patient_name}</p>

              <div className="space-y-3 mb-4">
                {dispensePrescription.items.map(item => {
                  const remaining = item.quantity_prescribed - item.quantity_dispensed;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <span className="text-white text-sm flex-1">{item.drug_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs">{t('pharmacy.remaining', 'rem: {{n}}', { n: remaining })}</span>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={dispenseQtys[item.id] ?? 0}
                          onChange={e => setDispenseQtys(q => ({ ...q, [item.id]: Math.min(remaining, parseInt(e.target.value) || 0) }))}
                          className="w-16 bg-slate-800 border border-white/10 text-white rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-indigo-500"
                          disabled={remaining <= 0}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">{t('pharmacy.pharmacistName', 'Dispensing Pharmacist')} *</label>
                <input
                  type="text"
                  value={pharmacistName}
                  onChange={e => setPharmacistName(e.target.value)}
                  placeholder={t('pharmacy.pharmacistPlaceholder', 'Full name of pharmacist on duty')}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setDispenseOpen(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-colors">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => void confirmDispense()}
                  disabled={dispensing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {dispensing ? t('common.saving', 'Saving…') : t('pharmacy.confirmDispense', 'Confirm Dispense')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
