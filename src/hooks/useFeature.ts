import { type Feature, type SubscriptionPlan } from '../types/subscription';
import { useSubscription } from '../context/SubscriptionContext';

export function useFeature(feature: Feature): { available: boolean; plan: SubscriptionPlan } {
  const { hasFeature, plan } = useSubscription();
  return { available: hasFeature(feature), plan };
}
