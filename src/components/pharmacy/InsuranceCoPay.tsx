import { Shield, Plus, X, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import type { InsuranceClaim, InsuranceProvider, ClaimStatus } from '@/types/pharmacy';
import { CLAIM_STATUS_COLORS, INSURANCE_PROVIDERS } from '@/types/pharmacy';
import { supabase } from '@/utils/supabaseClient';

interface ClaimFormData {
  patient_name: string;
  policy_number: string;
  provider: InsuranceProvider;
  total_amount: number;
  copay_percentage: number;
  currency: 'USD' | 'LBP';
  notes: string;
}

const EMPTY_FORM: ClaimFormData = {
  patient_name: '',
  policy_number: '',
  provider: 'cnss',
  total_amount: 0,
  copay_percentage: 20,
  currency: 'USD',
  notes: '',
};

type FilterStatus = ClaimStatus | 'all';

export default function InsuranceCoPay() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ClaimFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const computedCopay = Math.round(form.total_amount * (form.copay_percentage / 100) * 100) / 100;
  const computedInsurance = Math.round((form.total_amount - computedCopay) * 100) / 100;

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pharmacy_insurance_claims')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClaims((data as InsuranceClaim[]) ?? []);
    } catch (err) {
      toast.error(t('pharmacy.loadError', 'Failed to load insurance claims'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleProviderChange = (provider: InsuranceProvider) => {
    const cfg = INSURANCE_PROVIDERS.find(p => p.key === provider);
    setForm(f => ({ ...f, provider, copay_percentage: cfg?.defaultCopay ?? 20 }));
  };

  const saveClaim = async () => {
    if (!tenantId || !form.patient_name || form.total_amount <= 0) {
      toast.error(t('pharmacy.claimRequired', 'Patient name and amount are required'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('pharmacy_insurance_claims').insert({
        tenant_id: tenantId,
        patient_name: form.patient_name,
        policy_number: form.policy_number || null,
        provider: form.provider,
        total_amount: form.total_amount,
        copay_percentage: form.copay_percentage,
        copay_amount: computedCopay,
        insurance_amount: computedInsurance,
        currency: form.currency,
        notes: form.notes || null,
        status: 'pending',
      });
      if (error) throw error;
      toast.success(t('pharmacy.claimCreated', 'Insurance claim created'));
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.claimError', 'Failed to save claim'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: ClaimStatus) => {
    try {
      const { error } = await supabase.from('pharmacy_insurance_claims').update({ status }).eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      toast.error(t('pharmacy.statusError', 'Failed to update status'));
      console.error(err);
    }
  };

  const filtered = claims.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.patient_name.toLowerCase().includes(q) || c.provider.includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: ClaimStatus) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'submitted': return <Shield className="w-4 h-4 text-sky-400" />;
      case 'rejected': return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const totalPending = claims.filter(c => c.status === 'pending' || c.status === 'submitted')
    .reduce((s, c) => s + c.insurance_amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{t('pharmacy.insuranceClaims', 'Insurance Claims')}</h2>
          <p className="text-white/40 text-sm">{t('pharmacy.insuranceDesc', 'Copay calculation and manual claim tracking')}</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('pharmacy.newClaim', 'New Claim')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: t('pharmacy.totalClaims', 'Total'), value: claims.length, color: 'text-white' },
          { label: t('pharmacy.pendingClaims', 'Pending'), value: claims.filter(c => c.status === 'pending').length, color: 'text-amber-400' },
          { label: t('pharmacy.approvedClaims', 'Approved'), value: claims.filter(c => c.status === 'approved').length, color: 'text-emerald-400' },
          { label: t('pharmacy.pendingValue', 'Pending Value'), value: `$${totalPending.toFixed(2)}`, color: 'text-sky-400' },
        ]).map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-white/40 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('pharmacy.searchClaims', 'Search by patient or provider…')}
            className="w-full bg-slate-800 border border-white/10 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as FilterStatus)}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        >
          <option value="all">{t('pharmacy.allStatuses', 'All Statuses')}</option>
          <option value="pending">{t('pharmacy.pending', 'Pending')}</option>
          <option value="submitted">{t('pharmacy.submitted', 'Submitted')}</option>
          <option value="approved">{t('pharmacy.approved', 'Approved')}</option>
          <option value="rejected">{t('pharmacy.rejected', 'Rejected')}</option>
        </select>
      </div>

      {/* Claims list */}
      {loading ? (
        <div className="text-white/40 text-sm text-center py-8">{t('common.loading', 'Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/40 text-center py-8">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {search ? t('pharmacy.noClaimResults', 'No claims match') : t('pharmacy.noClaims', 'No insurance claims yet')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(claim => {
            const colors = CLAIM_STATUS_COLORS[claim.status];
            const provider = INSURANCE_PROVIDERS.find(p => p.key === claim.provider);
            return (
              <div key={claim.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(claim.status)}
                    <div>
                      <div className="text-white font-medium text-sm">{claim.patient_name}</div>
                      <div className="text-white/50 text-xs mt-0.5">
                        {provider?.label ?? claim.provider}
                        {claim.policy_number && ` · #${claim.policy_number}`}
                        {' · '}{claim.claim_date}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-medium text-sm">
                      {claim.currency === 'USD' ? '$' : 'LBP '}{claim.total_amount.toFixed(2)}
                    </div>
                    <div className="text-white/40 text-xs">
                      {t('pharmacy.copayAmount', 'Co-pay: {{amount}}', {
                        amount: `${claim.currency === 'USD' ? '$' : 'LBP '}${claim.copay_amount.toFixed(2)}`,
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {claim.status}
                  </span>
                  {claim.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => void updateStatus(claim.id, 'submitted')}
                        className="text-xs px-3 py-1 bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/25 transition-colors"
                      >
                        {t('pharmacy.markSubmitted', 'Submitted')}
                      </button>
                      <button
                        onClick={() => void updateStatus(claim.id, 'rejected')}
                        className="text-xs px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        {t('pharmacy.reject', 'Reject')}
                      </button>
                    </div>
                  )}
                  {claim.status === 'submitted' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => void updateStatus(claim.id, 'approved')}
                        className="text-xs px-3 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors"
                      >
                        {t('pharmacy.markApproved', 'Approved')}
                      </button>
                      <button
                        onClick={() => void updateStatus(claim.id, 'rejected')}
                        className="text-xs px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        {t('pharmacy.reject', 'Reject')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Claim Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">{t('pharmacy.newClaim', 'New Insurance Claim')}</h2>
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

                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.insuranceProvider', 'Insurance Provider')}</label>
                  <select
                    value={form.provider}
                    onChange={e => handleProviderChange(e.target.value as InsuranceProvider)}
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  >
                    {INSURANCE_PROVIDERS.map(p => (
                      <option key={p.key} value={p.key}>{p.label} — {p.defaultCopay}% copay</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.policyNumber', 'Policy Number')}</label>
                  <input
                    type="text"
                    value={form.policy_number}
                    onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.totalAmount', 'Total Amount')} *</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.total_amount}
                      onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">{t('pharmacy.currency', 'Currency')}</label>
                    <select
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value as 'USD' | 'LBP' }))}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="LBP">LBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">{t('pharmacy.copayPercent', 'Co-pay %')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.copay_percentage}
                    onChange={e => setForm(f => ({ ...f, copay_percentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Computed breakdown */}
                {form.total_amount > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t('pharmacy.patientPays', 'Patient pays (co-pay)')}</span>
                      <span className="text-amber-400 font-medium">{form.currency === 'USD' ? '$' : 'LBP '}{computedCopay.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t('pharmacy.insurancePays', 'Insurance pays')}</span>
                      <span className="text-emerald-400 font-medium">{form.currency === 'USD' ? '$' : 'LBP '}{computedInsurance.toFixed(2)}</span>
                    </div>
                  </div>
                )}

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
                  onClick={() => void saveClaim()}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? t('common.saving', 'Saving…') : t('pharmacy.createClaim', 'Create Claim')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
