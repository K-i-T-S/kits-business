import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Split } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import type { RestaurantTable, TableOrder, RestaurantOrderItem } from '@/types/restaurant';

interface SplitTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  sourceTable: RestaurantTable;
  sourceOrder: TableOrder;
  sourceOrderItems: RestaurantOrderItem[];
  tables: RestaurantTable[];
}

interface SelectionGroup {
  key: string;
  label: string;
  itemIds: string[];
}

// Known error codes raised by fn_split_table_order (see Task 1's migration),
// pattern-matched against the plain exception-message string PostgREST
// returns, same convention QRCart.tsx's mapPlaceOrderError uses.
function mapSplitError(err: unknown, t: (key: string, defaultValue: string) => string): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('bundle_split_not_allowed')) {
    return t('restaurant.splitBundleNotAllowed', 'Bundle items must move together.');
  }
  if (message.includes('split_would_empty_source_order')) {
    return t('restaurant.splitWouldEmptySource', 'Select fewer items — at least one must stay on this table.');
  }
  if (message.includes('target_table_occupied')) {
    return t('restaurant.splitTargetOccupied', 'That table is no longer available.');
  }
  return t('restaurant.splitError', 'Failed to split table');
}

export default function SplitTableModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId: _tenantId,
  sourceTable,
  sourceOrder,
  sourceOrderItems,
  tables,
}: SplitTableModalProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetTableId, setTargetTableId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo<SelectionGroup[]>(() => {
    const bundleGroups = new Map<string, RestaurantOrderItem[]>();
    const result: SelectionGroup[] = [];

    for (const item of sourceOrderItems) {
      if (item.bundle_id) {
        const existing = bundleGroups.get(item.bundle_id);
        if (existing) {
          existing.push(item);
        } else {
          bundleGroups.set(item.bundle_id, [item]);
        }
      } else {
        result.push({ key: item.id, label: item.product_name, itemIds: [item.id] });
      }
    }

    for (const [bundleId, items] of bundleGroups) {
      result.push({
        key: bundleId,
        label: items[0]?.product_name ?? bundleId,
        itemIds: items.map((i) => i.id),
      });
    }

    return result;
  }, [sourceOrderItems]);

  const availableTables = tables.filter((tbl) => tbl.status === 'available');

  if (!isOpen) return null;

  const toggleGroup = (group: SelectionGroup) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const groupSelected = group.itemIds.every((id) => next.has(id));
      if (groupSelected) {
        for (const id of group.itemIds) next.delete(id);
      } else {
        for (const id of group.itemIds) next.add(id);
      }
      return next;
    });
  };

  const wouldEmptySource = selectedIds.size > 0 && selectedIds.size === sourceOrderItems.length;
  const submitDisabled = submitting || selectedIds.size === 0 || targetTableId === '' || wouldEmptySource;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('fn_split_table_order', {
        p_source_order_id: sourceOrder.id,
        p_target_table_id: targetTableId,
        p_item_ids: Array.from(selectedIds),
      });
      if (error) throw new Error(error.message);

      toast.success(t('restaurant.splitSuccess', 'Table split'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[SplitTableModal] split error:', err);
      toast.error(mapSplitError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Split className="h-5 w-5 text-indigo-400" />
            {t('restaurant.splitTable', 'Split Table')} (#{sourceTable.number})
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t('restaurant.itemsToSplit', 'Items to move')}
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {groups.map((group) => {
                const checked = group.itemIds.every((id) => selectedIds.has(id));
                return (
                  <label
                    key={group.key}
                    htmlFor={`split-item-${group.key}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/10"
                  >
                    <input
                      id={`split-item-${group.key}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(group)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-800"
                    />
                    {group.label}
                  </label>
                );
              })}
            </div>
            {wouldEmptySource && (
              <p className="mt-1.5 text-xs text-amber-400">
                {t('restaurant.splitWouldEmptySource', 'Select fewer items — at least one must stay on this table.')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="split-target-table" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t('restaurant.targetTable', 'Target table')}
            </label>
            <select
              id="split-target-table"
              aria-label="Target table"
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2"
            >
              <option value="">{t('restaurant.selectTable', 'Select a table')}</option>
              {availableTables.map((tbl) => (
                <option key={tbl.id} value={tbl.id}>
                  {t('restaurant.tableNum', 'Table')} {tbl.number}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => { void handleSubmit(); }}
            disabled={submitDisabled}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t('restaurant.confirmSplit', 'Split Table')}
          </button>
        </div>
      </div>
    </div>
  );
}
