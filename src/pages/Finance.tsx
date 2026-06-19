import { format, addDays, addWeeks, addMonths, addQuarters, addYears, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Download,
  FileText,
  Trash2,
  Edit2,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  ShieldOff,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import type { RoleType } from '@/types/subscription';
import { supabase } from '@/utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string;
  name: string;
  name_ar: string | null;
  type: string;
  is_cogs: boolean;
  is_system: boolean;
  sort_order: number;
}

interface Expense {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  currency: string;
  amount_usd: number;
  exchange_rate_used: number;
  expense_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  recurring_end_date: string | null;
  vendor: string | null;
  payment_method: string;
  vat_amount: number;
  is_vat_inclusive: boolean;
  notes: string | null;
  receipt_url: string | null;
}

interface ExpenseBudget {
  id: string;
  category_id: string | null;
  year: number;
  month: number;
  budgeted_amount_usd: number;
}

interface PayrollEntry {
  id: string;
  employee_id: string | null;
  employee_name: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  base_currency: string;
  transport_allowance: number;
  other_allowances: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  nssf_employee: number;
  nssf_employer: number;
  eos_accrual: number;
  gross_salary: number;
  net_salary: number;
  total_employer_cost: number;
  payment_status: string;
  payment_date: string | null;
  payment_method: string;
  notes: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6'];

const TYPE_LABELS: Record<string, string> = {
  cogs: 'Cost of Goods',
  labor: 'Labor',
  utilities: 'Utilities',
  facilities: 'Facilities',
  financial: 'Financial',
  marketing: 'Marketing',
  taxes: 'Taxes & Gov',
  professional: 'Professional',
  insurance: 'Insurance',
  technology: 'Technology',
  transport: 'Transport',
  other: 'Other',
};

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'check'];
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  check: 'Check',
};

const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'];
const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

// Roles allowed to access Finance
const FINANCE_ROLES: RoleType[] = ['owner', 'admin', 'accountant', 'supervisor', 'manager'];

// ── Helper functions ──────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function computeNextDue(expense: Expense): Date | null {
  if (!expense.is_recurring || !expense.recurring_frequency) return null;
  const base = parseISO(expense.expense_date);
  const today = new Date();
  let next = base;
  // Advance until next is in the future
  while (next <= today) {
    switch (expense.recurring_frequency) {
      case 'weekly': next = addWeeks(next, 1); break;
      case 'monthly': next = addMonths(next, 1); break;
      case 'quarterly': next = addQuarters(next, 1); break;
      case 'annual': next = addYears(next, 1); break;
      default: return null;
    }
  }
  return next;
}

function getMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') });
  }
  return opts;
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  sales: import('@/context/AppContext').Sale[];
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  monthOptions: { value: string; label: string }[];
}

