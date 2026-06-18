import { useSubscription } from '../context/SubscriptionContext';
import { type Feature, type SubscriptionPlan } from '../types/subscription';

export function useFeature(feature: Feature): { available: boolean; plan: SubscriptionPlan } {
  const { hasFeature, plan } = useSubscription();
  return { available: hasFeature(feature), plan };
}
