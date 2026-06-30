import { Calendar, UserPlus, Clock, CheckCircle, LogIn, LogOut, X, Plus, Trash2, DollarSign, Link, FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { RestaurantShift, ShiftAssignment, ShiftType, StaffRole } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

const SHIFT_COLORS: Record<ShiftType, string> = {
  morning: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  evening: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  night: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  split: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  full: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const ROLES: StaffRole[] = ['waiter', 'chef', 'sous_chef', 'cashier', 'busboy', 'argile', 'manager', 'host'];

function getDayOfWeek(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset);
  return d.toISOString().split('T')[0] ?? '';
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// ── Recurring fee types ───────────────────────────────────────────────────────

interface RecurringFee {
  id: string;
  name: string;
  amount_usd: number;
  applies_to: 'all' | string;
}

interface TipsConfig {
  algorithm: string;
  waiterSharePct: number;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ShiftManager() {
  const { t } = useTranslation();
  const { employees, currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const feesKey = `shift_fees_${tenantId}`;
  const tipsKey = `tips_config_${tenantId}`;

  const [shifts, setShifts] = useState<RestaurantShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newShift, setNewShift] = useState({ shift_type: 'morning' as ShiftType, start_time: '08:00', end_time: '16:00' });
  const [newAssignment, setNewAssignment] = useState({ employee_id: '', role: 'waiter' as StaffRole, section: '' });

  const [fees, setFees] = useState<RecurringFee[]>(() => {
    try {
      const s = localStorage.getItem(feesKey);
      return s ? (JSON.parse(s) as RecurringFee[]) : [];
    } catch { return []; }
  });
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [newFee, setNewFee] = useState({ name: '', amount_usd: 0, applies_to: 'all' });

  const [tipsConfig, setTipsConfig] = useState<TipsConfig | null>(() => {
    try {
      const s = localStorage.getItem(tipsKey);
      return s ? (JSON.parse(s) as TipsConfig) : null;
    } catch { return null; }
  });

  // ── Payroll Export ─────────────────────────────────────────────────────────
  const [showPayrollExport, setShowPayrollExport] = useState(false);
  const [payPeriodStart, setPayPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [payPeriodEnd, setPayPeriodEnd] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0] ?? '';
  });

  interface PayrollPreviewRow {
    employee_id: string;
    name: string;
    hours: number;
    role: string;
  }

  const [exportPreview, setExportPreview] = useState<PayrollPreviewRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  interface ShiftAssignmentRow {
    employee_id: string;
    clocked_in_at: string | null;
    clocked_out_at: string | null;
    role: string;
  }

  const calculatePreview = async () => {
    if (!tenantId) return;
    setIsCalculating(true);
    setExportPreview([]);
    try {
      const { data: rawAssignments, error } = await supabase
        .from('restaurant_shift_assignments')
        .select('employee_id, clocked_in_at, clocked_out_at, role')
        .eq('tenant_id', tenantId)
        .gte('clocked_in_at', `${payPeriodStart}T00:00:00`)
        .lte('clocked_in_at', `${payPeriodEnd}T23:59:59`)
        .not('clocked_out_at', 'is', null);

      const periodAssignments = (rawAssignments ?? []) as ShiftAssignmentRow[];

      if (error) { toast.error('Failed to fetch shifts: ' + error.message); return; }
      if (!periodAssignments.length) { toast('No completed shifts in this period'); return; }

      const byEmployee: Record<string, { hours: number; role: string }> = {};
      for (const a of periodAssignments) {
        if (!a.clocked_out_at || !a.clocked_in_at) continue;
        const hours = (new Date(a.clocked_out_at).getTime() - new Date(a.clocked_in_at).getTime()) / 3_600_000;
        const empId: string = a.employee_id;
        // eslint-disable-next-line security/detect-object-injection -- empId is a UUID from DB, not user input
        const existing = byEmployee[empId];
        if (existing) {
          existing.hours += hours;
        } else {
          // eslint-disable-next-line security/detect-object-injection -- empId is a UUID from DB, not user input
          byEmployee[empId] = { hours, role: a.role };
        }
      }

      const preview: PayrollPreviewRow[] = Object.entries(byEmployee).map(([empId, data]) => {
        const emp = employees.find(e => e.id === empId);
        return {
          employee_id: empId,
          name: emp?.name ?? `Employee ${empId.slice(0, 8)}`,
          hours: Math.round(data.hours * 100) / 100,
          role: data.role,
        };
      });

      setExportPreview(preview);
    } finally {
      setIsCalculating(false);
    }
  };

  const exportToPayroll = async () => {
    if (!tenantId || !exportPreview.length) return;
    setIsExporting(true);
    try {
      const entries = exportPreview.map(row => ({
        tenant_id: tenantId,
        employee_id: row.employee_id,
        employee_name: row.name,
        period_start: payPeriodStart,
        period_end: payPeriodEnd,
        base_salary: 0,
        base_currency: 'USD',
        gross_salary: 0,
        net_salary: 0,
        total_employer_cost: 0,
        notes: `Exported from Shift Manager — ${row.hours.toFixed(2)}h worked as ${row.role}`,
      }));

      const { error } = await supabase.from('payroll_entries').insert(entries);
      if (error) { toast.error('Export failed: ' + error.message); return; }
      toast.success(`Exported ${entries.length} payroll ${entries.length === 1 ? 'entry' : 'entries'} to Finance`);
      setExportPreview([]);
    } finally {
      setIsExporting(false);
    }
  };

  const saveFees = (updated: RecurringFee[]) => {
    setFees(updated);
    localStorage.setItem(feesKey, JSON.stringify(updated));
  };

  const addFee = () => {
    if (!newFee.name || newFee.amount_usd <= 0) return;
    saveFees([...fees, { ...newFee, id: Date.now().toString() }]);
    setNewFee({ name: '', amount_usd: 0, applies_to: 'all' });
    setShowFeeForm(false);
  };

  const deleteFee = (id: string) => saveFees(fees.filter(f => f.id !== id));

  const weekDays = Array.from({ length: 7 }, (_, i) => getDayOfWeek(i));

  const loadShifts = useCallback(async () => {
    if (!tenantId) return;
    const startOfWeek = weekDays[0] ?? '';
    const endOfWeek = weekDays[6] ?? '';
    const { data } = await supabase
      .from('restaurant_shifts')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('shift_date', startOfWeek)
      .lte('shift_date', endOfWeek)
      .order('shift_date');
    setShifts((data ?? []) as RestaurantShift[]);
  }, [weekDays, tenantId]);

  const loadAssignments = useCallback(async () => {
    if (!selectedShiftId || !tenantId) return;
    const { data } = await supabase
      .from('restaurant_shift_assignments')
      .select('*')
      .eq('shift_id', selectedShiftId)
      .eq('tenant_id', tenantId);
    setAssignments((data ?? []) as ShiftAssignment[]);
  }, [selectedShiftId, tenantId]);

  useEffect(() => { void loadShifts(); }, [loadShifts]);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(tipsKey);
      setTipsConfig(s ? (JSON.parse(s) as TipsConfig) : null);
    } catch { /* ignore */ }
  }, [tipsKey]);

  const openShift = async () => {
    if (!tenantId) return;
    const today = new Date().toISOString().split('T')[0] ?? '';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase PostgREST untyped response
    const { data } = await supabase
      .from('restaurant_shifts')
      .insert({ tenant_id: tenantId, shift_date: today, ...newShift })
      .select()
      .single();
    if (data) {
      setShifts(prev => [...prev, data as RestaurantShift]);
      setSelectedShiftId((data as RestaurantShift).id);
    }
    setShowOpenModal(false);
  };

  const closeShift = async (shiftId: string) => {
    if (!tenantId) return;
    await supabase
      .from('restaurant_shifts')
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq('id', shiftId)
      .eq('tenant_id', tenantId);
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, is_closed: true } : s));
  };

  const assignStaff = async () => {
    if (!selectedShiftId || !newAssignment.employee_id || !tenantId) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase PostgREST untyped response
    const { data } = await supabase
      .from('restaurant_shift_assignments')
      .insert({ tenant_id: tenantId, shift_id: selectedShiftId, ...newAssignment })
      .select()
      .single();
    if (data) setAssignments(prev => [...prev, data as ShiftAssignment]);
    setShowAssignModal(false);
    setNewAssignment({ employee_id: '', role: 'waiter', section: '' });
  };

  const clockIn = async (assignmentId: string) => {
    if (!tenantId) return;
    await supabase
      .from('restaurant_shift_assignments')
      .update({ clocked_in_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId);
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, clocked_in_at: new Date().toISOString() } : a));
  };

  const clockOut = async (assignmentId: string) => {
    if (!tenantId) return;
    await supabase
      .from('restaurant_shift_assignments')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId);
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, clocked_out_at: new Date().toISOString() } : a));
  };

  const selectedShift = shifts.find(s => s.id === selectedShiftId);

  const getHours = (a: ShiftAssignment): string => {
    if (!a.clocked_in_at) return '—';
    const end = a.clocked_out_at ? new Date(a.clocked_out_at) : new Date();
    const mins = Math.floor((end.getTime() - new Date(a.clocked_in_at).getTime()) / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getTipsLabel = (): string => {
    if (!tipsConfig) return 'Configure tips in Tips Management';
    const algo = tipsConfig.algorithm.replace(/_/g, ' ');
    return `Algorithm: ${capFirst(algo)}`;
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 shadow-lg shadow-amber-500/10">
            <Calendar className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('restaurant.shifts.title', 'Shift Management')}</h1>
            <p className="text-xs text-white/35">Weekly schedule & staff clock-in</p>
          </div>
          <button
            onClick={() => setShowOpenModal(true)}
            className="ms-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
          >
            <Clock className="h-4 w-4" />
            {t('restaurant.shifts.openShift', 'Open Shift')}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Week Grid */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">
              {t('restaurant.shifts.thisWeek', 'This Week')}
            </h2>
            {weekDays.map(day => {
              const dayShifts = shifts.filter(s => s.shift_date === day);
              const isToday = day === (new Date().toISOString().split('T')[0] ?? '');
              return (
                <div
                  key={day}
                  className={`rounded-2xl border p-3 transition-all shadow-2xl ${
                    isToday
                      ? 'border-amber-500/30 bg-amber-500/8 shadow-amber-500/5'
                      : 'backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border-white/10'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-2 ${isToday ? 'text-amber-300' : 'text-white/50'}`}>
                    {new Date(day).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {isToday && <span className="ml-2 text-amber-400/80">• Today</span>}
                  </p>
                  {dayShifts.length === 0 ? (
                    <p className="text-xs text-white/20">{t('restaurant.shifts.noShift', 'No shift')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dayShifts.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedShiftId(s.id)}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-all ${SHIFT_COLORS[s.shift_type]} ${
                            selectedShiftId === s.id ? 'ring-2 ring-amber-400/50 shadow-amber-400/20' : ''
                          }`}
                        >
                          {capFirst(s.shift_type)} {s.start_time}–{s.end_time}
                          {s.is_closed && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Selected Shift Detail */}
            {!selectedShift ? (
              <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-8 text-center text-white/25 text-sm">
                {t('restaurant.shifts.selectShift', 'Select a shift to view staff')}
              </div>
            ) : (
              <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${SHIFT_COLORS[selectedShift.shift_type]}`}>
                      {capFirst(selectedShift.shift_type)}
                    </span>
                    <span className="text-sm text-white/55">{selectedShift.start_time} – {selectedShift.end_time}</span>
                  </div>
                  {!selectedShift.is_closed ? (
                    <button
                      onClick={() => void closeShift(selectedShift.id)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />
                      {t('restaurant.shifts.closeShift', 'Close Shift')}
                    </button>
                  ) : (
                    <span className="text-xs text-green-400">✓ {t('restaurant.shifts.closed', 'Closed')}</span>
                  )}
                </div>

                {/* Tips estimate */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300/80">{getTipsLabel()}</p>
                    {!tipsConfig && (
                      <a href="/restaurant/tips" className="ml-auto text-[10px] text-amber-400/70 underline flex items-center gap-1">
                        <Link className="h-3 w-3" />Configure
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/8 pt-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                    {t('restaurant.shifts.staff', 'Staff on Shift')}
                  </h3>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-300 transition-colors"
                  >
                    <UserPlus className="h-3 w-3" />
                    {t('restaurant.shifts.assign', 'Assign')}
                  </button>
                </div>

                <div className="space-y-2">
                  {assignments.length === 0 && (
                    <p className="text-xs text-white/25">{t('restaurant.shifts.noStaff', 'No staff assigned yet')}</p>
                  )}
                  {assignments.map(a => {
                    const emp = employees.find(e => e.id === a.employee_id);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{emp?.name ?? a.employee_id.slice(0, 8)}</p>
                          <p className="text-xs text-white/40">
                            {capFirst(a.role)}{a.section ? ` · ${a.section}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.clocked_in_at && (
                            <span className="text-xs text-white/40">{getHours(a)}</span>
                          )}
                          {!a.clocked_in_at ? (
                            <button
                              onClick={() => void clockIn(a.id)}
                              className="rounded-lg border border-green-500/30 bg-green-500/15 px-2 py-1 text-xs text-green-400 flex items-center gap-1 hover:bg-green-500/25 transition-colors"
                            >
                              <LogIn className="h-3 w-3" />
                              {t('restaurant.shifts.clockIn', 'In')}
                            </button>
                          ) : !a.clocked_out_at ? (
                            <button
                              onClick={() => void clockOut(a.id)}
                              className="rounded-lg border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs text-red-400 flex items-center gap-1 hover:bg-red-500/25 transition-colors"
                            >
                              <LogOut className="h-3 w-3" />
                              {t('restaurant.shifts.clockOut', 'Out')}
                            </button>
                          ) : (
                            <span className="text-xs text-green-400/60">✓ Done</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recurring Fees Card */}
            <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10">
                    <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Recurring Shift Fees</h3>
                    <p className="text-[10px] text-white/30">Transport, meal allowances, per-shift costs</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFeeForm(!showFeeForm)}
                  className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/15 hover:text-white transition-all"
                >
                  <Plus className="h-3 w-3" />
                  Add Fee
                </button>
              </div>

              {showFeeForm && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 space-y-2">
                  <input
                    placeholder="Fee name (e.g. Transport Allowance)"
                    value={newFee.name}
                    onChange={e => setNewFee(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/20 text-white text-sm rounded-xl px-3 py-2 placeholder-white/30"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount USD"
                      min={0}
                      step={0.5}
                      value={newFee.amount_usd || ''}
                      onChange={e => setNewFee(f => ({ ...f, amount_usd: Number(e.target.value) }))}
                      className="flex-1 bg-slate-800 border border-white/20 text-white text-sm rounded-xl px-3 py-2"
                    />
                    <select
                      value={newFee.applies_to}
                      onChange={e => setNewFee(f => ({ ...f, applies_to: e.target.value }))}
                      className="flex-1 bg-slate-800 border border-white/20 text-white text-sm rounded-xl px-3 py-2"
                    >
                      <option value="all">All Staff</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addFee}
                      className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-2 text-sm font-bold text-slate-900"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowFeeForm(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {fees.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-3">No recurring fees configured</p>
              ) : (
                <div className="space-y-1.5">
                  {fees.map(fee => {
                    const emp = fee.applies_to !== 'all' ? employees.find(e => e.id === fee.applies_to) : null;
                    return (
                      <div
                        key={fee.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{fee.name}</p>
                          <p className="text-xs text-white/40">{emp ? emp.name : 'All Staff'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span dir="ltr" className="text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                            ${fee.amount_usd.toFixed(2)}
                          </span>
                          <button
                            onClick={() => deleteFee(fee.id)}
                            className="p-1 text-white/25 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payroll Export Section */}
        <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl">
          <button
            onClick={() => setShowPayrollExport(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10">
                <FileDown className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Payroll Export</h3>
                <p className="text-[10px] text-white/30">Export shift hours to Finance payroll</p>
              </div>
            </div>
            {showPayrollExport
              ? <ChevronUp className="h-4 w-4 text-white/40" />
              : <ChevronDown className="h-4 w-4 text-white/40" />}
          </button>

          {showPayrollExport && (
            <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Period Start</label>
                  <input
                    type="date"
                    value={payPeriodStart}
                    onChange={e => { setPayPeriodStart(e.target.value); setExportPreview([]); }}
                    className="w-full bg-slate-800 border border-white/20 text-white text-sm rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Period End</label>
                  <input
                    type="date"
                    value={payPeriodEnd}
                    onChange={e => { setPayPeriodEnd(e.target.value); setExportPreview([]); }}
                    className="w-full bg-slate-800 border border-white/20 text-white text-sm rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <button
                onClick={() => void calculatePreview()}
                disabled={isCalculating || !payPeriodStart || !payPeriodEnd}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/15 py-2 text-sm text-indigo-300 hover:bg-indigo-500/25 disabled:opacity-50 transition-all"
              >
                <Clock className="h-3.5 w-3.5" />
                {isCalculating ? 'Calculating…' : 'Calculate Hours Preview'}
              </button>

              {/* Preview Table */}
              {exportPreview.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <p className="text-white/60 text-xs">
                    Preview: <span className="text-white font-semibold">{exportPreview.length}</span> {exportPreview.length === 1 ? 'employee' : 'employees'} ·{' '}
                    {payPeriodStart} → {payPeriodEnd}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-xs border-b border-white/10">
                        <th className="text-start pb-2 font-medium">Employee</th>
                        <th className="text-end pb-2 font-medium">Hours</th>
                        <th className="text-end pb-2 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreview.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="py-1.5 text-white/80">{row.name}</td>
                          <td className="text-end py-1.5 text-white/80 font-mono">{row.hours.toFixed(1)}h</td>
                          <td className="text-end py-1.5 text-white/40 capitalize">{row.role.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    onClick={() => void exportToPayroll()}
                    disabled={isExporting}
                    className="w-full bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 disabled:opacity-50 transition-all"
                  >
                    {isExporting ? 'Exporting…' : `Confirm Export — ${exportPreview.length} ${exportPreview.length === 1 ? 'Entry' : 'Entries'} to Finance Payroll`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Open Shift Modal */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('restaurant.shifts.openShift', 'Open Shift')}</h3>
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <select
                  value={newShift.shift_type}
                  onChange={e => setNewShift(p => ({ ...p, shift_type: e.target.value as ShiftType }))}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                >
                  {(['morning', 'evening', 'night', 'split', 'full'] as ShiftType[]).map(st => (
                    <option key={st} value={st}>{capFirst(st)}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newShift.start_time}
                    onChange={e => setNewShift(p => ({ ...p, start_time: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                  />
                  <input
                    type="time"
                    value={newShift.end_time}
                    onChange={e => setNewShift(p => ({ ...p, end_time: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <button
                onClick={() => void openShift()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20"
              >
                {t('restaurant.shifts.openShift', 'Open Shift')}
              </button>
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('restaurant.shifts.assign', 'Assign Staff')}</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                value={newAssignment.employee_id}
                onChange={e => setNewAssignment(p => ({ ...p, employee_id: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
              >
                <option value="">{t('restaurant.shifts.selectEmployee', 'Select employee...')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select
                value={newAssignment.role}
                onChange={e => setNewAssignment(p => ({ ...p, role: e.target.value as StaffRole }))}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2"
              >
                {ROLES.map(r => <option key={r} value={r}>{capFirst(r)}</option>)}
              </select>
              <input
                placeholder={t('restaurant.shifts.section', 'Section / Station (optional)')}
                value={newAssignment.section}
                onChange={e => setNewAssignment(p => ({ ...p, section: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
              />
              <button
                onClick={() => void assignStaff()}
                disabled={!newAssignment.employee_id}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {t('restaurant.shifts.assignStaff', 'Assign to Shift')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
