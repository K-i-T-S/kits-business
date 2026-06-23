import { CheckCircle, Users, Calendar, Clock, ChevronDown } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { supabase } from '@/utils/supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantPublic {
  id: string;
  name: string;
  brand_logo_url: string | null;
  brand_primary: string | null;
  country: string | null;
  phone: string | null;
}

interface BookingForm {
  name: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  notes: string;
}

interface ExistingReservation {
  reserved_at: string;
  party_size: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Operating hours: 11:00–01:00 next day (inclusive of late-night Lebanese dining)
const SLOT_START_HOUR = 11;
const SLOT_END_HOUR = 25; // 25 = 01:00 next day

const MAX_RESERVATIONS_PER_SLOT = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayString(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function getMaxDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0] ?? '';
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let totalHalf = SLOT_START_HOUR * 2; totalHalf < SLOT_END_HOUR * 2; totalHalf++) {
    const adjHour = Math.floor(totalHalf / 2) % 24;
    const minute = totalHalf % 2 === 0 ? '00' : '30';
    const hh = String(adjHour).padStart(2, '0');
    slots.push(`${hh}:${minute}`);
  }
  return slots;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function countReservationsInSlot(existing: ExistingReservation[], slot: string): number {
  return existing.filter((r) => {
    const d = new Date(r.reserved_at);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = d.getMinutes() < 30 ? '00' : '30';
    return `${hh}:${mm}` === slot;
  }).length;
}

