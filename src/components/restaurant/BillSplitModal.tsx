/**
 * BillSplitModal — 3-mode bill splitting for restaurant tables
 *
 * Mode 1 — Equal Split: divide total evenly between N people
 * Mode 2 — By Seat: divide evenly by seat count
 * Mode 3 — By Item: assign individual items to specific people
 *
 * Persists via saveBillSplit then calls onConfirm.
 */

import { X, Users, ShoppingBag } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import type {
  RestaurantOrderItem,
  BillSplitPart,
  SplitType,
} from '@/types/restaurant';

// ── Local BillTotals type (mirrors useRestaurantOrder's internal interface) ───

interface BillTotals {
  subtotal: number;
  service_charge: number;
  vat: number;
  tip: number;
  discount: number;
  total: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number;
  items: RestaurantOrderItem[];
  totals: BillTotals;
  splitEqual: (count: number) => BillSplitPart[];
  splitBySeat: (seatCount: number) => BillSplitPart[];
  splitByItem: (assignments: Record<string, string[]>) => BillSplitPart[];
  saveBillSplit: (splitType: SplitType, splits: BillSplitPart[]) => Promise<void>;
  onConfirm: () => void;
}

// ── Stepper ────────────────────────────────────────────────────────────────────

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}

function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm text-white/60">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="w-8 text-center text-base font-black text-white">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Split Part Card ────────────────────────────────────────────────────────────

function SplitCard({ part }: { part: BillSplitPart }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-white/50">{part.label}</p>
      <p className="text-lg font-black text-white">${part.total.toFixed(2)}</p>
      <p className="text-[10px] text-white/40">
        Subtotal ${part.subtotal.toFixed(2)} · SC ${part.service_charge.toFixed(2)} · VAT ${part.tax.toFixed(2)}
      </p>
    </div>
  );
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type SplitTab = 'equal' | 'by_seat' | 'by_item';

// ── Main Modal ────────────────────────────────────────────────────────────────

