import { ArrowUpRight, CalendarClock, ReceiptText, Users2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';
import { formatCurrency } from '@/utils/formatting';

interface PendingPayroll {
  id: string;
  employee_name: string;
  net_salary: number;
  period_end: string;
}

// Lebanese VAT filing is quarterly, due the 20th of the month after each
// quarter ends — approximate, not confirmed against current BDL/Finance
// Ministry guidance; flagged as an assumption, not a verified fact.
function nextVatDeadline(): string {
  const now = new Date();
  const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)
  const year = now.getFullYear();
  for (const m of quarterEndMonths) {
    const deadline = new Date(year, m + 1, 20);
    if (deadline >= now) {
      return deadline.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    }
  }
  return new Date(year + 1, 1, 20).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

/**
 * Track 2, Phase B prototype (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * see StockkeeperHomeHub.tsx's header comment — same prototype purpose.
 * Deliberately composed differently (one queue + two static info cards,
 * vs. Stockkeeper's two queues) rather than forcing an identical layout,
 * since an accountant's real day-to-day doesn't produce two comparable
 * one-tap queues the way inventory does.
 */
export default function AccountantHomeHub() {
  const { currentTenant } = useApp();
  const [pendingPayroll, setPendingPayroll] = useState<PendingPayroll[]>([]);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [payrollRes, expensesRes, uncategorizedRes] = await Promise.all([
        supabase
          .from('payroll_entries')
          .select('id, employee_name, net_salary, period_end')
          .eq('tenant_id', currentTenant.id)
          .eq('payment_status', 'pending')
          .order('period_end', { ascending: true })
          .limit(8),
        supabase
          .from('expenses')
          .select('amount_usd')
          .eq('tenant_id', currentTenant.id)
          .gte('expense_date', monthStartStr),
        supabase
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .is('category_id', null),
      ]);

      setPendingPayroll((payrollRes.data ?? []) as PendingPayroll[]);
      const total = ((expensesRes.data ?? []) as Array<{ amount_usd: number }>)
        .reduce((sum, e) => sum + (e.amount_usd ?? 0), 0);
      setMonthExpenses(total);
      setUncategorizedCount(uncategorizedRes.count ?? 0);
    } catch (err) {
      toast.error('Failed to load accountant hub', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => { void load(); }, [load]);

  const handleMarkPaid = useCallback(async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('payroll_entries')
        .update({ payment_status: 'paid', payment_date: new Date().toISOString().slice(0, 10) })
        .eq('id', entryId);
      if (error) throw error;
      toast.success('Payroll entry marked paid');
      await load();
    } catch (err) {
      toast.error('Failed to mark paid', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [load]);

  const payrollItems: ActionQueueItem[] = pendingPayroll.map((p) => ({
    id: p.id,
    title: p.employee_name,
    subtitle: `Period ended ${p.period_end}`,
    meta: formatCurrency(p.net_salary),
    actionLabel: 'Mark Paid',
    onAction: () => handleMarkPaid(p.id),
  }));

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: RESTAURANT_COLORS.textPrimary }}>Accountant</h1>
          <p className="text-sm" style={{ color: RESTAURANT_COLORS.textMuted }}>{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlanceKpiWidget
            label="This month's expenses"
            value={formatCurrency(monthExpenses)}
            icon={<Wallet className="h-4 w-4" />}
            accent="#f59e0b"
          />
          <GlanceKpiWidget
            label="Next VAT filing"
            value={nextVatDeadline()}
            icon={<CalendarClock className="h-4 w-4" />}
            accent="#8b5cf6"
          />
        </div>

        <ActionQueueWidget
          title="Payroll Pending Payment"
          icon={<Users2 className="h-4 w-4" />}
          accent="#0ea5e9"
          items={payrollItems}
          emptyLabel="No payroll entries pending payment"
          loading={loading}
        />

        {uncategorizedCount > 0 && (
          <Link
            to="/finance"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-white/5"
            style={{ background: RESTAURANT_COLORS.surface, borderColor: RESTAURANT_COLORS.border }}
          >
            <ReceiptText className="h-5 w-5 shrink-0" style={{ color: '#f59e0b' }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: RESTAURANT_COLORS.textPrimary }}>
                {uncategorizedCount} expense{uncategorizedCount === 1 ? '' : 's'} need{uncategorizedCount === 1 ? 's' : ''} a category
              </p>
              <p className="text-xs" style={{ color: RESTAURANT_COLORS.textTertiary }}>Review in Finance to keep reports accurate</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0" style={{ color: RESTAURANT_COLORS.textMuted }} />
          </Link>
        )}

        <Link
          to="/finance"
          className="flex items-center justify-between rounded-2xl border p-4 transition-colors hover:bg-white/5"
          style={{ borderColor: RESTAURANT_COLORS.border }}
        >
          <span className="text-sm font-medium" style={{ color: RESTAURANT_COLORS.textSecondary }}>
            Open full Finance
          </span>
          <ArrowUpRight className="h-4 w-4" style={{ color: RESTAURANT_COLORS.textMuted }} />
        </Link>
      </div>
    </Layout>
  );
}
