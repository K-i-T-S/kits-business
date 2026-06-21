import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, UserPlus, Clock, CheckCircle, LogIn, LogOut, X, Plus, Trash2, DollarSign, Link } from 'lucide-react';

import Layout from '@/components/Layout';
import { supabase } from '@/utils/supabaseClient';
import { useApp } from '@/context/AppContext';
import type { RestaurantShift, ShiftAssignment, ShiftType, StaffRole } from '@/types/restaurant';

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
  const tenantId = currentTenant?.id ?? 'default';

  const feesKey = `shift_fees_${tenantId}`;
  const tipsKey = `tips_config_${tenantId}`;

  const [shifts, setShifts] = useState<RestaurantShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newShift, setNewShift] = useState({ shift_type: 'morning' as ShiftType, start_time: '08:00', end_time: '16:00' });
  const [newAssignment, setNewAssignment] = useState({ employee_id: '', role: 'waiter' as StaffRole, section: '' });

  // Recurring fees
  const [fees, setFees] = useState<RecurringFee[]>(() => {
    try {
      const s = localStorage.getItem(feesKey);
      return s ? (JSON.parse(s) as RecurringFee[]) : [];
    } catch { return []; }
  });
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [newFee, setNewFee] = useState({ name: '', amount_usd: 0, applies_to: 'all' });

  // Tips config
  const [tipsConfig, setTipsConfig] = useState<TipsConfig | null>(() => {
    try {
      const s = localStorage.getItem(tipsKey);
      return s ? (JSON.parse(s) as TipsConfig) : null;
    } catch { return null; }
  });

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
    const startOfWeek = weekDays[0] ?? '';
    const endOfWeek = weekDays[6] ?? '';
    const { data } = await supabase
      .from('restaurant_shifts')
      .select('*')
      .gte('shift_date', startOfWeek)
      .lte('shift_date', endOfWeek)
      .order('shift_date');
    setShifts((data ?? []) as RestaurantShift[]);
  }, [weekDays]);

  const loadAssignments = useCallback(async () => {
    if (!selectedShiftId) return;
    const { data } = await supabase
      .from('restaurant_shift_assignments')
      .select('*')
      .eq('shift_id', selectedShiftId);
    setAssignments((data ?? []) as ShiftAssignment[]);
  }, [selectedShiftId]);

  useEffect(() => { void loadShifts(); }, [loadShifts]);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  // Reload tips config when switching to tab (in case user saved it)
  useEffect(() => {
    try {
      const s = localStorage.getItem(tipsKey);
      setTipsConfig(s ? (JSON.parse(s) as TipsConfig) : null);
    } catch { /* ignore */ }
  }, [tipsKey]);

  const openShift = async () => {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const { data } = await supabase
      .from('restaurant_shifts')
      .insert({ shift_date: today, ...newShift })
      .select()
      .single();
    if (data) {
      setShifts(prev => [...prev, data as RestaurantShift]);
      setSelectedShiftId((data as RestaurantShift).id);
    }
    setShowOpenModal(false);
  };

  const closeShift = async (shiftId: string) => {
    await supabase
      .from('restaurant_shifts')
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq('id', shiftId);
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, is_closed: true } : s));
  };

  const assignStaff = async () => {
    if (!selectedShiftId || !newAssignment.employee_id) return;
    const { data } = await supabase
      .from('restaurant_shift_assignments')
      .insert({ shift_id: selectedShiftId, ...newAssignment })
      .select()
      .single();
    if (data) setAssignments(prev => [...prev, data as ShiftAssignment]);
    setShowAssignModal(false);
    setNewAssignment({ employee_id: '', role: 'waiter', section: '' });
  };

  const clockIn = async (assignmentId: string) => {
    await supabase
      .from('restaurant_shift_assignments')
      .update({ clocked_in_at: new Date().toISOString() })
      .eq('id', assignmentId);
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, clocked_in_at: new Date().toISOString() } : a));
  };

  const clockOut = async (assignmentId: string) => {
    await supabase
      .from('restaurant_shift_assignments')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('id', assignmentId);
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
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">{t('restaurant.shifts.title', 'Shift Management')}</h1>
          <button
            onClick={() => setShowOpenModal(true)}
            className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Clock className="h-4 w-4" />
            {t('restaurant.shifts.openShift', 'Open Shift')}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Week Grid */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              {t('restaurant.shifts.thisWeek', 'This Week')}
            </h2>
            {weekDays.map(day => {
              const dayShifts = shifts.filter(s => s.shift_date === day);
              const isToday = day === (new Date().toISOString().split('T')[0] ?? '');
              return (
                <div key={day} className={`rounded-2xl border p-3 ${isToday ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/10 bg-white/5'}`}>
                  <p className={`text-xs font-semibold mb-2 ${isToday ? 'text-indigo-400' : 'text-white/50'}`}>
                    {new Date(day).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {isToday && <span className="ml-2 text-indigo-400">• Today</span>}
                  </p>
                  {dayShifts.length === 0 ? (
                    <p className="text-xs text-white/20">{t('restaurant.shifts.noShift', 'No shift')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dayShifts.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedShiftId(s.id)}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-all ${SHIFT_COLORS[s.shift_type]} ${selectedShiftId === s.id ? 'ring-2 ring-indigo-400' : ''}`}
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

          {/* Selected Shift Detail */}
          <div className="space-y-4">
            {!selectedShift ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/30 text-sm">
                {t('restaurant.shifts.selectShift', 'Select a shift to view staff')}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${SHIFT_COLORS[selectedShift.shift_type]}`}>
                      {capFirst(selectedShift.shift_type)}
                    </span>
                    <span className="ml-2 text-sm text-white/60">{selectedShift.start_time} – {selectedShift.end_time}</span>
                  </div>
                  {!selectedShift.is_closed ? (
                    <button onClick={() => void closeShift(selectedShift.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t('restaurant.shifts.closeShift', 'Close Shift')}
                    </button>
                  ) : (
                    <span className="text-xs text-green-400">✓ {t('restaurant.shifts.closed', 'Closed')}</span>
                  )}
                </div>

                {/* Tips estimate */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-300">{getTipsLabel()}</p>
                    {!tipsConfig && (
                      <a href="/restaurant/tips" className="ml-auto text-[10px] text-indigo-400 underline flex items-center gap-1">
                        <Link className="h-3 w-3" />Configure
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/70">{t('restaurant.shifts.staff', 'Staff on Shift')}</h3>
                  <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                    <UserPlus className="h-3 w-3" />
                    {t('restaurant.shifts.assign', 'Assign')}
                  </button>
                </div>

                <div className="space-y-2">
                  {assignments.length === 0 && (
                    <p className="text-xs text-white/30">{t('restaurant.shifts.noStaff', 'No staff assigned yet')}</p>
                  )}
                  {assignments.map(a => {
                    const emp = employees.find(e => e.id === a.employee_id);
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-white">{emp?.name ?? a.employee_id.slice(0, 8)}</p>
                          <p className="text-xs text-white/40">
                            {capFirst(a.role)}{a.section ? ` · ${a.section}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{getHours(a)}</span>
                          {!a.clocked_in_at ? (
                            <button onClick={() => void clockIn(a.id)} className="rounded-lg bg-green-500/20 px-2 py-1 text-xs text-green-400 flex items-center gap-1">
                              <LogIn className="h-3 w-3" />
                              {t('restaurant.shifts.clockIn', 'In')}
                            </button>
                          ) : !a.clocked_out_at ? (
                            <button onClick={() => void clockOut(a.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-400 flex items-center gap-1">
                              <LogOut className="h-3 w-3" />
                              {t('restaurant.shifts.clockOut', 'Out')}
                            </button>
                          ) : (
                            <span className="text-xs text-white/30">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recurring Fees Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Recurring Shift Fees</h3>
                </div>
                <button
                  onClick={() => setShowFeeForm(!showFeeForm)}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/15"
                >
                  <Plus className="h-3 w-3" />
                  Add Fee
                </button>
              </div>
              <p className="text-[10px] text-white/30">Transport, meal allowances and other per-shift costs</p>

              {showFeeForm && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
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
                    <button onClick={addFee} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2 text-sm font-semibold text-white">
                      Add
                    </button>
                    <button onClick={() => setShowFeeForm(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {fees.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-2">No recurring fees configured</p>
              ) : (
                <div className="space-y-1.5">
                  {fees.map(fee => {
                    const emp = fee.applies_to !== 'all' ? employees.find(e => e.id === fee.applies_to) : null;
                    return (
                      <div key={fee.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-white">{fee.name}</p>
                          <p className="text-xs text-white/40">{emp ? emp.name : 'All Staff'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-amber-400">${fee.amount_usd.toFixed(2)}</span>
                          <button onClick={() => deleteFee(fee.id)} className="p-1 text-white/30 hover:text-red-400">
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

        {/* Open Shift Modal */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('restaurant.shifts.openShift', 'Open Shift')}</h3>
                <button onClick={() => setShowOpenModal(false)}><X className="h-5 w-5 text-white/40" /></button>
              </div>
              <div className="space-y-3">
                <select value={newShift.shift_type} onChange={e => setNewShift(p => ({ ...p, shift_type: e.target.value as ShiftType }))} className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2">
                  {(['morning', 'evening', 'night', 'split', 'full'] as ShiftType[]).map(st => <option key={st} value={st}>{capFirst(st)}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="time" value={newShift.start_time} onChange={e => setNewShift(p => ({ ...p, start_time: e.target.value }))} className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2" />
                  <input type="time" value={newShift.end_time} onChange={e => setNewShift(p => ({ ...p, end_time: e.target.value }))} className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2" />
                </div>
              </div>
              <button onClick={() => void openShift()} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white">
                {t('restaurant.shifts.openShift', 'Open Shift')}
              </button>
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('restaurant.shifts.assign', 'Assign Staff')}</h3>
                <button onClick={() => setShowAssignModal(false)}><X className="h-5 w-5 text-white/40" /></button>
              </div>
              <select value={newAssignment.employee_id} onChange={e => setNewAssignment(p => ({ ...p, employee_id: e.target.value }))} className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2">
                <option value="">{t('restaurant.shifts.selectEmployee', 'Select employee...')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select value={newAssignment.role} onChange={e => setNewAssignment(p => ({ ...p, role: e.target.value as StaffRole }))} className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2">
                {ROLES.map(r => <option key={r} value={r}>{capFirst(r)}</option>)}
              </select>
              <input placeholder={t('restaurant.shifts.section', 'Section / Station (optional)')} value={newAssignment.section} onChange={e => setNewAssignment(p => ({ ...p, section: e.target.value }))} className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30" />
              <button onClick={() => void assignStaff()} disabled={!newAssignment.employee_id} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {t('restaurant.shifts.assignStaff', 'Assign to Shift')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
