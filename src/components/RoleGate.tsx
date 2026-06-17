import { useSubscription } from '../context/SubscriptionContext';
import { type RoleAction } from '../types/subscription';

interface RoleGateProps {
  action: RoleAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGate({ action, children, fallback = null }: RoleGateProps) {
  const { canPerform } = useSubscription();
  return canPerform(action) ? <>{children}</> : <>{fallback}</>;
}