const ALL_SLOTS = generateTimeSlots();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookReservation() {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();

  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [form, setForm] = useState<BookingForm>({
    name: '',
    phone: '',
    partySize: 2,
    date: getTodayString(),
    time: '',
    notes: '',
  });

  const [existingReservations, setExistingReservations] = useState<ExistingReservation[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // ── Load tenant by slug ──────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantSlug) return;

    const fetchTenant = async () => {
      setLoadingTenant(true);
      setTenantError(null);
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, brand_logo_url, brand_primary, country, phone')
          .eq('tenant_slug', tenantSlug)
          .single();

        if (error || !data) {
          setTenantError('Restaurant not found. Please check your link.');
          return;
        }
        setTenant(data as TenantPublic);
      } catch (err) {
        setTenantError(err instanceof Error ? err.message : 'Failed to load restaurant info.');
      } finally {
        setLoadingTenant(false);
      }
    };

    void fetchTenant();
  }, [tenantSlug]);

  // ── Load existing reservations for the selected date ─────────────────────
  const loadSlots = useCallback(async (tenantId: string, date: string) => {
    if (!date) return;
    setLoadingSlots(true);
    try {
      const { data } = await supabase
        .from('reservations')
        .select('reserved_at, party_size')
        .eq('tenant_id', tenantId)
        .gte('reserved_at', `${date}T00:00:00`)
        .lt('reserved_at', `${date}T23:59:59`)
        .not('status', 'in', '("cancelled","no_show")');

      setExistingReservations((data ?? []) as ExistingReservation[]);
    } catch {
      setExistingReservations([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (tenant?.id && form.date) {
      void loadSlots(tenant.id, form.date);
      setForm((prev) => ({ ...prev, time: '' }));
    }
  }, [tenant?.id, form.date, loadSlots]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    if (!form.name.trim()) { setSubmitError('Please enter your name.'); return; }
    if (!form.phone.trim()) { setSubmitError('Please enter a phone number.'); return; }
    if (!form.time) { setSubmitError('Please select a time slot.'); return; }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const reserved_at = new Date(`${form.date}T${form.time}:00`).toISOString();
      const { error } = await supabase
        .from('reservations')
        .insert({
          tenant_id: tenant.id,
          guest_name: form.name.trim(),
          guest_phone: form.phone.trim(),
          party_size: form.partySize,
          reserved_at,
          notes: form.notes.trim() || null,
          status: 'pending',
        });

      if (error) {
        setSubmitError(error.message);
        return;
      }
      setConfirmed(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render: Loading ──────────────────────────────────────────────────────
  if (loadingTenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
      </div>
    );
  }

  // ── Render: Error ────────────────────────────────────────────────────────
  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <h1 className="text-white text-xl font-bold mb-2">Restaurant Not Found</h1>
          <p className="text-white/50 text-sm">{tenantError ?? 'This booking link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  // ── Render: Confirmation ─────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand header */}
          <BrandHeader tenant={tenant} />

          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 text-center">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-2">Reservation Received!</h2>
            <p className="text-white/60 mb-1">
              We'll see you on <span className="text-white font-medium">{formatDateDisplay(form.date)}</span> at{' '}
              <span className="text-white font-medium">{form.time}</span>
            </p>
            <p className="text-white/40 text-sm mt-2">
              A confirmation will be sent to <span className="text-white/60">{form.phone}</span>
            </p>
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-white/30 text-xs">
                Party of <strong className="text-white/50">{form.partySize}</strong> · {tenant.name}
              </p>
              {form.notes && (
                <p className="text-white/30 text-xs mt-1 italic">"{form.notes}"</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Booking Form ─────────────────────────────────────────────────
  const today = getTodayString();
  const maxDate = getMaxDateString();

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="w-full max-w-md mx-auto">

        {/* Brand header */}
        <BrandHeader tenant={tenant} />

        {/* Form card */}
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-5"
        >
          {/* Guest Name */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Ahmad Khalil"
              required
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/25 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+961 3 XXX XXX"
              required
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/25 focus:outline-none focus:border-indigo-500/60"
            />
            <p className="text-white/30 text-xs mt-1">Lebanese format: +961 X XXX XXX</p>
          </div>

          {/* Party Size */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users size={12} />
                Party Size
              </span>
            </label>
            <div className="relative">
              <select
                value={form.partySize}
                onChange={(e) => setForm((p) => ({ ...p, partySize: parseInt(e.target.value) }))}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-indigo-500/60"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'guest' : 'guests'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Calendar size={12} />
                Date <span className="text-red-400">*</span>
              </span>
            </label>
            <input
              type="date"
              value={form.date}
              min={today}
              max={maxDate}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                Time <span className="text-red-400">*</span>
              </span>
            </label>

            {loadingSlots ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {ALL_SLOTS.map((slot) => {
                  const count = countReservationsInSlot(existingReservations, slot);
                  const isFull = count >= MAX_RESERVATIONS_PER_SLOT;
                  const isSelected = form.time === slot;

                  if (isFull) {
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled
                        className="rounded-xl bg-white/5 text-white/20 cursor-not-allowed py-2 text-xs font-medium line-through"
                        aria-label={`${slot} — fully booked`}
                      >
                        {slot}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, time: slot }))}
                      className={`rounded-xl py-2 text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`Select time ${slot}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">
              Special Requests
              <span className="text-white/30 font-normal ms-1">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Allergies, celebrations, high chair needed..."
              rows={2}
              className="w-full resize-none bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/25 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {/* Error */}
          {submitError && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.time}
            className="w-full bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-6 py-3 font-medium text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {submitting ? 'Submitting…' : 'Reserve My Table'}
          </button>

          <p className="text-center text-white/25 text-xs">
            Your reservation will be confirmed by the restaurant.
          </p>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand header sub-component
// ---------------------------------------------------------------------------

function BrandHeader({ tenant }: { tenant: TenantPublic }) {
  return (
    <div className="text-center mb-6">
      {tenant.brand_logo_url ? (
        <img
          src={tenant.brand_logo_url}
          alt={`${tenant.name} logo`}
          className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 border border-white/10"
        />
      ) : (
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-600/40 to-sky-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🍽️</span>
        </div>
      )}
      <h1 className="text-white text-xl font-bold">{tenant.name}</h1>
      <p className="text-white/50 text-sm mt-0.5">Reserve a Table</p>
    </div>
  );
}
