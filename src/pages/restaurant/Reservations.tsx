import {
  Plus, X, Phone, Users, Calendar, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { Reservation, ReservationStatus, RestaurantTable } from '@/types/restaurant';
import { RESERVATION_STATUS_LABELS } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

type FilterType = 'today' | 'upcoming' | 'all';

const STATUS_CONFIG: Record<ReservationStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending: { bg: 'bg-amber-500/15 border border-amber-500/30', text: 'text-amber-400', icon: Clock },
  confirmed: { bg: 'bg-indigo-500/15 border border-indigo-500/30', text: 'text-indigo-400', icon: CheckCircle },
  seated: { bg: 'bg-emerald-500/15 border border-emerald-500/30', text: 'text-emerald-400', icon: Users },
  completed: { bg: 'bg-slate-500/15 border border-slate-500/30', text: 'text-slate-400', icon: CheckCircle },
  no_show: { bg: 'bg-red-500/15 border border-red-500/30', text: 'text-red-400', icon: XCircle },
  cancelled: { bg: 'bg-slate-500/10 border border-slate-500/20', text: 'text-slate-500', icon: XCircle },
};

interface ReservationFormData {
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reserved_date: string;
  reserved_time: string;
  table_id: string;
  notes: string;
}

const EMPTY_FORM: ReservationFormData = {
  guest_name: '',
  guest_phone: '',
  party_size: 2,
  reserved_date: new Date().toISOString().split('T')[0]!,
  reserved_time: '19:00',
  table_id: '',
  notes: '',
};

function formatReservedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildWhatsAppLink(phone: string, guestName: string, reservedAt: string, partySize: number): string {
  const formatted = formatReservedAt(reservedAt);
  const msg = encodeURIComponent(
    `Hello ${guestName}! Your reservation for ${partySize} guests on ${formatted} has been confirmed. We look forward to seeing you! — KiTS Restaurant`,
  );
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${msg}`;
}

export default function Reservations() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ReservationFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [resRes, tabRes] = await Promise.all([
        supabase.from('reservations').select('*').eq('tenant_id', tenantId).order('reserved_at', { ascending: true }),
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
      ]);
      if (resRes.data) setReservations(resRes.data as Reservation[]);
      if (tabRes.data) setTables(tabRes.data as RestaurantTable[]);
    } catch (err) {
      console.error('[Reservations] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredReservations = reservations.filter((r) => {
    const d = new Date(r.reserved_at);
    const today = new Date();
    if (filter === 'today') {
      return d.toDateString() === today.toDateString();
    }
    if (filter === 'upcoming') {
      return d >= today && !['completed', 'no_show', 'cancelled'].includes(r.status);
    }
    return true;
  });

  const handleCreate = async () => {
    if (!tenantId) return;
    if (!form.guest_name.trim()) { toast.error(t('restaurant.reservation.nameRequired', 'Guest name required')); return; }
    if (!form.guest_phone.trim()) { toast.error(t('restaurant.reservation.phoneRequired', 'Phone required')); return; }

    setSaving(true);
    try {
      const reserved_at = new Date(`${form.reserved_date}T${form.reserved_time}`).toISOString();
      const { data, error } = await supabase.from('reservations').insert({
        tenant_id: tenantId,
        table_id: form.table_id || null,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        party_size: form.party_size,
        reserved_at,
        notes: form.notes.trim() || null,
        status: 'pending',
      }).select().single();
      if (error) { toast.error(error.message); return; }
      if (data) setReservations((prev) => [...prev, data as Reservation].sort((a, b) => a.reserved_at.localeCompare(b.reserved_at)));
      setModalOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t('restaurant.reservation.created', 'Reservation created'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setStatusMenuId(null);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('reservations').delete().eq('id', id);
    setReservations((prev) => prev.filter((r) => r.id !== id));
    toast.success(t('restaurant.reservation.deleted', 'Reservation deleted'));
  };

  const nextStatuses: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['seated', 'no_show', 'cancelled'],
    seated: ['completed'],
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{t('restaurant.reservations', 'Reservations')}</h1>
              <p className="mt-1 text-sm text-white/40">{t('restaurant.reservationsDesc', 'Manage guest bookings and table assignments')}</p>
            </div>
            <button
              onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('restaurant.newReservation', 'New Reservation')}
            </button>
          </div>

          {/* Filters */}
          <div className="mb-4 flex gap-2">
            {(['today', 'upcoming', 'all'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
                  filter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {t(`restaurant.filter.${f}`, f === 'today' ? 'Today' : f === 'upcoming' ? 'Upcoming' : 'All')}
              </button>
            ))}
            <span className="ml-auto self-center rounded-full bg-white/5 px-3 py-1 text-xs text-white/40">
              {filteredReservations.length} {t('restaurant.reservationCount', 'reservations')}
            </span>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-800/30">
              <Calendar className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/30">{t('restaurant.noReservations', 'No reservations')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((reservation) => {
                const cfg = STATUS_CONFIG[reservation.status];
                const StatusIcon = cfg.icon;
                const table = tables.find((t) => t.id === reservation.table_id);
                const actions = nextStatuses[reservation.status] ?? [];

                return (
                  <div
                    key={reservation.id}
                    className="flex flex-wrap items-start gap-4 rounded-2xl border border-white/10 bg-slate-800/50 p-4 transition-all hover:border-white/20"
                  >
                    {/* Guest info */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{reservation.guest_name}</h3>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.bg} ${cfg.text}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {RESERVATION_STATUS_LABELS[reservation.status]}
                        </span>
                        {table && (
                          <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] text-indigo-400">
                            T{table.number}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatReservedAt(reservation.reserved_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {reservation.party_size} {t('restaurant.guests', 'guests')}
                        </span>
                        <a
                          href={`tel:${reservation.guest_phone}`}
                          className="flex items-center gap-1 text-indigo-400/80 hover:text-indigo-400 transition-colors"
                        >
                          <Phone className="h-3 w-3" />
                          {reservation.guest_phone}
                        </a>
                      </div>
                      {reservation.notes && (
                        <p className="mt-1.5 text-xs text-amber-400/70 italic">{reservation.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {/* WhatsApp confirm */}
                      <a
                        href={buildWhatsAppLink(reservation.guest_phone, reservation.guest_name, reservation.reserved_at, reservation.party_size)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-600/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-600/30"
                        title="Send WhatsApp confirmation"
                      >
                        <Phone className="h-3 w-3" />
                        WA
                      </a>

                      {/* Status actions */}
                      {actions.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setStatusMenuId(statusMenuId === reservation.id ? null : reservation.id)}
                            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/10 transition-all"
                          >
                            {t('restaurant.updateStatus', 'Status')}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          {statusMenuId === reservation.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                              {actions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { void handleStatusChange(reservation.id, s); }}
                                  className="flex w-full items-center px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors first:rounded-t-xl last:rounded-b-xl capitalize"
                                >
                                  {RESERVATION_STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => { void handleDelete(reservation.id); }}
                        className="rounded-xl border border-white/10 p-1.5 text-white/20 hover:border-red-500/30 hover:text-red-400 transition-all"
                        aria-label={`Delete reservation for ${reservation.guest_name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Reservation Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{t('restaurant.newReservation', 'New Reservation')}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/50">{t('restaurant.guestName', 'Guest Name')} *</label>
                <input
                  type="text"
                  value={form.guest_name}
                  onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                  placeholder="e.g. Ahmad Khalil"
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">{t('restaurant.guestPhone', 'Phone (WhatsApp)')} *</label>
                <input
                  type="tel"
                  value={form.guest_phone}
                  onChange={(e) => setForm((p) => ({ ...p, guest_phone: e.target.value }))}
                  placeholder="+961 3 XXX XXX"
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.partySize', 'Party Size')}</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.party_size}
                    onChange={(e) => setForm((p) => ({ ...p, party_size: parseInt(e.target.value) || 2 }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.assignTable', 'Table (optional)')}</label>
                  <select
                    value={form.table_id}
                    onChange={(e) => setForm((p) => ({ ...p, table_id: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">{t('restaurant.noTable', '— None —')}</option>
                    {tables.filter((t) => t.status === 'available').map((t) => (
                      <option key={t.id} value={t.id}>T{t.number} ({t.seats}p)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.date', 'Date')}</label>
                  <input
                    type="date"
                    value={form.reserved_date}
                    onChange={(e) => setForm((p) => ({ ...p, reserved_date: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.time', 'Time')}</label>
                  <input
                    type="time"
                    value={form.reserved_time}
                    onChange={(e) => setForm((p) => ({ ...p, reserved_time: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/50">{t('restaurant.notes', 'Notes (optional)')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Allergies, special requests, occasions..."
                  rows={2}
                  className="w-full resize-none rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { void handleCreate(); }}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? t('common.saving', 'Saving…') : t('restaurant.createReservation', 'Create Reservation')}
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>

              <p className="flex items-center gap-1.5 text-[10px] text-white/30">
                <AlertCircle className="h-3 w-3" />
                {t('restaurant.whatsAppNote', 'After creating, use the WA button to send a WhatsApp confirmation')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
