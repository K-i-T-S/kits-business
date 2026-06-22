import type { WaiterPerformanceStats } from '@/types/restaurant';

export function calculateWaiterScore(
  stats: WaiterPerformanceStats,
  allStats: WaiterPerformanceStats[],
): number {
  if (allStats.length === 0) return 0;
  const maxRevenue = Math.max(...allStats.map(s => s.total_revenue), 1);
  const maxTables = Math.max(...allStats.map(s => s.tables_served), 1);
  const minSpeed = Math.min(...allStats.map(s => s.avg_service_minutes), 1);
  const maxSpeed = Math.max(...allStats.map(s => s.avg_service_minutes), 1);
  const speedPct =
    maxSpeed === minSpeed
      ? 100
      : ((maxSpeed - stats.avg_service_minutes) / (maxSpeed - minSpeed)) * 100;
  return (
    (stats.total_revenue / maxRevenue) * 40 +
    (stats.tables_served / maxTables) * 30 +
    (stats.avg_rating / 5) * 20 +
    speedPct * 0.1
  );
}

export function rankWaiters(
  allStats: WaiterPerformanceStats[],
): Array<WaiterPerformanceStats & { score: number; rank: number }> {
  return allStats
    .map(s => ({ ...s, score: calculateWaiterScore(s, allStats) }))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function getEmployeeOfMonth(
  allStats: WaiterPerformanceStats[],
): (WaiterPerformanceStats & { score: number; rank: number }) | null {
  const ranked = rankWaiters(allStats);
  return ranked[0] ?? null;
}
