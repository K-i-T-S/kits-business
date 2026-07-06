import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Users, Plus, X, MessageCircle, Armchair, XCircle } from 'lucide-react';

import Layout from '@/components/Layout';
import RoleGate from '@/components/RoleGate';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'no_show' | 'cancelled';

interface WaitlistEntry {
  id: string;
  tenant_id: string;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  status: WaitlistStatus;
  notes: string | null;
  table_id: string | null;
  created_at: string;
  notified_at: string | null;
  seated_at: string | null;
}

interface AvailableTable {
  id: string;
  number: number;
  seats: number;
  status: string;
}

interface WaitlistFormData {
  guest_name: string;
  guest_phone: string;
  party_size: number;
  notes: string;
}

const EMPTY_FORM: WaitlistFormData = { guest_name: '', guest_phone: '', party_size: 2, notes: '' };
const ACTIVE_STATUSES: WaitlistStatus[] = ['waiting', 'notified'];
const POLL_INTERVAL_MS = 30_000;

function formatElapsed(createdAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function buildReadyWhatsAppLink(phone: string, guestName: string, partySize: number): string {
  const msg = encodeURIComponent(
    `Hi ${guestName}! Your table for ${partySize} is ready — please head to the host stand. — KiTS Restaurant`,
  );
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${msg}`;
}

export default function Waitlist() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<WaitlistFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seatingEntry, setSeatingEntry] = useState<WaitlistEntry | null>(null);
  const [seatTargetTableId, setSeatTargetTableId] = useState('');
  const [seating, setSeating] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    const [waitlistRes, tablesRes] = await Promise.all([
      supabase.from('restaurant_waitlist').select('*').eq('tenant_id', tenantId).in('status', ACTIVE_STATUSES).order('created_at'),
      supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).eq('status', 'available').order('number'),
    ]);
    if (waitlistRes.error || tablesRes.error) toast.error(t('waitlist.loadError', 'Failed to load waitlist'));
    if (waitlistRes.data) setEntries(waitlistRes.data as WaitlistEntry[]);
    if (tablesRes.data) setAvailableTables(tablesRes.data as AvailableTable[]);
  }, [tenantId, t]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => { void loadData(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreate = async () => {
    if (!tenantId) return;
    if (!form.guest_name.trim()) { toast.error(t('waitlist.nameRequired', 'Guest name required')); return; }
    if (!form.guest_phone.trim()) { toast.error(t('waitlist.phoneRequired', 'Phone required')); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('restaurant_waitlist').insert({
        tenant_id: tenantId,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        party_size: form.party_size,
        notes: form.notes.trim() || null,
        status: 'waiting',
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setAddModalOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t('waitlist.added', 'Added to waitlist'));
      void loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleNotify = async (entry: WaitlistEntry) => {
    const { error } = await supabase
      .from('restaurant_waitlist')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    window.open(buildReadyWhatsAppLink(entry.guest_phone, entry.guest_name, entry.party_size), '_blank', 'noopener,noreferrer');
    void loadData();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('restaurant_waitlist').update({ status: 'cancelled' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    void loadData();
  };

  const handleNoShow = async (id: string) => {
    const { error } = await supabase.from('restaurant_waitlist').update({ status: 'no_show' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('waitlist.updateError', 'Failed to update waitlist entry')); return; }
    void loadData();
  };

  const handleConfirmSeat = async () => {
    if (!seatingEntry || !seatTargetTableId) return;
    setSeating(true);
    try {
      const { error } = await supabase.rpc('fn_seat_waitlist_party', {
        p_waitlist_id: seatingEntry.id,
        p_target_table_id: seatTargetTableId,
      });
      if (error) { toast.error(t('waitlist.seatError', 'Failed to seat party')); return; }
      toast.success(t('waitlist.seated', 'Party seated'));
      setSeatingEntry(null);
      setSeatTargetTableId('');
      void loadData();
    } finally {
      setSeating(false);
    }
  };

  return (
    <Layout>
      <RoleGate action="make_sales">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-bold text-white">
              <Users className="h-5 w-5" />
              {t('waitlist.title', 'Waitlist')}
            </h1>
            <button
              onClick={() => { setForm(EMPTY_FORM); setAddModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t('waitlist.addButton', 'Add to Waitlist')}
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5">
              <Users className="h-8 w-8 text-white/20" />
              <p className="text-sm text-white/30">{t('waitlist.empty', 'No one waiting')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  data-testid="waitlist-row"
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{entry.guest_name}</h3>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                        {formatElapsed(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">
                      {entry.guest_phone} · {entry.party_size} {t('waitlist.guests', 'guests')}
                    </p>
                    {entry.notes && <p className="mt-1 text-xs italic text-amber-400/70">{entry.notes}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {entry.status === 'waiting' && (
                      <button
                        onClick={() => { void handleNotify(entry); }}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-600/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/30"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {t('waitlist.notify', 'Notify')}
                      </button>
                    )}
                    <button
                      onClick={() => { setSeatingEntry(entry); setSeatTargetTableId(''); }}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Armchair className="h-3 w-3" />
                      {t('waitlist.seat', 'Seat')}
                    </button>
                    {entry.status === 'notified' && (
                      <button
                        onClick={() => { void handleNoShow(entry.id); }}
                        className="rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/5"
                      >
                        {t('waitlist.noShow', 'No-show')}
                      </button>
                    )}
                    <button
                      onClick={() => { void handleCancel(entry.id); }}
                      className="rounded-xl border border-white/10 p-1.5 text-white/20 hover:border-red-500/30 hover:text-red-400"
                      aria-label={`Cancel waitlist entry for ${entry.guest_name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setAddModalOpen(false); }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{t('waitlist.addButton', 'Add to Waitlist')}</h2>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="waitlist-guest-name" className="mb-1 block text-xs text-white/50">{t('waitlist.guestName', 'Guest Name')} *</label>
                  <input
                    id="waitlist-guest-name"
                    type="text"
                    value={form.guest_name}
                    onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-guest-phone" className="mb-1 block text-xs text-white/50">{t('waitlist.guestPhone', 'Phone (WhatsApp)')} *</label>
                  <input
                    id="waitlist-guest-phone"
                    type="tel"
                    value={form.guest_phone}
                    onChange={(e) => setForm((p) => ({ ...p, guest_phone: e.target.value }))}
                    placeholder="+961 3 XXX XXX"
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-party-size" className="mb-1 block text-xs text-white/50">{t('waitlist.partySize', 'Party Size')}</label>
                  <input
                    id="waitlist-party-size"
                    type="number"
                    min={1}
                    max={50}
                    value={form.party_size}
                    onChange={(e) => setForm((p) => ({ ...p, party_size: parseInt(e.target.value) || 2 }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="waitlist-notes" className="mb-1 block text-xs text-white/50">{t('waitlist.notes', 'Notes (optional)')}</label>
                  <textarea
                    id="waitlist-notes"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { void handleCreate(); }}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? t('common.saving', 'Saving…') : t('waitlist.add', 'Add')}
                  </button>
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {seatingEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSeatingEntry(null); }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {t('waitlist.seatPartyTitle', 'Seat')} {seatingEntry.guest_name}
                </h2>
                <button onClick={() => setSeatingEntry(null)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {availableTables.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-white/40">
                  <XCircle className="h-4 w-4" />
                  {t('waitlist.noAvailableTables', 'No available tables')}
                </p>
              ) : (
                <div className="space-y-2">
                  {availableTables.map((tbl) => (
                    <button
                      key={tbl.id}
                      onClick={() => setSeatTargetTableId(tbl.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                        seatTargetTableId === tbl.id
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {t('restaurant.tableNum', 'Table')} {tbl.number} ({tbl.seats}p)
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { void handleConfirmSeat(); }}
                disabled={seating || !seatTargetTableId}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('waitlist.confirmSeat', 'Confirm Seat')}
              </button>
            </div>
          </div>
        )}
      </RoleGate>
    </Layout>
  );
}
