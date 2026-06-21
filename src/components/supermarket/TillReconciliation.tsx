import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale, CheckCircle, AlertTriangle } from 'lucide-react';

interface TillEntry {
  denomination: string;
  count: number;
  value: number;
}

const DENOMINATIONS: Array<{ label: string; value: number; currency: string }> = [
  { label: '$100', value: 100, currency: 'USD' },
  { label: '$50', value: 50, currency: 'USD' },
  { label: '$20', value: 20, currency: 'USD' },
  { label: '$10', value: 10, currency: 'USD' },
  { label: '$5', value: 5, currency: 'USD' },
  { label: '$1', value: 1, currency: 'USD' },
];

export default function TillReconciliation() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TillEntry[]>(
    DENOMINATIONS.map(d => ({ denomination: d.label, count: 0, value: d.value }))
  );
  const [expectedCash, setExpectedCash] = useState('');
  const [reconciled, setReconciled] = useState(false);

  const countedTotal = entries.reduce((s, e) => s + e.count * e.value, 0);
  const expected = parseFloat(expectedCash) || 0;
  const variance = countedTotal - expected;

  const updateCount = (index: number, count: number) => {
    setEntries(prev => prev.map((e, i) => (i === index ? { ...e, count: Math.max(0, count) } : e)));
  };

  const handleReconcile = () => {
    setReconciled(true);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Scale className="h-5 w-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">{t('supermarket.till.title', 'Till Reconciliation')}</h2>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          {t('supermarket.till.expected', 'Expected Cash (from POS)')}
        </label>
        <input
          type="number"
          step="0.01"
          value={expectedCash}
          onChange={e => setExpectedCash(e.target.value)}
          placeholder="0.00"
          className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 placeholder-white/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          {t('supermarket.till.countBills', 'Count Bills')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {entries.map((entry, i) => (
            <div key={entry.denomination} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">{entry.denomination}</span>
              <input
                type="number"
                min={0}
                value={entry.count || ''}
                onChange={e => updateCount(i, parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-16 bg-slate-800 border border-white/20 text-white rounded-lg px-2 py-1 text-sm text-right"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t('supermarket.till.counted', 'Counted Total')}</span>
          <span className="font-semibold text-white">${countedTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t('supermarket.till.expected', 'Expected')}</span>
          <span className="font-semibold text-white">${expected.toFixed(2)}</span>
        </div>
        <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold">
          <span className="text-white/80">{t('supermarket.till.variance', 'Variance')}</span>
          <span className={variance === 0 ? 'text-emerald-400' : variance > 0 ? 'text-amber-400' : 'text-red-400'}>
            {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
          </span>
        </div>
      </div>

      {reconciled && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          variance === 0
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}>
          {variance === 0
            ? <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          }
          <p className="text-sm text-white/80">
            {variance === 0
              ? t('supermarket.till.balanced', 'Till is balanced. Great job!')
              : t('supermarket.till.discrepancy', `Discrepancy of $${Math.abs(variance).toFixed(2)} detected. Please recount.`)
            }
          </p>
        </div>
      )}

      <button
        onClick={handleReconcile}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white"
      >
        {t('supermarket.till.reconcile', 'Reconcile Till')}
      </button>
    </div>
  );
}
