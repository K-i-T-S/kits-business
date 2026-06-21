import {
  Plus, X, Shield, Printer, Search, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { Drug, NarcoticsLogEntry } from '@/types/pharmacy';
import { supabase } from '@/utils/supabaseClient';

interface LogFormData {
  drug_id: string;
  drug_name: string;
  lot_number: string;
  quantity: number;
  patient_name: string;
  patient_id_number: string;
  doctor_name: string;
  doctor_license: string;
  pharmacist_name: string;
  prescription_id: string;
  notes: string;
}

const EMPTY_FORM: LogFormData = {
  drug_id: '',
  drug_name: '',
  lot_number: '',
  quantity: 1,
  patient_name: '',
  patient_id_number: '',
  doctor_name: '',
  doctor_license: '',
  pharmacist_name: '',
  prescription_id: '',
  notes: '',
};

type DateFilter = 'today' | 'week' | 'month' | 'all';

export default function NarcoticsRegister() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [entries, setEntries] = useState<NarcoticsLogEntry[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<LogFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [logRes, drugsRes] = await Promise.all([
        supabase
          .from('narcotics_log')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('dispensed_at', { ascending: false }),
        supabase
          .from('drugs')
          .select('id, trade_name, generic_name, classification')
          .eq('tenant_id', tenantId)
          .eq('classification', 'controlled'),
      ]);
      if (logRes.error) throw logRes.error;
      if (drugsRes.error) throw drugsRes.error;
      setEntries((logRes.data as NarcoticsLogEntry[]) ?? []);
      setDrugs((drugsRes.data as Drug[]) ?? []);
    } catch (err) {
      toast.error(t('pharmacy.loadError', 'Failed to load narcotics register'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadData(); }, [loadData]);

  const saveEntry = async () => {
    if (!tenantId) return;
    const required = ['drug_name', 'lot_number', 'patient_name', 'patient_id_number', 'doctor_name', 'doctor_license', 'pharmacist_name'] as const;
    for (const field of required) {
      if (!form[field]) {
        toast.error(t('pharmacy.narcoticsAllRequired', 'All fields are required for narcotics register compliance'));
        return;
      }
    }
    if (form.quantity <= 0) {
      toast.error(t('pharmacy.quantityRequired', 'Quantity must be greater than 0'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('narcotics_log').insert({
        tenant_id: tenantId,
        drug_id: form.drug_id || null,
        drug_name: form.drug_name,
        lot_number: form.lot_number,
        quantity: form.quantity,
        patient_name: form.patient_name,
        patient_id_number: form.patient_id_number,
        doctor_name: form.doctor_name,
        doctor_license: form.doctor_license,
        pharmacist_name: form.pharmacist_name,
        prescription_id: form.prescription_id || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success(t('pharmacy.narcoticsLogSaved', 'Entry added to narcotics register'));
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.narcoticsLogError', 'Failed to save entry'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const filteredByDate = entries.filter(e => {
    const d = new Date(e.dispensed_at);
    if (dateFilter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return d >= weekAgo;
    }
    if (dateFilter === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true;
  });

  const filtered = filteredByDate.filter(e => {
    const q = search.toLowerCase();
    return !q
      || e.drug_name.toLowerCase().includes(q)
      || e.patient_name.toLowerCase().includes(q)
      || e.doctor_name.toLowerCase().includes(q)
      || e.pharmacist_name.toLowerCase().includes(q);
  });

  const handlePrint = () => {
    const printDate = dateFilter === 'today' ? now.toLocaleDateString('en-GB')
      : dateFilter === 'week' ? 'Last 7 days'
        : dateFilter === 'month' ? `${now.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`
          : 'All records';

    const rows = filtered.map(e => `
      <tr>
        <td>${new Date(e.dispensed_at).toLocaleString('en-GB')}</td>
        <td>${e.drug_name}</td>
        <td>${e.lot_number}</td>
        <td>${e.quantity}</td>
        <td>${e.patient_name}</td>
        <td>${e.patient_id_number}</td>
        <td>${e.doctor_name} (${e.doctor_license})</td>
        <td>${e.pharmacist_name}</td>
      </tr>
    `).join('');

    const html = `
      <html><head><title>Narcotics Register — ${printDate}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; }
        h1 { font-size: 14px; margin-bottom: 4px; }
        p { color: #666; margin-bottom: 16px; font-size: 9px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
      </style></head>
      <body>
        <h1>Narcotics Register — ${currentTenant?.name ?? 'Pharmacy'}</h1>
        <p>Period: ${printDate} · Printed: ${now.toLocaleString('en-GB')} · Law 673/1998 Compliance · ${currentTenant?.name ?? 'Pharmacy'}</p>
        <table>
          <thead>
            <tr>
              <th>Date/Time</th><th>Drug</th><th>Lot</th><th>Qty</th>
              <th>Patient</th><th>ID</th><th>Doctor (License)</th><th>Pharmacist</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{t('pharmacy.narcoticsRegister', 'Narcotics Register')}</h1>
              <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {t('pharmacy.law673', 'Law 673/1998')}
              </span>
            </div>
            <p className="text-white/50 text-sm mt-1">
              {t('pharmacy.narcoticsDesc', 'Controlled substance dispensing log — ISF inspection ready')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl px-4 py-2 text-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              {t('pharmacy.printLog', 'Print Log')}
            </button>
            <button
              onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              {t('pharmacy.addEntry', 'Add Entry')}
            </button>
          </div>
        </div>

        {/* Compliance notice */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">{t('pharmacy.legalNotice', 'Legal Compliance Notice')}</p>
            <p className="text-amber-400/70 text-xs mt-1">
              {t('pharmacy.legalNoticeBody', 'All controlled substance dispensings must be recorded per Lebanese Law 673/1998. This log is subject to ISF inspection. Patient national ID is mandatory.')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('pharmacy.searchNarcotics', 'Search by drug, patient, doctor, pharmacist…')}
              className="w-full bg-slate-800 border border-white/10 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-1">
            {(['today', 'week', 'month', 'all'] as DateFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  dateFilter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {f === 'today' ? t('pharmacy.today', 'Today')
                  : f === 'week' ? t('pharmacy.week', '7 Days')
                    : f === 'month' ? t('pharmacy.month', 'Month')
                      : t('pharmacy.allTime', 'All')}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Shield className="w-5 h-5 text-red-400 mb-2" />
            <div className="text-xl font-bold text-white">{filtered.length}</div>
            <div className="text-white/50 text-xs mt-0.5">{t('pharmacy.totalDispensings', 'Total Dispensings')}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xl font-bold text-white">{filtered.reduce((s, e) => s + e.quantity, 0)}</div>
            <div className="text-white/50 text-xs mt-0.5">{t('pharmacy.totalUnits', 'Total Units')}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xl font-bold text-white">{new Set(filtered.map(e => e.drug_name)).size}</div>
            <div className="text-white/50 text-xs mt-0.5">{t('pharmacy.uniqueDrugs', 'Unique Drugs')}</div>
          </div>
        </div>

        {/* Entries */}
        {loading ? (
          <div className="text-white/40 text-center py-12">{t('common.loading', 'Loading…')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/40 text-center py-12">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {search ? t('pharmacy.noNarcResults', 'No entries match') : t('pharmacy.noEntries', 'No entries for this period')}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => {
              const isExpanded = expandedId === entry.id;
              const dispensedDate = new Date(entry.dispensed_at);
              return (
                <div key={entry.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/15 border border-red-500/30 rounded-lg flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{entry.drug_name}</div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {entry.patient_name} · {entry.lot_number} · qty {entry.quantity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-white/60 text-xs">{dispensedDate.toLocaleDateString('en-GB')}</div>
                        <div className="text-white/40 text-xs">{dispensedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-white/40">{t('pharmacy.patient', 'Patient')}: </span>
                          <span className="text-white">{entry.patient_name}</span>
                        </div>
                        <div>
                          <span className="text-white/40">{t('pharmacy.patientId', 'ID')}: </span>
                          <span className="text-white">{entry.patient_id_number}</span>
                        </div>
                        <div>
                          <span className="text-white/40">{t('pharmacy.doctor', 'Doctor')}: </span>
                          <span className="text-white">{entry.doctor_name}</span>
                        </div>
                        <div>
                          <span className="text-white/40">{t('pharmacy.license', 'License')}: </span>
                          <span className="text-white">{entry.doctor_license}</span>
                        </div>
                        <div>
                          <span className="text-white/40">{t('pharmacy.pharmacist', 'Pharmacist')}: </span>
                          <span className="text-white">{entry.pharmacist_name}</span>
                        </div>
                        <div>
                          <span className="text-white/40">{t('pharmacy.lotNumber', 'Lot')}: </span>
                          <span className="text-white">{entry.lot_number}</span>
                        </div>
                        {entry.notes && (
                          <div className="col-span-2">
                            <span className="text-white/40">{t('pharmacy.notes', 'Notes')}: </span>
                            <span className="text-white">{entry.notes}</span>
                          </div>
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

      {/* Add Entry Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">{t('pharmacy.addNarcoticsEntry', 'Add Narcotics Entry')}</h2>
                <button onClick={() => setAddOpen(false)} className="text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/40 text-xs mb-6">
                {t('pharmacy.narcoticsFormNote', 'All fields are mandatory for Law 673/1998 compliance')}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.controlledDrug', 'Controlled Drug')} *</label>
                  <input
                    type="text"
                    value={form.drug_name}
                    onChange={e => {
                      const val = e.target.value;
                      const match = drugs.find(d => d.trade_name.toLowerCase() === val.toLowerCase());
                      setForm(f => ({ ...f, drug_name: val, drug_id: match?.id ?? '' }));
                    }}
                    list="controlled-drugs"
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder={t('pharmacy.drugName', 'Drug name')}
                  />
                  <datalist id="controlled-drugs">
                    {drugs.map(d => <option key={d.id} value={d.trade_name}>{d.generic_name}</option>)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.lotNumber', 'Lot Number')} *</label>
                    <input
                      type="text"
                      value={form.lot_number}
                      onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.quantity', 'Quantity')} *</label>
                    <input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.patientName', 'Patient Name')} *</label>
                    <input
                      type="text"
                      value={form.patient_name}
                      onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.nationalId', 'National ID')} *</label>
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
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.doctorLicense', 'Doctor License #')} *</label>
                    <input
                      type="text"
                      value={form.doctor_license}
                      onChange={e => setForm(f => ({ ...f, doctor_license: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.pharmacistName', 'Dispensing Pharmacist')} *</label>
                  <input
                    type="text"
                    value={form.pharmacist_name}
                    onChange={e => setForm(f => ({ ...f, pharmacist_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.notes', 'Notes')}</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setAddOpen(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-colors">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => void saveEntry()}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? t('common.saving', 'Saving…') : t('pharmacy.recordDispensing', 'Record Dispensing')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
