import { Star, Gift, TrendingUp, Award, Check } from 'lucide-react';
import { useState } from 'react';

import type { LoyaltyProgram, CustomerLoyalty, LoyaltyTier, LoyaltyReward } from '../types/pos';
import { POSCalculator } from '../utils/posCalculations';

interface LoyaltyModalProps {
  isOpen: boolean;
  subtotal: number;
  customerLoyalty?: CustomerLoyalty;
  loyaltyProgram?: LoyaltyProgram;
  onRedeemPoints: (points: number) => void;
  onCancel: () => void;
}

export default function LoyaltyModal({
  isOpen,
  subtotal,
  customerLoyalty,
  loyaltyProgram,
  onRedeemPoints,
  onCancel,
}: LoyaltyModalProps) {
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const pointsEarned = loyaltyProgram
    ? POSCalculator.calculateLoyaltyPointsEarned(subtotal, loyaltyProgram)
    : 0;

  const currentTier = loyaltyProgram?.tiers.find(tier => tier.id === customerLoyalty?.tierId);

  const canRedeemPoints = customerLoyalty && loyaltyProgram &&
    POSCalculator.canRedeemPoints(pointsToRedeem, customerLoyalty);

  const handleRedeemPoints = () => {
    if (canRedeemPoints && pointsToRedeem > 0) {
      onRedeemPoints(pointsToRedeem);
    }
  };

  const handleRedeemReward = (reward: LoyaltyReward) => {
    if (customerLoyalty && customerLoyalty.currentPoints >= reward.pointsCost) {
      setSelectedReward(reward);
      setPointsToRedeem(reward.pointsCost);
    }
  };

  const getDiscountFromPoints = () => {
    if (!loyaltyProgram || !pointsToRedeem) return 0;
    return POSCalculator.calculateLoyaltyDiscount(pointsToRedeem, loyaltyProgram);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg overflow-y-auto p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)'
      }}>
        <h2 className="text-xl font-semibold text-white mb-6">Loyalty Program</h2>

        {!customerLoyalty || !loyaltyProgram ? (
          <div className="text-center py-8 text-white/60">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No loyalty program available</p>
            <p className="text-xs mt-1">Customer must be enrolled in a loyalty program</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Status */}
            <div className="p-4 rounded-lg border border-white/30 bg-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-300" />
                  <span className="font-semibold text-white">{currentTier?.name || 'Member'}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-300">{customerLoyalty.currentPoints}</div>
                  <div className="text-xs text-white/60">Points</div>
                </div>
              </div>

              {currentTier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80">Benefits:</span>
                  </div>
                  <ul className="text-xs text-white/60 space-y-1">
                    {currentTier.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-emerald-300" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  {currentTier.discountRate > 0 && (
                    <div className="text-xs text-emerald-300">
                      Tier discount: {currentTier.discountRate}% off
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Points from This Purchase */}
            <div className="p-3 rounded-lg border border-emerald-400 bg-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-300" />
                  <span className="text-sm font-medium text-emerald-300">Points you'll earn</span>
                </div>
                <span className="text-lg font-bold text-emerald-300">+{pointsEarned}</span>
              </div>
              <div className="text-xs text-emerald-300/80 mt-1">
                {loyaltyProgram.pointsPerDollar} points per dollar
              </div>
            </div>

            {/* Redeem Points */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Redeem Points</h3>

              {/* Custom Points Redemption */}
              <div className="p-3 rounded-lg border border-white/30 bg-white/10">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={customerLoyalty.currentPoints}
                    value={pointsToRedeem}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setPointsToRedeem(Math.min(value, customerLoyalty.currentPoints));
                      setSelectedReward(null);
                    }}
                    className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                    placeholder="Enter points to redeem"
                  />
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      ${getDiscountFromPoints().toFixed(2)}
                    </div>
                    <div className="text-xs text-white/60">discount</div>
                  </div>
                </div>
                <div className="text-xs text-white/60 mt-2">
                  {loyaltyProgram.redemptionRate} points = $1
                </div>
              </div>

              {/* Available Rewards */}
              {loyaltyProgram.rewards.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/60">Available rewards:</div>
                  {loyaltyProgram.rewards.map((reward) => {
                    const canAfford = customerLoyalty.currentPoints >= reward.pointsCost;
                    const isSelected = selectedReward?.id === reward.id;

                    return (
                      <button
                        key={reward.id}
                        onClick={() => handleRedeemReward(reward)}
                        disabled={!canAfford}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/20'
                            : canAfford
                              ? 'border-white/30 bg-white/10 hover:border-white/50'
                              : 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Gift className="w-5 h-5 text-white/80" />
                            <div>
                              <div className="font-semibold text-white">{reward.name}</div>
                              <div className="text-xs text-white/60">{reward.description}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-amber-300">{reward.pointsCost}</div>
                            <div className="text-xs text-white/60">points</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Progress to Next Tier */}
            {currentTier && loyaltyProgram.tiers.length > 1 && (
              <div className="p-3 rounded-lg border border-white/30 bg-white/10">
                <div className="text-xs text-white/60 mb-2">Progress to next tier:</div>
                {(() => {
                  const currentIndex = loyaltyProgram.tiers.findIndex(t => t.id === currentTier.id);
                  const nextTier = loyaltyProgram.tiers[currentIndex + 1];

                  if (!nextTier) {
                    return <div className="text-xs text-white/80">You're at the highest tier!</div>;
                  }

                  const progress = (customerLoyalty.currentPoints / nextTier.minPoints) * 100;

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/80">{currentTier.name}</span>
                        <span className="text-white/80">{nextTier.name}</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-amber-300 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-white/60">
                        {nextTier.minPoints - customerLoyalty.currentPoints} points to {nextTier.name}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeemPoints}
                disabled={!canRedeemPoints || pointsToRedeem <= 0}
                className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Redeem {pointsToRedeem} Points
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
