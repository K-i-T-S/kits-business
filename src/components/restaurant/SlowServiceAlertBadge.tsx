import { useSlowServiceAlerts } from '@/hooks/useSlowServiceAlerts';

export default function SlowServiceAlertBadge() {
  const { totalCount } = useSlowServiceAlerts();
  if (totalCount === 0) return null;
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
      {totalCount > 9 ? '9+' : totalCount}
    </span>
  );
}
