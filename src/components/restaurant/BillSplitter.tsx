/**
 * BillSplitter — Three-mode split bill component
 * Modes: equal | by_seat | by_item
 */
import { Users, Armchair, Tag, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BillSplitPart, RestaurantOrderItem, SplitType } from '@/types/restaurant';

interface BillSplitterProps {
  items: RestaurantOrderItem[];
  splits: BillSplitPart[];
  splitType: SplitType;
  seatCount: number;
  onSplitTypeChange: (type: SplitType) => void;
  onEqualCountChange: (count: number) => void;
  equalCount: number;
  onByItemAssign: (assignments: Record<string, string[]>) => void;
  onPrint: (split: BillSplitPart) => void;
  /** USD to LBP exchange rate for dual-currency display */
  lbpRate?: number;
}

const LBP_RATE_DEFAULT = 89500;

export default function BillSplitter({
  items,
  splits,
  splitType,
  seatCount,
  onSplitTypeChange,
  onEqualCountChange,
  equalCount,
  onByItemAssign,
  onPrint,
  lbpRate = LBP_RATE_DEFAULT,
}: BillSplitterProps) {
  const { t } = useTranslation();
  const [expandedSplit, setExpandedSplit] = useState<number | null>(null);
  // For by_item mode: assignments map: personLabel → itemId[]
  const [byItemPersons, setByItemPersons] = useState<string[]>(['Person A', 'Person B']);
  const [itemAssignments, setItemAssignments] = useState<Record<string, string[]>>({});

  const formatUSD = (v: number) => `$${v.toFixed(2)}`;
  const formatLBP = (v: number) => `${Math.round(v * lbpRate).toLocaleString()} L.L.`;

  const toggleItemAssignment = (itemId: string, person: string) => {
    setItemAssignments((prev) => {
      const existing = prev[person] ?? [];
      const updated = existing.includes(itemId)
        ? existing.filter((id) => id !== itemId)
        : [...existing, itemId];
      const next = { ...prev, [person]: updated };
      onByItemAssign(next);
      return next;
    });
  };

  const addPerson = () => {
    const next = `Person ${String.fromCharCode(65 + byItemPersons.length)}`;
    setByItemPersons((prev) => [...prev, next]);
  };

  const modes: Array<{ key: SplitType; label: string; icon: typeof Users }> = [
    { key: 'equal', label: t('restaurant.split.equal', 'Equal'), icon: Users },
    { key: 'by_seat', label: t('restaurant.split.bySeat', 'By Seat'), icon: Armchair },
    { key: 'by_item', label: t('restaurant.split.byItem', 'By Item'), icon: Tag },
  ];

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-1.5 rounded-2xl bg-white/5 p-1">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSplitTypeChange(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
              splitType === key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Equal split */}
      {splitType === 'equal' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60">{t('restaurant.split.between', 'Split between')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <button
                onClick={() => onEqualCountChange(Math.max(2, equalCount - 1))}
                className="text-white/60 hover:text-white transition-colors text-lg leading-none"
                aria-label="Decrease split count"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-bold text-white">{equalCount}</span>
              <button
                onClick={() => onEqualCountChange(Math.min(20, equalCount + 1))}
                className="text-white/60 hover:text-white transition-colors text-lg leading-none"
                aria-label="Increase split count"
              >
                +
              </button>
            </div>
            <span className="text-sm text-white/60">{t('restaurant.split.people', 'people')}</span>
          </div>

          <div className="grid gap-2">
            {splits.map((split, i) => (
              <SplitCard
                key={i}
                split={split}
                index={i}
                expanded={expandedSplit === i}
                onToggle={() => setExpandedSplit(expandedSplit === i ? null : i)}
                onPrint={() => onPrint(split)}
                formatUSD={formatUSD}
                formatLBP={formatLBP}
              />
            ))}
          </div>
        </div>
      )}

      {/* By seat */}
      {splitType === 'by_seat' && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">
            {t('restaurant.split.bySeatDesc', `Splitting equally by ${seatCount} seat${seatCount !== 1 ? 's' : ''}`)}
          </p>
          <div className="grid gap-2">
            {splits.map((split, i) => (
              <SplitCard
                key={i}
                split={split}
                index={i}
                expanded={expandedSplit === i}
                onToggle={() => setExpandedSplit(expandedSplit === i ? null : i)}
                onPrint={() => onPrint(split)}
                formatUSD={formatUSD}
                formatLBP={formatLBP}
              />
            ))}
          </div>
        </div>
      )}

      {/* By item */}
      {splitType === 'by_item' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">{t('restaurant.split.assignItems', 'Assign items to each person')}</span>
            <button
              onClick={addPerson}
              className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-all"
            >
              + {t('restaurant.split.addPerson', 'Add Person')}
            </button>
          </div>

          {/* Item assignment grid */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-white/10 bg-white/5 px-3 py-2" style={{ gridTemplateColumns: `1fr repeat(${byItemPersons.length}, 44px)` }}>
              <span className="text-xs text-white/40">{t('restaurant.split.item', 'Item')}</span>
              {byItemPersons.map((p, i) => (
                <span key={i} className="text-center text-[10px] font-semibold text-indigo-400">{p.replace('Person ', '')}</span>
              ))}
            </div>
            {/* Items */}
            {items.map((item) => (
              <div
                key={item.id}
                className="grid items-center border-b border-white/5 px-3 py-2 last:border-0"
                style={{ gridTemplateColumns: `1fr repeat(${byItemPersons.length}, 44px)` }}
              >
                <div>
                  <span className="text-xs text-white">{item.quantity}× {item.product_name}</span>
                  <span className="ml-2 text-xs text-white/40">${(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
                {byItemPersons.map((person, pi) => {
                  const assigned = (itemAssignments[person] ?? []).includes(item.id);
                  return (
                    <div key={pi} className="flex justify-center">
                      <button
                        onClick={() => toggleItemAssignment(item.id, person)}
                        aria-label={`Assign ${item.product_name} to ${person}`}
                        className={`h-6 w-6 rounded-md border-2 transition-all flex items-center justify-center ${
                          assigned
                            ? 'border-indigo-500 bg-indigo-500/30 text-indigo-400'
                            : 'border-white/20 bg-white/5 text-transparent hover:border-indigo-400'
                        }`}
                      >
                        <span className="text-xs font-bold">✓</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Per-person splits */}
          <div className="grid gap-2">
            {splits.map((split, i) => (
              <SplitCard
                key={i}
                split={split}
                index={i}
                expanded={expandedSplit === i}
                onToggle={() => setExpandedSplit(expandedSplit === i ? null : i)}
                onPrint={() => onPrint(split)}
                formatUSD={formatUSD}
                formatLBP={formatLBP}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SplitCardProps {
  split: BillSplitPart;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onPrint: () => void;
  formatUSD: (v: number) => string;
  formatLBP: (v: number) => string;
}

function SplitCard({ split, expanded, onToggle, onPrint, formatUSD, formatLBP }: SplitCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20">
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-start">
            <p className="text-sm font-semibold text-white">{split.label}</p>
            <p className="text-xs text-white/40">{formatLBP(split.total)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{formatUSD(split.total)}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{t('restaurant.bill.subtotal', 'Subtotal')}</span>
            <span className="text-white">{formatUSD(split.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{t('restaurant.bill.serviceCharge', 'Service Charge')}</span>
            <span className="text-white">{formatUSD(split.service_charge)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{t('restaurant.bill.vat', 'VAT (11%)')}</span>
            <span className="text-white">{formatUSD(split.tax)}</span>
          </div>
          <div className="my-1 border-t border-white/10" />
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-white">{t('restaurant.bill.total', 'Total')}</span>
            <div className="text-end">
              <p className="text-white">{formatUSD(split.total)}</p>
              <p className="text-[10px] text-white/40">{formatLBP(split.total)}</p>
            </div>
          </div>
          <button
            onClick={onPrint}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            {t('restaurant.bill.print', 'Print Receipt')}
          </button>
        </div>
      )}
    </div>
  );
}