function OverviewTab({ expenses, categories, sales, selectedMonth, setSelectedMonth, monthOptions }: OverviewTabProps) {
  const monthExpenses = useMemo(
    () => expenses.filter(e => {
      const d = e.expense_date.slice(0, 7);
      return d === selectedMonth;
    }),
    [expenses, selectedMonth],
  );

  const monthRevenue = useMemo(() => {
    return sales.filter(s => s.date.slice(0, 7) === selectedMonth).reduce((sum, s) => sum + (s.total ?? 0), 0);
  }, [sales, selectedMonth]);

  const totalExpenses = useMemo(() => monthExpenses.reduce((sum, e) => sum + e.amount_usd, 0), [monthExpenses]);

  const cogsExpenses = useMemo(() => {
    const cogsIds = new Set(categories.filter(c => c.is_cogs).map(c => c.id));
    return monthExpenses.filter(e => e.category_id && cogsIds.has(e.category_id)).reduce((sum, e) => sum + e.amount_usd, 0);
  }, [monthExpenses, categories]);

  const grossProfit = monthRevenue - cogsExpenses;
  const netProfit = monthRevenue - totalExpenses;

  // Pie chart data grouped by type
  const pieData = useMemo(() => {
    const typeMap = new Map<string, number>();
    for (const e of monthExpenses) {
      const cat = categories.find(c => c.id === e.category_id);
      const type = cat?.type ?? 'other';
      typeMap.set(type, (typeMap.get(type) ?? 0) + e.amount_usd);
    }
    return Array.from(typeMap.entries())
      .map(([type, value]) => ({ name: TYPE_LABELS[type] ?? type, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, categories]);

  // Bar chart: last 6 months revenue vs expenses
  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const mKey = format(d, 'yyyy-MM');
      const rev = sales.filter(s => s.date.slice(0, 7) === mKey).reduce((sum, s) => sum + (s.total ?? 0), 0);
      const exp = expenses.filter(e => e.expense_date.slice(0, 7) === mKey).reduce((sum, e) => sum + e.amount_usd, 0);
      return { month: format(d, 'MMM yy'), revenue: rev, expenses: exp };
    });
  }, [sales, expenses]);

  // Upcoming recurring expenses
  const upcomingRecurring = useMemo(() => {
    const cutoff = addDays(new Date(), 30);
    return expenses
      .filter(e => e.is_recurring)
      .map(e => ({ ...e, nextDue: computeNextDue(e) }))
      .filter(e => e.nextDue !== null && e.nextDue <= cutoff)
      .sort((a, b) => (a.nextDue?.getTime() ?? 0) - (b.nextDue?.getTime() ?? 0));
  }, [expenses]);

  const cards = [
    {
      label: 'Revenue',
      value: monthRevenue,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Total Expenses',
      value: totalExpenses,
      icon: TrendingDown,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'Gross Profit',
      value: grossProfit,
      icon: DollarSign,
      color: grossProfit >= 0 ? 'text-sky-400' : 'text-rose-400',
      bg: grossProfit >= 0 ? 'bg-sky-500/10 border-sky-500/20' : 'bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'Net Profit / Loss',
      value: netProfit,
      icon: DollarSign,
      color: netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
      bg: netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-white/60">Period:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`rounded-2xl border p-5 ${card.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{fmtUSD(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Expenses by Category Type</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-white/30 text-sm">No expense data for this month</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => fmtUSD(value)}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Expenses — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number) => fmtUSD(value)}
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming recurring */}
      {upcomingRecurring.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming Recurring Expenses (Next 30 Days)
          </h3>
          <div className="space-y-2">
            {upcomingRecurring.map(e => {
              const cat = categories.find(c => c.id === e.category_id);
              const daysAway = e.nextDue ? Math.ceil((e.nextDue.getTime() - Date.now()) / 86400000) : 0;
              return (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{e.description}</p>
                    <p className="text-xs text-white/40">{cat?.name ?? 'Uncategorised'} · {FREQUENCY_LABELS[e.recurring_frequency ?? ''] ?? e.recurring_frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-300">{fmtUSD(e.amount_usd)}</p>
                    <p className="text-xs text-white/40">In {daysAway}d — {e.nextDue ? format(e.nextDue, 'MMM d') : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Expenses ─────────────────────────────────────────────────────────────

interface ExpensesTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  currentTenant: import('@/context/AppContext').Tenant | null;
  onRefresh: () => void;
}

function ExpensesTab({ expenses, categories, currentTenant, onRefresh }: ExpensesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterDateFrom && e.expense_date < filterDateFrom) return false;
      if (filterDateTo && e.expense_date > filterDateTo) return false;
      if (filterCategory && e.category_id !== filterCategory) return false;
      if (filterPayment && e.payment_method !== filterPayment) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!e.description.toLowerCase().includes(q) && !(e.vendor ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filterDateFrom, filterDateTo, filterCategory, filterPayment, filterSearch]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Expense deleted');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleExportExcel() {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Expenses');
      ws.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Amount', key: 'amount', width: 12 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Amount USD', key: 'amount_usd', width: 14 },
        { header: 'Payment', key: 'payment', width: 16 },
        { header: 'Recurring', key: 'recurring', width: 10 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      for (const e of filtered) {
        const cat = categories.find(c => c.id === e.category_id);
        ws.addRow({
          date: e.expense_date,
          description: e.description,
          category: cat?.name ?? '',
          vendor: e.vendor ?? '',
          amount: e.amount,
          currency: e.currency,
          amount_usd: e.amount_usd,
          payment: PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method,
          recurring: e.is_recurring ? (e.recurring_frequency ?? 'yes') : 'no',
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exported');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search description / vendor..."
          value={filterSearch}
          onChange={e => { setFilterSearch(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm w-56 placeholder:text-white/30"
        />
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        />
        <span className="text-white/40 self-center">→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        />
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterPayment}
          onChange={e => { setFilterPayment(e.target.value); setPage(0); }}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All Payment Methods</option>
          {PAYMENT_METHODS.map(m => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </select>
        <div className="ms-auto flex gap-2">
          <button
            onClick={() => { void handleExportExcel(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => { setEditingExpense(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <PlusCircle className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Vendor</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Payment</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/40">Receipt</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-white/30">No expenses found</td>
              </tr>
            ) : paged.map(e => {
              const cat = categories.find(c => c.id === e.category_id);
              return (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white/60 whitespace-nowrap">{e.expense_date}</td>
                  <td className="px-4 py-3 text-white max-w-48">
                    <p className="truncate">{e.description}</p>
                    {e.is_recurring && (
                      <span className="text-xs text-amber-400">{FREQUENCY_LABELS[e.recurring_frequency ?? ''] ?? ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60">{cat?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60">{e.vendor ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-white">{fmtUSD(e.amount_usd)}</span>
                    {e.currency !== 'USD' && (
                      <span className="block text-xs text-white/40">{e.amount.toLocaleString()} {e.currency}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60">{PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method}</td>
                  <td className="px-4 py-3 text-center">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                        <Receipt className="h-4 w-4 mx-auto" />
                      </a>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditingExpense(e); setShowForm(true); }}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { void handleDelete(e.id); }}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-rose-500/20 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">{filtered.length} expenses · page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-white/20 bg-white/5 p-2 text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-white/20 bg-white/5 p-2 text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showForm && (
        <ExpenseFormModal
          expense={editingExpense}
          categories={categories}
          currentTenant={currentTenant}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Expense Form Modal ────────────────────────────────────────────────────────

interface ExpenseFormModalProps {
  expense: Expense | null;
  categories: ExpenseCategory[];
  currentTenant: import('@/context/AppContext').Tenant | null;
  onClose: () => void;
  onSaved: () => void;
}

function ExpenseFormModal({ expense, categories, currentTenant, onClose, onSaved }: ExpenseFormModalProps) {
  const exchangeRate = currentTenant?.exchange_rate ?? 89500;
  const taxRate = currentTenant?.tax_rate ?? 0.11;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '');
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(expense?.currency ?? 'USD');
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [vendor, setVendor] = useState(expense?.vendor ?? '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method ?? 'cash');
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring ?? false);
  const [recurringFrequency, setRecurringFrequency] = useState(expense?.recurring_frequency ?? 'monthly');
  const [recurringEndDate, setRecurringEndDate] = useState(expense?.recurring_end_date ?? '');
  const [isVatInclusive, setIsVatInclusive] = useState(expense?.is_vat_inclusive ?? false);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const amountUsd = currency === 'LBP' ? amountNum / exchangeRate : amountNum;
  const vatAmount = isVatInclusive ? amountUsd - amountUsd / (1 + taxRate) : amountUsd * taxRate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amountNum) {
      toast.error('Description and amount are required');
      return;
    }
    setSaving(true);
    try {
      let receiptUrl = expense?.receipt_url ?? null;

      // Upload receipt if provided
      if (receiptFile && currentTenant?.id) {
        const ext = receiptFile.name.split('.').pop() ?? 'jpg';
        const path = `${currentTenant.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('expense-receipts')
          .upload(path, receiptFile, { upsert: false });
        if (uploadError) {
          toast.error(`Receipt upload failed: ${uploadError.message}`);
        } else if (uploadData) {
          const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(uploadData.path);
          receiptUrl = urlData.publicUrl;
        }
      }

      const payload = {
        description: description.trim(),
        category_id: categoryId || null,
        amount: amountNum,
        currency,
        amount_usd: amountUsd,
        exchange_rate_used: currency === 'LBP' ? exchangeRate : 1,
        expense_date: expenseDate,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? recurringFrequency : null,
        recurring_end_date: isRecurring && recurringEndDate ? recurringEndDate : null,
        vendor: vendor.trim() || null,
        payment_method: paymentMethod,
        vat_amount: vatAmount,
        is_vat_inclusive: isVatInclusive,
        notes: notes.trim() || null,
        receipt_url: receiptUrl,
      };

      if (expense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id);
        if (error) throw error;
        toast.success('Expense updated');
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
        toast.success('Expense added');
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <form onSubmit={e => { void handleSubmit(e); }} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              >
                <option value="">— Select Category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                required
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Currency</label>
              <div className="flex gap-2">
                {['USD', 'LBP'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${currency === c ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-white/20 text-white/60 hover:text-white'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {amountNum > 0 && (
                <p className="mt-1 text-xs text-white/40">= {fmtUSD(amountUsd)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VAT */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={isVatInclusive}
                onChange={e => setIsVatInclusive(e.target.checked)}
                className="rounded"
              />
              VAT inclusive ({(taxRate * 100).toFixed(0)}%)
            </label>
            {amountNum > 0 && (
              <span className="ms-auto text-xs text-white/40">VAT: {fmtUSD(vatAmount)}</span>
            )}
          </div>

          {/* Recurring */}
          <div className="space-y-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="rounded"
              />
              Recurring expense
            </label>
            {isRecurring && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Frequency</label>
                  <select
                    value={recurringFrequency}
                    onChange={e => setRecurringFrequency(e.target.value)}
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  >
                    {RECURRING_FREQUENCIES.map(f => (
                      <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={recurringEndDate}
                    onChange={e => setRecurringEndDate(e.target.value)}
                    className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Receipt upload */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Receipt (image or PDF)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-white/60 file:me-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            {expense?.receipt_url && !receiptFile && (
              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-indigo-400 hover:underline block">View existing receipt</a>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/70 hover:bg-white/5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : expense ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab: Payroll ──────────────────────────────────────────────────────────────

interface PayrollTabProps {
  employees: import('@/context/AppContext').Employee[];
  currentTenant: import('@/context/AppContext').Tenant | null;
}

function PayrollTab({ employees, currentTenant }: PayrollTabProps) {
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Calculator state
  const [calcEmployeeId, setCalcEmployeeId] = useState('');
  const [calcBase, setCalcBase] = useState('');
  const [calcBaseCurrency, setCalcBaseCurrency] = useState('USD');
  const [calcTransport, setCalcTransport] = useState('');
  const [calcOtherAllowances, setCalcOtherAllowances] = useState('');
  const [calcOvertime, setCalcOvertime] = useState('');
  const [calcBonuses, setCalcBonuses] = useState('');
  const [calcDeductions, setCalcDeductions] = useState('');
  const [calcIncomeTax, setCalcIncomeTax] = useState('');
  const [adding, setAdding] = useState(false);

  const exchangeRate = currentTenant?.exchange_rate ?? 89500;

  const base = parseFloat(calcBase) || 0;
  const baseUsd = calcBaseCurrency === 'LBP' ? base / exchangeRate : base;
  const transport = parseFloat(calcTransport) || 0;
  const otherAllow = parseFloat(calcOtherAllowances) || 0;
  const overtime = parseFloat(calcOvertime) || 0;
  const bonuses = parseFloat(calcBonuses) || 0;
  const deductions = parseFloat(calcDeductions) || 0;
  const incomeTax = parseFloat(calcIncomeTax) || 0;

  const gross = baseUsd + transport + otherAllow + overtime + bonuses;
  const nssfEmployer = gross * 0.225;
  const eosAccrual = gross * 0.085;
  const nssfEmployee = Math.min(gross * 0.03, 40); // 3%, capped ~$40/mo
  const netSalary = gross - nssfEmployee - incomeTax - deductions;
  const totalEmployerCost = gross + nssfEmployer + eosAccrual;

  const [year, monthNum] = selectedMonth.split('-').map(Number) as [number, number];
  const periodStart = format(startOfMonth(new Date(year, monthNum - 1)), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(new Date(year, monthNum - 1)), 'yyyy-MM-dd');

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayroll((data ?? []) as PayrollEntry[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd]);

  useEffect(() => { void loadPayroll(); }, [loadPayroll]);

  async function handleAddPayroll() {
    const emp = employees.find(e => e.id === calcEmployeeId);
    if (!emp && !calcEmployeeId) {
      toast.error('Select an employee');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('payroll_entries').insert({
        employee_id: calcEmployeeId || null,
        employee_name: emp?.name ?? 'Unknown',
        period_start: periodStart,
        period_end: periodEnd,
        base_salary: baseUsd,
        base_currency: 'USD',
        transport_allowance: transport,
        other_allowances: otherAllow,
        overtime,
        bonuses,
        deductions,
        nssf_employee: nssfEmployee,
        nssf_employer: nssfEmployer,
        eos_accrual: eosAccrual,
        gross_salary: gross,
        net_salary: netSalary,
        total_employer_cost: totalEmployerCost,
        payment_status: 'pending',
        payment_method: 'cash',
      });
      if (error) throw error;
      toast.success('Payroll entry added');
      void loadPayroll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add payroll');
    } finally {
      setAdding(false);
    }
  }

  async function handleMarkPaid(id: string) {
    try {
      const { error } = await supabase.from('payroll_entries').update({
        payment_status: 'paid',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
      }).eq('id', id);
      if (error) throw error;
      toast.success('Marked as paid');
      void loadPayroll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handlePrintPayslip(entry: PayrollEntry) {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      let y = 20;

      // Header
      if (currentTenant?.brand_logo_url) {
        try {
          doc.addImage(currentTenant.brand_logo_url, 'PNG', margin, y, 20, 20);
        } catch (_) { /* logo load may fail */ }
      }
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(currentTenant?.name ?? 'Business', margin + 24, y + 8);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Payslip / كشف راتب', margin + 24, y + 16);
      y += 28;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Employee: ${entry.employee_name}`, margin, y);
      y += 6;
      doc.text(`Period: ${entry.period_start} to ${entry.period_end}`, margin, y);
      y += 10;

      // Table header
      const col1 = margin;
      const col2 = pageW - margin - 35;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('Description / الوصف', col1, y);
      doc.text('Amount (USD)', col2, y);
      y += 5;
      doc.line(margin, y, pageW - margin, y);
      y += 4;

      const rows: [string, number, boolean][] = [
        ['Basic Salary / الراتب الأساسي', entry.base_salary, false],
        ['Transport Allowance / بدل نقل', entry.transport_allowance, false],
        ['Other Allowances / بدلات أخرى', entry.other_allowances, false],
        ['Overtime / أوفرتايم', entry.overtime, false],
        ['Bonuses / مكافآت', entry.bonuses, false],
        ['Gross Salary / الراتب الإجمالي', entry.gross_salary, true],
        ['NSSF (Employee) / NSSF موظف (-)', -entry.nssf_employee, false],
        ['Deductions / خصومات (-)', -entry.deductions, false],
        ['NET SALARY / صافي الراتب', entry.net_salary, true],
      ];

      doc.setTextColor(30, 41, 59);
      for (const [label, value, bold] of rows) {
        if (y > 265) { doc.addPage(); y = 20; }
        if (bold) {
          doc.setFont('helvetica', 'bold');
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, y - 1, pageW - margin, y - 1);
        } else {
          doc.setFont('helvetica', 'normal');
        }
        doc.text(label, col1, y);
        const valStr = value < 0 ? `-${fmtUSD(Math.abs(value))}` : fmtUSD(value);
        doc.text(valStr, col2, y);
        y += 6;
      }

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 160, 180);
      doc.text('Employer Cost (incl. NSSF 22.5% + EOS 8.5%): ' + fmtUSD(entry.total_employer_cost), margin, y);
      y += 10;

      doc.setFontSize(7);
      doc.text('Powered by KiTS Business', pageW / 2, 287, { align: 'center' });

      const empSlug = entry.employee_name.replace(/\s+/g, '-').toLowerCase();
      const period = entry.period_start.slice(0, 7);
      doc.save(`payslip-${empSlug}-${period}.pdf`);
      toast.success('Payslip downloaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'PDF failed');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Payroll calculator sidebar */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 sticky top-4">
          <h3 className="text-sm font-semibold text-white">Payroll Calculator</h3>

          <div>
            <label className="block text-xs text-white/60 mb-1">Employee</label>
            <select
              value={calcEmployeeId}
              onChange={e => setCalcEmployeeId(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
            >
              <option value="">— Select Employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Period</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-white/60 mb-1">Base Salary</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calcBase}
                  onChange={e => setCalcBase(e.target.value)}
                  className="flex-1 bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  placeholder="0.00"
                />
                <select
                  value={calcBaseCurrency}
                  onChange={e => setCalcBaseCurrency(e.target.value)}
                  className="bg-slate-800 border border-white/20 text-white rounded-xl px-2 py-2 text-sm"
                >
                  <option>USD</option>
                  <option>LBP</option>
                </select>
              </div>
              {calcBaseCurrency === 'LBP' && baseUsd > 0 && (
                <p className="mt-1 text-xs text-white/40">= {fmtUSD(baseUsd)}</p>
              )}
            </div>
            {[
              { label: 'Transport Allowance', value: calcTransport, setter: setCalcTransport, hint: 'Note: Lebanese law min ~LBP 48,000/day' },
              { label: 'Other Allowances', value: calcOtherAllowances, setter: setCalcOtherAllowances },
              { label: 'Overtime', value: calcOvertime, setter: setCalcOvertime },
              { label: 'Bonuses', value: calcBonuses, setter: setCalcBonuses },
              { label: 'Deductions', value: calcDeductions, setter: setCalcDeductions },
              { label: 'Income Tax (manual)', value: calcIncomeTax, setter: setCalcIncomeTax },
            ].map(({ label, value, setter, hint }) => (
              <div key={label} className="col-span-2">
                <label className="block text-xs text-white/60 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
                  placeholder="0.00"
                />
                {hint && <p className="mt-0.5 text-xs text-amber-400/70">{hint}</p>}
              </div>
            ))}
          </div>

          {/* Computed breakdown */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5 text-xs">
            {[
              { label: 'Gross Salary', value: gross, bold: false },
              { label: 'NSSF Employer (22.5%)', value: nssfEmployer, sub: true },
              { label: 'EOS Accrual (8.5%)', value: eosAccrual, sub: true },
              { label: 'Total Employer Cost', value: totalEmployerCost, bold: true },
            ].map(row => (
              <div key={row.label} className={`flex justify-between ${row.bold ? 'font-semibold text-white pt-1 border-t border-white/10' : 'text-white/60'}`}>
                <span>{row.label}</span>
                <span className={row.bold ? 'text-indigo-300' : ''}>{fmtUSD(row.value)}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-emerald-400">
              <span>Net Salary</span>
              <span>{fmtUSD(netSalary)}</span>
            </div>
          </div>

          <button
            onClick={() => { void handleAddPayroll(); }}
            disabled={adding || !calcBase}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add to Payroll'}
          </button>
        </div>
      </div>

      {/* Payroll table */}
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Payroll — {monthOptions.find(o => o.value === selectedMonth)?.label}</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-white/30">Loading...</div>
          ) : payroll.length === 0 ? (
            <div className="p-8 text-center text-white/30">No payroll entries for this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Employee</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">NSSF Emp.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">EOS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Net</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Total Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white/40">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(entry => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white">{entry.employee_name}</td>
                    <td className="px-4 py-3 text-right text-white/80">{fmtUSD(entry.gross_salary)}</td>
                    <td className="px-4 py-3 text-right text-white/60">{fmtUSD(entry.nssf_employer)}</td>
                    <td className="px-4 py-3 text-right text-white/60">{fmtUSD(entry.eos_accrual)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmtUSD(entry.net_salary)}</td>
                    <td className="px-4 py-3 text-right text-indigo-300 font-semibold">{fmtUSD(entry.total_employer_cost)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${entry.payment_status === 'paid' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                        {entry.payment_status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {entry.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {entry.payment_status !== 'paid' && (
                          <button
                            onClick={() => { void handleMarkPaid(entry.id); }}
                            className="rounded-lg p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400"
                            title="Mark Paid"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => { void handlePrintPayslip(entry); }}
                          className="rounded-lg p-1.5 text-white/40 hover:bg-indigo-500/20 hover:text-indigo-400"
                          title="Print Payslip"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Budget ───────────────────────────────────────────────────────────────

interface BudgetTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
}

function BudgetTab({ expenses, categories }: BudgetTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [editingBudget, setEditingBudget] = useState<Record<string, string>>({});
  const [savingBudget, setSavingBudget] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number) as [number, number];

  const loadBudgets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expense_budgets')
        .select('*')
        .eq('year', year)
        .eq('month', month);
      if (error) throw error;
      setBudgets((data ?? []) as ExpenseBudget[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load budgets');
    }
  }, [year, month]);

  useEffect(() => { void loadBudgets(); }, [loadBudgets]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.expense_date.slice(0, 7) === selectedMonth),
    [expenses, selectedMonth],
  );

  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      if (!e.category_id) continue;
      map.set(e.category_id, (map.get(e.category_id) ?? 0) + e.amount_usd);
    }
    return map;
  }, [monthExpenses]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, ExpenseBudget>();
    for (const b of budgets) {
      if (b.category_id) map.set(b.category_id, b);
    }
    return map;
  }, [budgets]);

  const totalBudget = budgets.reduce((s, b) => s + b.budgeted_amount_usd, 0);
  const totalActual = monthExpenses.reduce((s, e) => s + e.amount_usd, 0);
  const totalVariance = totalBudget - totalActual;

  async function saveBudget(categoryId: string, rawValue: string) {
    const val = parseFloat(rawValue);
    if (isNaN(val) || val < 0) return;
    setSavingBudget(categoryId);
    try {
      const existing = budgetMap.get(categoryId);
      if (existing) {
        const { error } = await supabase.from('expense_budgets').update({ budgeted_amount_usd: val }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_budgets').insert({
          category_id: categoryId,
          year,
          month,
          budgeted_amount_usd: val,
        });
        if (error) throw error;
      }
      toast.success('Budget saved');
      void loadBudgets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingBudget(null);
    }
  }

  async function handleCopyLastMonth() {
    setCopying(true);
    try {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const { data, error } = await supabase
        .from('expense_budgets')
        .select('*')
        .eq('year', prevYear)
        .eq('month', prevMonth);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info('No budgets found for last month');
        return;
      }
      for (const b of data as ExpenseBudget[]) {
        if (!b.category_id) continue;
        await supabase.from('expense_budgets').upsert({
          category_id: b.category_id,
          year,
          month,
          budgeted_amount_usd: b.budgeted_amount_usd,
        }, { onConflict: 'tenant_id,category_id,year,month', ignoreDuplicates: false });
      }
      toast.success('Copied from last month');
      void loadBudgets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => { void handleCopyLastMonth(); }}
          disabled={copying}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          <Copy className="h-4 w-4" />
          {copying ? 'Copying...' : 'Copy Last Month'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Budget', value: totalBudget, color: 'text-indigo-400' },
          { label: 'Total Actual', value: totalActual, color: 'text-white' },
          { label: 'Variance', value: totalVariance, color: totalVariance >= 0 ? 'text-emerald-400' : 'text-rose-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{fmtUSD(Math.abs(c.value))}{c.label === 'Variance' ? (totalVariance >= 0 ? ' under' : ' over') : ''}</p>
          </div>
        ))}
      </div>

      {/* Budget table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Budget (USD)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Actual (USD)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">Variance</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40">% Used</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 w-32">Progress</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const budget = budgetMap.get(cat.id);
              const actual = actualByCategory.get(cat.id) ?? 0;
              const budgeted = budget?.budgeted_amount_usd ?? 0;
              const variance = budgeted - actual;
              const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0;
              const editKey = cat.id;
              const isEditing = editKey in editingBudget;
              const displayVal = isEditing ? (editingBudget[editKey] ?? '') : (budgeted > 0 ? budgeted.toFixed(2) : '');

              return (
                <tr key={cat.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white">{cat.name}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={displayVal}
                      onChange={e => setEditingBudget(prev => ({ ...prev, [editKey]: e.target.value }))}
                      onFocus={e => setEditingBudget(prev => ({ ...prev, [editKey]: e.target.value }))}
                      onBlur={() => {
                        const v = editingBudget[editKey];
                        if (v !== undefined) {
                          void saveBudget(cat.id, v);
                          setEditingBudget(prev => { const n = { ...prev }; delete n[editKey]; return n; });
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = editingBudget[editKey];
                          if (v !== undefined) {
                            void saveBudget(cat.id, v);
                            setEditingBudget(prev => { const n = { ...prev }; delete n[editKey]; return n; });
                            (e.target as HTMLInputElement).blur();
                          }
                        }
                      }}
                      placeholder="0.00"
                      className="w-28 bg-slate-800 border border-white/20 text-white rounded-lg px-2 py-1 text-sm text-right"
                      disabled={savingBudget === cat.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">{actual > 0 ? fmtUSD(actual) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${budgeted > 0 ? (variance >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-white/20'}`}>
                    {budgeted > 0 ? `${variance >= 0 ? '+' : ''}${fmtUSD(variance)}` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${pct > 100 ? 'text-rose-400' : pct > 80 ? 'text-amber-400' : 'text-white/60'}`}>
                    {budgeted > 0 ? fmtPct(pct) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {budgeted > 0 && (
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden w-24">
                        <div
                          className={`h-full rounded-full transition-all ${pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: P&L Report ───────────────────────────────────────────────────────────

interface PLTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  sales: import('@/context/AppContext').Sale[];
  currentTenant: import('@/context/AppContext').Tenant | null;
}

function PLTab({ expenses, categories, sales, currentTenant }: PLTabProps) {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const periodExpenses = useMemo(
    () => expenses.filter(e => e.expense_date >= dateFrom && e.expense_date <= dateTo),
    [expenses, dateFrom, dateTo],
  );

  const periodRevenue = useMemo(
    () => sales.filter(s => s.date.slice(0, 10) >= dateFrom && s.date.slice(0, 10) <= dateTo).reduce((sum, s) => sum + (s.total ?? 0), 0),
    [sales, dateFrom, dateTo],
  );

  // Group expenses by type
  const expensesByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of periodExpenses) {
      const cat = categories.find(c => c.id === e.category_id);
      const type = cat?.type ?? 'other';
      map.set(type, (map.get(type) ?? 0) + e.amount_usd);
    }
    return map;
  }, [periodExpenses, categories]);

  const cogsTotal = expensesByType.get('cogs') ?? 0;
  const grossProfit = periodRevenue - cogsTotal;
  const grossPct = periodRevenue > 0 ? (grossProfit / periodRevenue) * 100 : 0;

  const operatingTypes = ['labor', 'utilities', 'facilities', 'financial', 'marketing', 'taxes', 'professional', 'insurance', 'technology', 'transport', 'other'];
  const operatingTotal = operatingTypes.reduce((sum, t) => sum + (expensesByType.get(t) ?? 0), 0);
  const ebitda = grossProfit - operatingTotal;
  const ebitdaPct = periodRevenue > 0 ? (ebitda / periodRevenue) * 100 : 0;
  const taxProvision = Math.max(0, ebitda * 0.17);
  const netProfit = ebitda - taxProvision;
  const netPct = periodRevenue > 0 ? (netProfit / periodRevenue) * 100 : 0;

  const cogsCategoryMap = useMemo(() => {
    const res = new Map<string, number>();
    for (const e of periodExpenses) {
      const cat = categories.find(c => c.id === e.category_id && c.is_cogs);
      if (!cat) continue;
      res.set(cat.name, (res.get(cat.name) ?? 0) + e.amount_usd);
    }
    return res;
  }, [periodExpenses, categories]);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      let y = 20;

      // Header
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(currentTenant?.name ?? 'Business', margin, y);
      y += 8;
      doc.setFontSize(12);
      doc.setTextColor(99, 102, 241);
      doc.text('Profit & Loss Statement', margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${dateFrom} to ${dateTo}`, margin, y);
      y += 10;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      const leftCol = margin;
      const rightCol = pageW - margin - 5;

      function addRow(label: string, value: number | null, bold = false, indent = 0) {
        if (y > 268) { doc.addPage(); y = 20; }
        doc.setFontSize(9);
        if (bold) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
        }
        doc.text(label, leftCol + indent, y);
        if (value !== null) {
          const str = value < 0 ? `(${fmtUSD(Math.abs(value))})` : fmtUSD(value);
          doc.text(str, rightCol, y, { align: 'right' });
        }
        y += 5.5;
      }

      function addDivider() {
        if (y > 268) { doc.addPage(); y = 20; }
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y - 1, pageW - margin, y - 1);
        y += 2;
      }

      addRow('REVENUE', null, true);
      addRow('Sales Revenue', periodRevenue, false, 4);
      addDivider();
      addRow('TOTAL REVENUE', periodRevenue, true);
      y += 3;

      addRow('COST OF GOODS SOLD', null, true);
      for (const [name, val] of cogsCategoryMap.entries()) {
        addRow(name, val, false, 4);
      }
      addDivider();
      addRow('TOTAL COGS', cogsTotal, true);
      addRow(`GROSS PROFIT (${fmtPct(grossPct)})`, grossProfit, true);
      y += 3;

      addRow('OPERATING EXPENSES', null, true);
      for (const type of operatingTypes) {
        const val = expensesByType.get(type);
        if (val && val > 0) addRow(TYPE_LABELS[type] ?? type, val, false, 4);
      }
      addDivider();
      addRow('TOTAL OPERATING EXPENSES', operatingTotal, true);
      addRow(`EBITDA (${fmtPct(ebitdaPct)})`, ebitda, true);
      y += 3;

      addRow('TAX PROVISION (17% CIT est.)', taxProvision, false, 4);
      addDivider();
      addRow(`ESTIMATED NET PROFIT (${fmtPct(netPct)})`, netProfit, true);

      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150, 160, 180);
      doc.text('Powered by KiTS Business · For management use only', pageW / 2, 287, { align: 'center' });

      doc.save(`pl-${dateFrom}-to-${dateTo}.pdf`);
      toast.success('P&L PDF exported');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
          />
          <span className="text-white/40">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => { void handleExportPdf(); }}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ms-auto"
        >
          <FileText className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* P&L Statement */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-1 font-mono text-sm">
        <PLRow label="REVENUE" bold />
        <PLRow label="  Sales Revenue" value={periodRevenue} indent />
        <PLDivider />
        <PLRow label="TOTAL REVENUE" value={periodRevenue} bold />
        <div className="h-3" />

        <PLRow label="COST OF GOODS SOLD (COGS)" bold />
        {Array.from(cogsCategoryMap.entries()).map(([name, val]) => (
          <PLRow key={name} label={`  ${name}`} value={val} indent />
        ))}
        {cogsCategoryMap.size === 0 && <PLRow label="  (none recorded)" indent />}
        <PLDivider />
        <PLRow label="TOTAL COGS" value={cogsTotal} bold />
        <PLRow label={`GROSS PROFIT (${fmtPct(grossPct)})`} value={grossProfit} bold highlight={grossProfit >= 0 ? 'green' : 'red'} />
        <div className="h-3" />

        <PLRow label="OPERATING EXPENSES" bold />
        {operatingTypes.map(type => {
          const val = expensesByType.get(type);
          if (!val || val === 0) return null;
          return <PLRow key={type} label={`  ${TYPE_LABELS[type] ?? type}`} value={val} indent />;
        })}
        <PLDivider />
        <PLRow label="TOTAL OPERATING EXPENSES" value={operatingTotal} bold />
        <PLRow label={`EBITDA (${fmtPct(ebitdaPct)})`} value={ebitda} bold highlight={ebitda >= 0 ? 'green' : 'red'} />
        <div className="h-3" />

        <PLRow label="  TAX PROVISION (17% CIT est.)" value={-taxProvision} indent />
        <PLDivider />
        <PLRow
          label={`ESTIMATED NET PROFIT (${fmtPct(netPct)})`}
          value={netProfit}
          bold
          highlight={netProfit >= 0 ? 'green' : 'red'}
        />
      </div>
    </div>
  );
}

function PLRow({ label, value, bold = false, indent = false, highlight }: {
  label: string;
  value?: number;
  bold?: boolean;
  indent?: boolean;
  highlight?: 'green' | 'red';
}) {
  const valueColor = highlight === 'green' ? 'text-emerald-400' : highlight === 'red' ? 'text-rose-400' : 'text-white/80';
  return (
    <div className={`flex justify-between py-1 ${indent ? 'ps-4' : ''} ${bold ? 'font-bold text-white' : 'text-white/60'}`}>
      <span>{label}</span>
      {value !== undefined && (
        <span className={`${valueColor} ${bold ? 'font-bold' : ''}`}>
          {value < 0 ? `(${fmtUSD(Math.abs(value))})` : fmtUSD(value)}
        </span>
      )}
    </div>
  );
}

function PLDivider() {
  return <div className="border-t border-white/10 my-1" />;
}

// ── Main Finance Page ─────────────────────────────────────────────────────────

const TABS = ['Overview', 'Expenses', 'Payroll', 'Budget', 'P&L Report'] as const;
type Tab = typeof TABS[number];

export default function FinancePage() {
  const { sales, employees, currentTenant } = useApp();
  const { role } = useSubscription();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Role check
  const fullRole = (currentTenant?.userRole ?? role) as RoleType;
  const isAuthorized = FINANCE_ROLES.includes(fullRole);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [expRes, catRes] = await Promise.all([
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('expense_categories').select('*').eq('is_active', true).order('sort_order'),
      ]);
      if (expRes.error) throw expRes.error;
      if (catRes.error) throw catRes.error;
      setExpenses((expRes.data ?? []) as Expense[]);
      setCategories((catRes.data ?? []) as ExpenseCategory[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load finance data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
          <ShieldOff className="h-12 w-12 text-white/20" />
          <h2 className="text-xl font-semibold text-white">Not Authorized</h2>
          <p className="text-sm text-white/50 text-center max-w-xs">
            The Finance module is only accessible to owners, admins, managers, supervisors, and accountants.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-indigo-400" />
              Finance
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Expenses, payroll, budgets, and P&amp;L reporting
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-indigo-500 text-white bg-indigo-500/10'
                  : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loadingData ? (
          <div className="flex items-center justify-center h-48 text-white/30">Loading finance data...</div>
        ) : (
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                expenses={expenses}
                categories={categories}
                sales={sales}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                monthOptions={monthOptions}
              />
            )}
            {activeTab === 'Expenses' && (
              <ExpensesTab
                expenses={expenses}
                categories={categories}
                currentTenant={currentTenant}
                onRefresh={() => { void loadData(); }}
              />
            )}
            {activeTab === 'Payroll' && (
              <PayrollTab
                employees={employees}
                currentTenant={currentTenant}
              />
            )}
            {activeTab === 'Budget' && (
              <BudgetTab
                expenses={expenses}
                categories={categories}
              />
            )}
            {activeTab === 'P&L Report' && (
              <PLTab
                expenses={expenses}
                categories={categories}
                sales={sales}
                currentTenant={currentTenant}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
