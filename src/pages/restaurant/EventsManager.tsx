import {
  Plus,
  X,
  CalendarHeart,
  Users,
  Phone,
  Mail,
  DollarSign,
  CheckCircle,
  Clock,
  Pencil,
  CheckCheck,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RestaurantEvent {
  id: string;
  tenant_id: string;
  event_name: string;
  event_type: 'private' | 'birthday' | 'engagement' | 'corporate' | 'wedding' | 'other';
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  event_date: string; // DATE as ISO string
  start_time: string; // TIME as HH:MM
  end_time: string | null;
  guest_count: number;
  room_section: string | null;
  menu_package: string | null;
  min_spend_usd: number | null;
  deposit_usd: number;
  deposit_paid: boolean;
  deposit_paid_at: string | null;
  notes: string | null;
  status: 'inquiry' | 'confirmed' | 'deposit_paid' | 'completed' | 'cancelled';
  created_at: string;
}

type EventStatus = RestaurantEvent['status'];
type EventType = RestaurantEvent['event_type'];
type FilterStatus = EventStatus | 'all';

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_EMOJI: Record<EventType, string> = {
  birthday: '🎂',
  engagement: '💍',
  corporate: '👔',
  private: '🎊',
  wedding: '💒',
  other: '📅',
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  birthday: 'Birthday',
  engagement: 'Engagement',
  corporate: 'Corporate',
  private: 'Private',
  wedding: 'Wedding',
  other: 'Other',
};

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string }> = {
  inquiry: { bg: 'bg-blue-500/15 border border-blue-500/30', text: 'text-blue-400' },
  confirmed: { bg: 'bg-green-500/15 border border-green-500/30', text: 'text-green-400' },
  deposit_paid: { bg: 'bg-emerald-500/15 border border-emerald-500/30', text: 'text-emerald-400' },
  completed: { bg: 'bg-slate-500/15 border border-slate-500/30', text: 'text-slate-400' },
  cancelled: { bg: 'bg-red-500/15 border border-red-500/30', text: 'text-red-400' },
};

const STATUS_LABELS: Record<EventStatus, string> = {
  inquiry: 'Inquiry',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ROOM_OPTIONS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'private_room', label: 'Private Room' },
  { value: 'full_venue', label: 'Full Venue' },
];

const PACKAGE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'custom', label: 'Custom' },
];

// ── Form default ──────────────────────────────────────────────────────────────

interface EventFormData {
  event_name: string;
  event_type: EventType;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  room_section: string;
  menu_package: string;
  min_spend_usd: string;
  deposit_usd: string;
  notes: string;
}

