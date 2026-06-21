import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, UserPlus, Clock, CheckCircle, LogIn, LogOut, X } from 'lucide-react';

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

export default function ShiftManager() {
  const { t } = useTranslation();
  const { employees } = useApp();
  const [shifts, setShifts] = useState<RestaurantShift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newShift, setNewShift] = useState({ shift_type: 'morning' as ShiftType, start_time: '08:00', end_time: '16:00' });
  const [newAssignment, setNewAssignment] = useState({ employee_id: '', role: 'waiter' as StaffRole, section: '' });

  const weekDays = Array.from({ length: 7 }, (_, i) => getDayOfWeek(i));

  const loadShifts = useCallback(async () => {
    const startOfWeek = weekDays[0];
    const endOfWeek = weekDays[6];
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

  const openShift = async () => {
    const today = new Date().toISOString().split('T')[0];
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

  return (
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
            const isToday = day === new Date().toISOString().split('T')[0];
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
                        {s.shift_type} {s.start_time}–{s.end_time}
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
        <div>
          {!selectedShift ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/30 text-sm">
              {t('restaurant.shifts.selectShift', 'Select a shift to view staff')}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${SHIFT_COLORS[selectedShift.shift_type]}`}>
                    {selectedShift.shift_type}
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
                        <p className="text-xs text-white/40">{a.role}{a.section ? ` · ${a.section}` : ''}</p>
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
                {(['morning', 'evening', 'night', 'split', 'full'] as ShiftType[]).map(t => <option key={t} value={t}>{t}</option>)}
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
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder={t('restaurant.shifts.section', 'Section / Station (optional)')} value={newAssignment.section} onChange={e => setNewAssignment(p => ({ ...p, section: e.target.value }))} className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30" />
            <button onClick={() => void assignStaff()} disabled={!newAssignment.employee_id} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {t('restaurant.shifts.assignStaff', 'Assign to Shift')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