export function BillSplitModal({
  isOpen,
  onClose,
  tableNumber,
  items,
  totals,
  splitEqual,
  splitBySeat,
  splitByItem,
  saveBillSplit,
  onConfirm,
}: BillSplitModalProps) {
  const [activeTab, setActiveTab] = useState<SplitTab>('equal');
  const [equalCount, setEqualCount] = useState(2);
  const [seatCount, setSeatCount] = useState(2);
  const [byItemPeople, setByItemPeople] = useState(2);
  // assignments: personLabel → itemIds[]
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus panel on open for keyboard a11y
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => panelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Derived previews ─────────────────────────────────────────────────────

  const equalSplits = splitEqual(equalCount);
  const seatSplits = splitBySeat(seatCount);

  // Build by-item person labels
  const personLabels = Array.from(
    { length: byItemPeople },
    (_, i) => `Person ${i + 1}`,
  );

  // Compute by-item assignments as Record<personLabel, itemIds[]>
  const byItemSplits = splitByItem(assignments);

  // Items not yet assigned
  const assignedItemIds = new Set(Object.values(assignments).flat());
  const unassignedItems = items.filter((i) => !assignedItemIds.has(i.id));

  const getItemAssignment = (itemId: string): string => {
    for (const [label, ids] of Object.entries(assignments)) {
      if (ids.includes(itemId)) return label;
    }
    return '';
  };

  const handleAssign = (itemId: string, personLabel: string) => {
    setAssignments((prev) => {
      // Remove from any existing assignment
      const next: Record<string, string[]> = {};
      for (const [lbl, ids] of Object.entries(prev)) {
        next[lbl] = ids.filter((id) => id !== itemId);
      }
      if (!personLabel) return next;
      // Add to target person
      const existing = next[personLabel] ?? [];
      next[personLabel] = [...existing, itemId];
      return next;
    });
  };

  // ── Confirm handlers ─────────────────────────────────────────────────────

  const handleConfirmEqual = async () => {
    setSaving(true);
    try {
      await saveBillSplit('equal', equalSplits);
      onConfirm();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSeat = async () => {
    setSaving(true);
    try {
      await saveBillSplit('by_seat', seatSplits);
      onConfirm();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmByItem = async () => {
    setSaving(true);
    try {
      // Ensure all people appear even if they have no items yet
      const allPeopleSplits: BillSplitPart[] = personLabels.map((label) => {
        const existing = byItemSplits.find((s) => s.label === label);
        return existing ?? {
          label,
          items: [],
          subtotal: 0,
          tax: 0,
          service_charge: 0,
          total: 0,
        };
      });
      await saveBillSplit('by_item', allPeopleSplits);
      onConfirm();
    } finally {
      setSaving(false);
    }
  };

  // ── Tabs config ──────────────────────────────────────────────────────────

  const tabs: Array<{ key: SplitTab; label: string; icon: typeof Users }> = [
    { key: 'equal', label: 'Equal', icon: Users },
    { key: 'by_seat', label: 'By Seat', icon: Users },
    { key: 'by_item', label: 'By Item', icon: ShoppingBag },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Split bill for Table ${tableNumber}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="mx-4 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 outline-none"
      >
        {/* Header */}
        <div className="flex-none border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Split Bill</h2>
              <p className="text-xs text-white/40">
                Table {tableNumber} · Total ${totals.total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="mt-4 flex rounded-xl border border-white/10 bg-white/5 p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === key
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Equal Split ─────────────────────────────────────────────── */}
          {activeTab === 'equal' && (
            <div className="space-y-4">
              <Stepper
                value={equalCount}
                min={2}
                max={20}
                onChange={setEqualCount}
                label="Split between people"
              />
              <div className="grid grid-cols-2 gap-2">
                {equalSplits.map((part) => (
                  <SplitCard key={part.label} part={part} />
                ))}
              </div>
            </div>
          )}

          {/* ── By Seat ─────────────────────────────────────────────────── */}
          {activeTab === 'by_seat' && (
            <div className="space-y-4">
              <Stepper
                value={seatCount}
                min={1}
                max={20}
                onChange={setSeatCount}
                label="Number of seats"
              />
              <div className="grid grid-cols-2 gap-2">
                {seatSplits.map((part) => (
                  <SplitCard key={part.label} part={part} />
                ))}
              </div>
            </div>
          )}

          {/* ── By Item ─────────────────────────────────────────────────── */}
          {activeTab === 'by_item' && (
            <div className="space-y-5">
              <Stepper
                value={byItemPeople}
                min={2}
                max={8}
                onChange={setByItemPeople}
                label="Number of people"
              />

              {/* Item assignment list */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  Assign Items
                </p>
                {items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-white/30">No items on this order</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const assigned = getItemAssignment(item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {item.quantity}× {item.product_name}
                            </p>
                            <p className="text-xs text-white/40">
                              ${(item.unit_price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <select
                            value={assigned}
                            onChange={(e) => handleAssign(item.id, e.target.value)}
                            className="rounded-xl border border-white/20 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                            aria-label={`Assign ${item.product_name} to person`}
                          >
                            <option value="">Unassigned</option>
                            {personLabels.map((lbl) => (
                              <option key={lbl} value={lbl}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unassigned warning */}
              {unassignedItems.length > 0 && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  {unassignedItems.length} item{unassignedItems.length > 1 ? 's' : ''} not yet assigned
                </p>
              )}

              {/* Preview per person */}
              {byItemSplits.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                    Preview
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {personLabels.map((label) => {
                      const part = byItemSplits.find((s) => s.label === label);
                      const displayPart: BillSplitPart = part ?? {
                        label,
                        items: [],
                        subtotal: 0,
                        tax: 0,
                        service_charge: 0,
                        total: 0,
                      };
                      return <SplitCard key={label} part={displayPart} />;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Confirm button */}
        <div className="flex-none border-t border-white/10 p-5">
          <button
            onClick={() => {
              if (activeTab === 'equal') void handleConfirmEqual();
              else if (activeTab === 'by_seat') void handleConfirmSeat();
              else void handleConfirmByItem();
            }}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm Split'}
          </button>
        </div>
      </div>
    </div>
  );
}