const EMPTY_FORM: EventFormData = {
  event_name: '',
  event_type: 'private',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  event_date: new Date().toISOString().split('T')[0]!,
  start_time: '19:00',
  end_time: '',
  guest_count: 50,
  room_section: '',
  menu_package: '',
  min_spend_usd: '',
  deposit_usd: '',
  notes: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  if (h === undefined || m === undefined) return time;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${ampm}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventsManager() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [events, setEvents] = useState<RestaurantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RestaurantEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('event_date', { ascending: false });
      if (error) { console.error('[EventsManager] load error:', error); return; }
      setEvents((data ?? []) as RestaurantEvent[]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0]!;

  const upcomingCount = events.filter(
    (e) => ['inquiry', 'confirmed', 'deposit_paid'].includes(e.status) && e.event_date >= today,
  ).length;

  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const confirmedRevenue = events
    .filter((e) => ['confirmed', 'deposit_paid'].includes(e.status) && e.event_date.startsWith(thisMonth))
    .reduce((sum, e) => sum + (e.min_spend_usd ?? 0), 0);

  const pendingDeposits = events
    .filter((e) => !e.deposit_paid && e.status !== 'cancelled')
    .reduce((sum, e) => sum + (e.deposit_usd ?? 0), 0);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = events.filter((e) => filterStatus === 'all' || e.status === filterStatus);

  // ── Open modal ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (ev: RestaurantEvent) => {
    setEditingEvent(ev);
    setForm({
      event_name: ev.event_name,
      event_type: ev.event_type,
      contact_name: ev.contact_name,
      contact_phone: ev.contact_phone ?? '',
      contact_email: ev.contact_email ?? '',
      event_date: ev.event_date,
      start_time: ev.start_time,
      end_time: ev.end_time ?? '',
      guest_count: ev.guest_count,
      room_section: ev.room_section ?? '',
      menu_package: ev.menu_package ?? '',
      min_spend_usd: ev.min_spend_usd !== null ? String(ev.min_spend_usd) : '',
      deposit_usd: String(ev.deposit_usd),
      notes: ev.notes ?? '',
    });
    setModalOpen(true);
  };

  // ── Save (create / update) ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!tenantId) return;
    if (!form.event_name.trim()) { toast.error('Event name is required'); return; }
    if (!form.contact_name.trim()) { toast.error('Contact name is required'); return; }
    if (!form.event_date) { toast.error('Event date is required'); return; }
    if (!form.start_time) { toast.error('Start time is required'); return; }

    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        event_name: form.event_name.trim(),
        event_type: form.event_type,
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        guest_count: form.guest_count,
        room_section: form.room_section || null,
        menu_package: form.menu_package || null,
        min_spend_usd: form.min_spend_usd ? parseFloat(form.min_spend_usd) : null,
        deposit_usd: form.deposit_usd ? parseFloat(form.deposit_usd) : 0,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingEvent) {
        const { data, error } = await supabase
          .from('restaurant_events')
          .update(payload)
          .eq('id', editingEvent.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();
        if (error) { toast.error(error.message); return; }
        if (data) {
          setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? (data as RestaurantEvent) : e));
        }
        toast.success('Event updated');
      } else {
        const { data, error } = await supabase
          .from('restaurant_events')
          .insert({ ...payload, status: 'inquiry' })
          .select()
          .single();
        if (error) { toast.error(error.message); return; }
        if (data) {
          setEvents((prev) => [data as RestaurantEvent, ...prev]);
        }
        toast.success('Event created');
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ── Mark deposit paid ─────────────────────────────────────────────────────

  const handleMarkDepositPaid = async (ev: RestaurantEvent) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_events')
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        status: 'deposit_paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ev.id)
      .eq('tenant_id', tenantId);
    if (error) { toast.error(error.message); return; }
    setEvents((prev) =>
      prev.map((e) =>
        e.id === ev.id
          ? { ...e, deposit_paid: true, deposit_paid_at: new Date().toISOString(), status: 'deposit_paid' }
          : e,
      ),
    );
    toast.success('Deposit marked as paid');
  };

  // ── Complete ──────────────────────────────────────────────────────────────

  const handleComplete = async (ev: RestaurantEvent) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_events')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', ev.id)
      .eq('tenant_id', tenantId);
    if (error) { toast.error(error.message); return; }
    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, status: 'completed' } : e));
    toast.success('Event marked as completed');
  };

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = async (ev: RestaurantEvent) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_events')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', ev.id)
      .eq('tenant_id', tenantId);
    if (error) { toast.error(error.message); return; }
    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, status: 'cancelled' } : e));
    toast.success('Event cancelled');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const FILTER_OPTIONS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'inquiry', label: 'Inquiry' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'deposit_paid', label: 'Deposit Paid' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {t('restaurant.events.title', 'Private Events')}
              </h1>
              <p className="mt-1 text-sm text-white/40">
                {t('restaurant.events.subtitle', 'Manage event bookings, deposits, and packages')}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('restaurant.events.newEvent', 'New Event')}
            </button>
          </div>

          {/* ── Stats bar ───────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/40 mb-1">{t('restaurant.events.upcomingEvents', 'Upcoming Events')}</p>
              <p className="text-2xl font-bold text-white">{upcomingCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/40 mb-1">{t('restaurant.events.confirmedRevenue', 'Confirmed Revenue (this month)')}</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${confirmedRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/40 mb-1">{t('restaurant.events.pendingDeposits', 'Pending Deposits')}</p>
              <p className="text-2xl font-bold text-amber-400">
                ${pendingDeposits.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* ── Filter chips ─────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterStatus(opt.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
                  filterStatus === opt.key
                    ? 'border border-amber-500/30 bg-amber-500/15 text-amber-200 shadow-lg shadow-amber-500/10'
                    : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="ml-auto self-center rounded-full bg-white/5 px-3 py-1 text-xs text-white/40">
              {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* ── Event list ───────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 shadow-2xl">
              <CalendarHeart className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/30">
                {t('restaurant.events.noEvents', 'No events found')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((ev) => {
                const statusStyle = STATUS_STYLE[ev.status];
                const emoji = EVENT_TYPE_EMOJI[ev.event_type];

                return (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-start gap-4 rounded-2xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 p-4 shadow-xl transition-all hover:border-amber-500/20 hover:shadow-amber-500/5"
                  >
                    {/* Left icon */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-2xl">
                      {emoji}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{ev.event_name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyle.bg} ${statusStyle.text}`}>
                          {STATUS_LABELS[ev.status]}
                        </span>
                        <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-white/50">
                          {EVENT_TYPE_LABELS[ev.event_type]}
                        </span>
                      </div>

                      <p className="text-xs text-white/60 mb-1">{ev.contact_name}</p>

                      <div className="flex flex-wrap gap-3 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <CalendarHeart className="h-3 w-3" />
                          {formatEventDate(ev.event_date)} · {formatTime(ev.start_time)}
                          {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ev.guest_count} guests
                        </span>
                        {ev.contact_phone && (
                          <a
                            href={`tel:${ev.contact_phone}`}
                            className="flex items-center gap-1 text-indigo-400/80 hover:text-indigo-400 transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                            {ev.contact_phone}
                          </a>
                        )}
                        {ev.room_section && (
                          <span className="capitalize">{ev.room_section.replace('_', ' ')}</span>
                        )}
                        {ev.menu_package && (
                          <span className="capitalize">{ev.menu_package} package</span>
                        )}
                      </div>

                      {/* Financial row */}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {ev.min_spend_usd !== null && (
                          <span className="flex items-center gap-1 text-xs text-white/50">
                            <DollarSign className="h-3 w-3" />
                            Min spend: <span className="font-semibold text-white/70">${ev.min_spend_usd.toLocaleString()}</span>
                          </span>
                        )}
                        {ev.deposit_usd > 0 && (
                          ev.deposit_paid ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                              <CheckCircle className="h-2.5 w-2.5" />
                              Deposit Paid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              <Clock className="h-2.5 w-2.5" />
                              Deposit Pending (${ev.deposit_usd})
                            </span>
                          )
                        )}
                      </div>

                      {ev.notes && (
                        <p className="mt-1.5 text-xs text-amber-400/70 italic">{ev.notes}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => openEdit(ev)}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-all"
                        title="Edit event"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>

                      {/* Mark deposit paid */}
                      {!ev.deposit_paid && ev.deposit_usd > 0 && ev.status !== 'cancelled' && ev.status !== 'completed' && (
                        <button
                          onClick={() => { void handleMarkDepositPaid(ev); }}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-600/20 border border-amber-600/30 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-600/30 transition-all"
                          title="Mark deposit as paid"
                        >
                          <DollarSign className="h-3 w-3" />
                          Mark Paid
                        </button>
                      )}

                      {/* Complete */}
                      {['confirmed', 'deposit_paid'].includes(ev.status) && (
                        <button
                          onClick={() => { void handleComplete(ev); }}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-600/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/30 transition-all"
                          title="Mark as completed"
                        >
                          <CheckCheck className="h-3 w-3" />
                          Complete
                        </button>
                      )}

                      {/* Cancel */}
                      {!['completed', 'cancelled'].includes(ev.status) && (
                        <button
                          onClick={() => { void handleCancel(ev); }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-red-400/60 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all"
                          title="Cancel event"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── New / Edit Modal ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingEvent
                  ? t('restaurant.events.editEvent', 'Edit Event')
                  : t('restaurant.events.newEvent', 'New Event')
                }
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">

              {/* Event name */}
              <div>
                <label className="mb-1 block text-xs text-white/50">Event Name *</label>
                <input
                  type="text"
                  value={form.event_name}
                  onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
                  placeholder="e.g. Rania's Engagement Dinner"
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>

              {/* Event type */}
              <div>
                <label className="mb-1 block text-xs text-white/50">Event Type *</label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value as EventType }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2 focus:outline-none"
                >
                  {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{EVENT_TYPE_EMOJI[val]} {label}</option>
                  ))}
                </select>
              </div>

              {/* Contact name */}
              <div>
                <label className="mb-1 block text-xs text-white/50">Contact Name *</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                  placeholder="e.g. Ahmad Khalil"
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">
                    <Phone className="inline h-3 w-3 mr-1" />Phone
                  </label>
                  <input
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                    placeholder="+961 3 XXX XXX"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">
                    <Mail className="inline h-3 w-3 mr-1" />Email
                  </label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                    placeholder="optional"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Date + Start time + End time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Date *</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">Start Time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Guest count */}
              <div>
                <label className="mb-1 block text-xs text-white/50">Guest Count *</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={form.guest_count}
                  onChange={(e) => setForm((p) => ({ ...p, guest_count: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Room + Package */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Room / Section</label>
                  <select
                    value={form.room_section}
                    onChange={(e) => setForm((p) => ({ ...p, room_section: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2 focus:outline-none"
                  >
                    <option value="">— None —</option>
                    {ROOM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">Menu Package</label>
                  <select
                    value={form.menu_package}
                    onChange={(e) => setForm((p) => ({ ...p, menu_package: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2 focus:outline-none"
                  >
                    <option value="">— None —</option>
                    {PACKAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Min spend + Deposit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Min Spend (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={form.min_spend_usd}
                    onChange={(e) => setForm((p) => ({ ...p, min_spend_usd: e.target.value }))}
                    placeholder="e.g. 1500"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">Deposit (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={form.deposit_usd}
                    onChange={(e) => setForm((p) => ({ ...p, deposit_usd: e.target.value }))}
                    placeholder="e.g. 500"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs text-white/50">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Special requests, dietary restrictions, setup requirements..."
                  rows={3}
                  className="w-full resize-none rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { void handleSave(); }}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : (editingEvent ? 'Update Event' : 'Create Event')}
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
