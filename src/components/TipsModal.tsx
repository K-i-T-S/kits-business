import { Percent, DollarSign, Heart } from 'lucide-react';
import { useState } from 'react';

import type { TipInfo } from '../types/pos';
import { POSCalculator } from '../utils/posCalculations';

interface TipsModalProps {
  isOpen: boolean;
  subtotal: number;
  onComplete: (tipInfo: TipInfo) => void;
  onCancel: () => void;
}

export default function TipsModal({ isOpen, subtotal, onComplete, onCancel }: TipsModalProps) {
  const [tipType, setTipType] = useState<'percentage' | 'fixed' | 'custom'>('percentage');
  const [percentage, setPercentage] = useState(15);
  const [fixedAmount, setFixedAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState(0);

  const calculateTip = () => {
    switch (tipType) {
      case 'percentage':
        return POSCalculator.calculateTip(subtotal, { amount: 0, percentage, type: 'percentage' });
      case 'fixed':
        return POSCalculator.calculateTip(subtotal, { amount: fixedAmount, type: 'fixed' });
      case 'custom':
        return customAmount;
      default:
        return 0;
    }
  };

  const handleComplete = () => {
    const tipInfo: TipInfo = {
      amount: calculateTip(),
      type: tipType,
      ...(tipType === 'percentage' && { percentage }),
    };
    onComplete(tipInfo);
  };

  if (!isOpen) return null;

  const currentTip = calculateTip();
  const totalWithTip = subtotal + currentTip;

  const percentageOptions = [10, 15, 18, 20, 25];
  const fixedOptions = [1, 2, 5, 10, 20];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md overflow-y-auto p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)',
      }}>
        <h2 className="text-xl font-semibold text-white mb-6">Add Tip</h2>

        <div className="space-y-4">
          <div className="text-center p-4 rounded-lg border border-white/30 bg-white/10">
            <div className="text-2xl font-bold text-white">${currentTip.toFixed(2)}</div>
            <div className="text-sm text-white/60">Tip Amount</div>
          </div>

          <div className="text-center p-3 rounded-lg border border-white/30 bg-emerald-500/20">
            <div className="text-lg font-semibold text-emerald-300">${totalWithTip.toFixed(2)}</div>
            <div className="text-sm text-emerald-300/80">Total with Tip</div>
          </div>

          {/* Tip Type Selection */}
          <div className="flex gap-2 p-1 rounded-lg border border-white/30 bg-white/10">
            <button
              onClick={() => setTipType('percentage')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tipType === 'percentage'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              <Percent className="w-4 h-4" />
              Percentage
            </button>
            <button
              onClick={() => setTipType('fixed')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tipType === 'fixed'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Fixed
            </button>
            <button
              onClick={() => setTipType('custom')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tipType === 'custom'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              <Heart className="w-4 h-4" />
              Custom
            </button>
          </div>

          {/* Tip Options */}
          {tipType === 'percentage' && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {percentageOptions.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setPercentage(pct)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      percentage === pct
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/30 text-white/80 hover:border-white/50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value) || 0)}
                  className="w-16 rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-white text-sm text-center focus:border-white/50 focus:outline-none"
                />
                <span className="text-white/60">%</span>
              </div>
            </div>
          )}

          {tipType === 'fixed' && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {fixedOptions.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setFixedAmount(amount)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      fixedAmount === amount
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/30 text-white/80 hover:border-white/50'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-white/60" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                  placeholder="Enter fixed amount"
                />
              </div>
            </div>
          )}

          {tipType === 'custom' && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-white/60" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                placeholder="Enter custom tip amount"
              />
            </div>
          )}

          {/* Quick Tip Suggestions */}
          <div className="p-3 rounded-lg border border-white/30 bg-white/10">
            <div className="text-xs text-white/60 mb-2">Quick suggestions based on subtotal:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => { setTipType('percentage'); setPercentage(10); }}
                className="p-2 rounded border border-white/30 text-white/80 hover:border-white/50"
              >
                10% = ${(subtotal * 0.1).toFixed(2)}
              </button>
              <button
                onClick={() => { setTipType('percentage'); setPercentage(15); }}
                className="p-2 rounded border border-white/30 text-white/80 hover:border-white/50"
              >
                15% = ${(subtotal * 0.15).toFixed(2)}
              </button>
              <button
                onClick={() => { setTipType('percentage'); setPercentage(20); }}
                className="p-2 rounded border border-white/30 text-white/80 hover:border-white/50"
              >
                20% = ${(subtotal * 0.2).toFixed(2)}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            No Tip
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40"
          >
            Add Tip
          </button>
        </div>
      </div>
    </div>
  );
}
