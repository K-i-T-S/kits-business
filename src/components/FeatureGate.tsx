import { Lock } from 'lucide-react';

import { useSubscription } from '../context/SubscriptionContext';
import {
  type Feature,
  FEATURE_DISPLAY,
  PLAN_DISPLAY,
} from '../types/subscription';

interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  showLocked?: boolean;
  compact?: boolean;
}

export default function FeatureGate({
  feature,
  children,
  showLocked = true,
  compact = false,
}: FeatureGateProps) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) return <>{children}</>;

  if (!showLocked) return null;

  const featureInfo = FEATURE_DISPLAY[feature];
  const requiredPlan = PLAN_DISPLAY[featureInfo.requiredPlan];

  if (compact) {
    return (
      <div className="relative inline-flex">
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/30 border border-amber-500/50">
          <Lock className="h-2.5 w-2.5 text-amber-400" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <Lock className="h-6 w-6 text-amber-400" />
      </div>
      <p className="text-sm font-semibold text-white/60">
        {featureInfo.name} requires {requiredPlan.name}
      </p>
      <p className="mt-1 text-xs text-white/40">
        Upgrade to unlock this feature
      </p>
      <button
        onClick={() => {
          const msg = encodeURIComponent(`Hi! I'd like to upgrade my KiTS plan to ${requiredPlan.name} to unlock ${featureInfo.name}.`);
          window.open(`https://wa.me/96181290662?text=${msg}`, '_blank');
        }}
        className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/30"
      >
        Upgrade to {requiredPlan.name} — {requiredPlan.price}
      </button>
    </div>
  );
}
