import { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, Plus, Trash2 } from 'lucide-react';
import type { SplitPayment } from '../types/pos';
import { POSCalculator } from '../utils/posCalculations';

interface SplitPaymentModalProps {
  isOpen: boolean;
  totalAmount: number;
  onComplete: (payments: SplitPayment[]) => void;
  onCancel: () => void;
}

export default function SplitPaymentModal({ isOpen, totalAmount, onComplete, onCancel }: SplitPaymentModalProps) {
  const [payments, setPayments] = useState<SplitPayment[]>([
    { id: '1', method: 'cash', amount: totalAmount, status: 'pending' }
  ]);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');

  const addPayment = () => {
    const remainingAmount = totalAmount - payments.reduce((sum, p) => sum + p.amount, 0);
    if (remainingAmount <= 0) return;

    const newPayment: SplitPayment = {
      id: Date.now().toString(),
      method: newPaymentMethod,
      amount: Math.min(remainingAmount, 0),
      status: 'pending'
    };

    setPayments([...payments, newPayment]);
  };

  const updatePayment = (id: string, amount: number) => {
    setPayments(payments.map(p => 
      p.id === id ? { ...p, amount: Math.max(0, amount) } : p
    ));
  };

  const removePayment = (id: string) => {
    if (payments.length <= 1) return;
    setPayments(payments.filter(p => p.id !== id));
  };

  const getTotalPaid = () => payments.reduce((sum, p) => sum + p.amount, 0);
  const getRemainingAmount = () => totalAmount - getTotalPaid();
  const isValid = POSCalculator.validateSplitPayments(payments, totalAmount).isValid;

  const handleComplete = () => {
    if (isValid) {
      onComplete(payments.map(p => ({ ...p, status: 'completed' })));
    }
  };

  if (!isOpen) return null;

  const paymentIcons = {
    cash: DollarSign,
    card: CreditCard,
    digital: Smartphone
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="glass-panel w-full max-w-lg overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Split Payment</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 rounded-lg border border-white/30 bg-white/10">
            <span className="text-white/80">Total Amount:</span>
            <span className="text-lg font-semibold text-white">${totalAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg border border-white/30 bg-white/10">
            <span className="text-white/80">Remaining:</span>
            <span className={`text-lg font-semibold ${getRemainingAmount() < 0 ? 'text-red-400' : 'text-white'}`}>
              ${Math.abs(getRemainingAmount()).toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
            {payments.map((payment) => {
              const Icon = paymentIcons[payment.method];
              return (
                <div key={payment.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/30 bg-white/10">
                  <Icon className="w-5 h-5 text-white/80" />
                  <span className="capitalize text-white/80 min-w-[60px]">{payment.method}</span>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => updatePayment(payment.id, parseFloat(e.target.value) || 0)}
                    className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                    step="0.01"
                    min="0"
                  />
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(payment.id)}
                      className="p-2 rounded-lg border border-rose-200/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {getRemainingAmount() > 0 && (
            <div className="flex items-center gap-3">
              <select
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value as 'cash' | 'card' | 'digital')}
                className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="digital">Digital Wallet</option>
              </select>
              <button
                onClick={addPayment}
                className="p-2 rounded-lg border border-emerald-200/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isValid && (
            <div className="p-3 rounded-lg border border-rose-200/50 bg-rose-500/20 text-rose-300 text-sm">
              {POSCalculator.validateSplitPayments(payments, totalAmount).error}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={!isValid}
            className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Complete Payment
          </button>
        </div>
      </div>
    </div>
  );
}
