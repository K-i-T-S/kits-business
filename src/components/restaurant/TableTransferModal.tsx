import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, ArrowLeftRight, AlertTriangle } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import type { RestaurantTable, TableOrder } from '@/types/restaurant';
import type { Employee } from '@/context/AppContext';

const OPEN_STATUSES = ['open', 'sent', 'served'];

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  sourceTable: RestaurantTable;
  sourceOrder: TableOrder;
  sourceOrderItemCount: number;
  currentWaiterId: string | null;
  tables: RestaurantTable[];
  orders: TableOrder[];
  employees: Employee[];
}

export default function TableTransferModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  sourceTable,
  sourceOrder,
  sourceOrderItemCount,
  currentWaiterId,
  tables,
  orders,
  employees,
}: TableTransferModalProps) {
  const { t } = useTranslation();
  const [targetTableId, setTargetTableId] = useState('');
  const [waiterId, setWaiterId] = useState(currentWaiterId ?? '');
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const candidateTables = tables.filter((tbl) => tbl.id !== sourceTable.id);
  const isTableMove = targetTableId !== '';
  const targetOrder = isTableMove
    ? orders.find((o) => o.table_id === targetTableId && OPEN_STATUSES.includes(o.status))
    : undefined;
  const isMerge = Boolean(targetOrder);
  const noChangeSelected = !isTableMove && waiterId === (currentWaiterId ?? '');
  const targetTableNumber = tables.find((tbl) => tbl.id === targetTableId)?.number ?? '';

  const performTransfer = async () => {
    setSubmitting(true);
    try {
      if (isTableMove) {
        const { error } = await supabase.rpc('fn_transfer_table_order', {
          p_order_id: sourceOrder.id,
          p_target_table_id: targetTableId,
          p_new_waiter_id: waiterId || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('table_orders')
          .update({ waiter_id: waiterId || null })
          .eq('id', sourceOrder.id)
          .eq('tenant_id', tenantId);
        if (error) throw error;
      }
      toast.success(t('restaurant.transferSuccess', 'Order transferred'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[TableTransferModal] transfer error:', err);
      toast.error(t('restaurant.transferError', 'Failed to transfer order'));
    } finally {
      setSubmitting(false);
      setConfirmingMerge(false);
    }
  };

  const handleSubmit = () => {
    if (isMerge && !confirmingMerge) {
      setConfirmingMerge(true);
      return;
    }
    void performTransfer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ArrowLeftRight className="h-5 w-5 text-indigo-400" />
            {t('restaurant.transferOrder', 'Transfer Order')}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmingMerge ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
              <span>
                {t(
                  'restaurant.mergeWarning',
                  `This will combine ${sourceOrderItemCount} item${sourceOrderItemCount === 1 ? '' : 's'} from Table ${sourceTable.number} into Table ${targetTableNumber}'s bill. This cannot be undone.`,
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingMerge(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => { void performTransfer(); }}
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {t('restaurant.combineBills', 'Combine Bills')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="transfer-target-table" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
                {t('restaurant.targetTable', 'Move to table')}
              </label>
              <select
                id="transfer-target-table"
                aria-label="Move to table"
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2"
              >
                <option value="">{t('restaurant.keepCurrentTable', 'Keep current table (waiter only)')}</option>
                {candidateTables.map((tbl) => {
                  const occupied = orders.some(
                    (o) => o.table_id === tbl.id && OPEN_STATUSES.includes(o.status),
                  );
                  return (
                    <option key={tbl.id} value={tbl.id}>
                      {t('restaurant.tableNum', 'Table')} {tbl.number}
                      {occupied ? ` (${t('restaurant.willMerge', 'will merge orders')})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="transfer-waiter" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">
                {t('restaurant.reassignWaiter', 'Waiter')}
              </label>
              <select
                id="transfer-waiter"
                aria-label="Waiter"
                value={waiterId}
                onChange={(e) => setWaiterId(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-white/20 text-white px-3 py-2"
              >
                <option value="">{t('restaurant.noWaiterChange', 'No change')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || noChangeSelected}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isMerge
                ? t('restaurant.reviewMerge', 'Review Merge')
                : t('restaurant.confirmTransfer', 'Confirm Transfer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
