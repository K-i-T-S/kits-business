import { useState } from 'react';
import { useMenuEngineering, type MenuEngineeringItem } from '@/hooks/useMenuEngineering';
import { Lightbulb, TrendingUp, Target, AlertTriangle } from 'lucide-react';

interface MenuEngineeringMatrixProps {
  tenantId: string | undefined;
}

const QUADRANT_CONFIG = {
  star: {
    label: 'STAR',
    description: 'High popularity, high margin',
    icon: '⭐',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    icon_color: 'text-emerald-400',
  },
  plowhorse: {
    label: 'PLOWHORSE',
    description: 'High popularity, low margin',
    icon: '📦',
    color: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon_color: 'text-amber-400',
  },
  puzzle: {
    label: 'PUZZLE',
    description: 'Low popularity, high margin',
    icon: '🧩',
    color: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-500/30',
    text: 'text-sky-300',
    icon_color: 'text-sky-400',
  },
  dog: {
    label: 'DOG',
    description: 'Low popularity, low margin',
    icon: '🐕',
    color: 'from-red-500/20 to-red-500/5',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon_color: 'text-red-400',
  },
};

function ActionChip({
  icon: Icon,
  title,
  action,
  impact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action: string;
  impact: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-2.5 text-[10px]">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="h-3 w-3 text-amber-400" />
        <span className="font-semibold text-white/70">{title}</span>
      </div>
      <p className="text-white/50 mb-1">{action}</p>
      <p className={`font-bold ${impact > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
        {impact > 0 ? '+' : ''}{Math.round(impact).toLocaleString()} USD potential
      </p>
    </div>
  );
}

export default function MenuEngineeringMatrix({ tenantId }: MenuEngineeringMatrixProps) {
  const { items, loading, error } = useMenuEngineering(tenantId);
  const [selectedQuadrant, setSelectedQuadrant] = useState<'all' | 'star' | 'plowhorse' | 'puzzle' | 'dog'>('all');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/8 backdrop-blur-md p-6 text-center">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  // Group items by quadrant
  const quadrants = {
    star: items.filter((i) => i.category === 'star'),
    plowhorse: items.filter((i) => i.category === 'plowhorse'),
    puzzle: items.filter((i) => i.category === 'puzzle'),
    dog: items.filter((i) => i.category === 'dog'),
  };

  // Calculate totals
  const totals = {
    star: quadrants.star.reduce((s, i) => s + i.potentialRevenueImpact, 0),
    plowhorse: quadrants.plowhorse.reduce((s, i) => s + i.potentialRevenueImpact, 0),
    puzzle: quadrants.puzzle.reduce((s, i) => s + i.potentialRevenueImpact, 0),
    dog: quadrants.dog.reduce((s, i) => s + i.potentialRevenueImpact, 0),
  };

  const filteredItems = selectedQuadrant === 'all' ? items : quadrants[selectedQuadrant];

  // Category filter buttons
  const categories = [
    { key: 'all' as const, label: 'All Items', count: items.length },
    { key: 'star' as const, label: 'Stars', count: quadrants.star.length },
    { key: 'plowhorse' as const, label: 'Plowhorses', count: quadrants.plowhorse.length },
    { key: 'puzzle' as const, label: 'Puzzles', count: quadrants.puzzle.length },
    { key: 'dog' as const, label: 'Dogs', count: quadrants.dog.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header + info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            BCG Menu Matrix
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            4-quadrant analysis of menu profitability and popularity
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Total Items</p>
          <p className="text-lg font-bold text-amber-400">{items.length}</p>
        </div>
      </div>

      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2">
        {categories.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setSelectedQuadrant(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedQuadrant === key
                ? 'bg-amber-500/30 border border-amber-500/50 text-amber-300'
                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            {label}
            <span className="ml-1.5 text-white/40">({count})</span>
          </button>
        ))}
      </div>

      {/* 4-Quadrant Matrix Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* STAR (top-right) */}
        <div
          className={`backdrop-blur-md rounded-2xl border shadow-2xl p-4 cursor-pointer transition-all ${
            QUADRANT_CONFIG.star.color
          } ${QUADRANT_CONFIG.star.border} ${
            selectedQuadrant === 'star' ? 'ring-2 ring-emerald-400' : ''
          }`}
          onClick={() => setSelectedQuadrant('star')}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${QUADRANT_CONFIG.star.text}`}>
              {QUADRANT_CONFIG.star.icon} {QUADRANT_CONFIG.star.label}
            </h4>
            <span className="text-lg">{quadrants.star.length}</span>
          </div>
          <p className="text-[10px] text-white/50 mb-2">{QUADRANT_CONFIG.star.description}</p>
          <p className="text-xs font-bold text-emerald-400">
            {totals.star > 0 ? '+' : ''}{Math.round(totals.star).toLocaleString()} USD
          </p>
        </div>

        {/* PUZZLE (top-left) */}
        <div
          className={`backdrop-blur-md rounded-2xl border shadow-2xl p-4 cursor-pointer transition-all ${
            QUADRANT_CONFIG.puzzle.color
          } ${QUADRANT_CONFIG.puzzle.border} ${
            selectedQuadrant === 'puzzle' ? 'ring-2 ring-sky-400' : ''
          }`}
          onClick={() => setSelectedQuadrant('puzzle')}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${QUADRANT_CONFIG.puzzle.text}`}>
              {QUADRANT_CONFIG.puzzle.icon} {QUADRANT_CONFIG.puzzle.label}
            </h4>
            <span className="text-lg">{quadrants.puzzle.length}</span>
          </div>
          <p className="text-[10px] text-white/50 mb-2">{QUADRANT_CONFIG.puzzle.description}</p>
          <p className="text-xs font-bold text-sky-400">
            {totals.puzzle > 0 ? '+' : ''}{Math.round(totals.puzzle).toLocaleString()} USD
          </p>
        </div>

        {/* PLOWHORSE (bottom-right) */}
        <div
          className={`backdrop-blur-md rounded-2xl border shadow-2xl p-4 cursor-pointer transition-all ${
            QUADRANT_CONFIG.plowhorse.color
          } ${QUADRANT_CONFIG.plowhorse.border} ${
            selectedQuadrant === 'plowhorse' ? 'ring-2 ring-amber-400' : ''
          }`}
          onClick={() => setSelectedQuadrant('plowhorse')}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${QUADRANT_CONFIG.plowhorse.text}`}>
              {QUADRANT_CONFIG.plowhorse.icon} {QUADRANT_CONFIG.plowhorse.label}
            </h4>
            <span className="text-lg">{quadrants.plowhorse.length}</span>
          </div>
          <p className="text-[10px] text-white/50 mb-2">{QUADRANT_CONFIG.plowhorse.description}</p>
          <p className="text-xs font-bold text-amber-400">
            {totals.plowhorse > 0 ? '+' : ''}{Math.round(totals.plowhorse).toLocaleString()} USD
          </p>
        </div>

        {/* DOG (bottom-left) */}
        <div
          className={`backdrop-blur-md rounded-2xl border shadow-2xl p-4 cursor-pointer transition-all ${
            QUADRANT_CONFIG.dog.color
          } ${QUADRANT_CONFIG.dog.border} ${
            selectedQuadrant === 'dog' ? 'ring-2 ring-red-400' : ''
          }`}
          onClick={() => setSelectedQuadrant('dog')}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${QUADRANT_CONFIG.dog.text}`}>
              {QUADRANT_CONFIG.dog.icon} {QUADRANT_CONFIG.dog.label}
            </h4>
            <span className="text-lg">{quadrants.dog.length}</span>
          </div>
          <p className="text-[10px] text-white/50 mb-2">{QUADRANT_CONFIG.dog.description}</p>
          <p className="text-xs font-bold text-red-400">
            {totals.dog > 0 ? '+' : ''}{Math.round(totals.dog).toLocaleString()} USD
          </p>
        </div>
      </div>

      {/* Detailed Items List */}
      {filteredItems.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
            {selectedQuadrant === 'all' ? 'All Items' : `${QUADRANT_CONFIG[selectedQuadrant].label} Details`}
          </h4>
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const cfg = QUADRANT_CONFIG[item.category];
              const isHovered = hoveredItem === item.id;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`backdrop-blur-md rounded-xl border ${cfg.border} ${cfg.color} p-3 transition-all ${
                    isHovered ? 'ring-1 ring-white/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{cfg.icon}</span>
                        <h5 className="font-semibold text-white/80 truncate">{item.itemName}</h5>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/10 ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 mb-2">{item.recommendedAction}</p>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-white/50">
                          📊 Popularity: <span className="text-white/70 font-semibold">{(item.popularityScore * 100).toFixed(0)}%</span>
                        </span>
                        <span className="text-white/50">
                          💰 Margin: <span className="text-white/70 font-semibold">{(item.marginScore * 100).toFixed(0)}%</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${item.potentialRevenueImpact > 0 ? 'text-emerald-400' : 'text-white/40'}`}>
                        {item.potentialRevenueImpact > 0 ? '+' : ''}{Math.round(item.potentialRevenueImpact).toLocaleString()} USD
                      </p>
                      <p className="text-[10px] text-white/30 mt-0.5">potential impact</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendations by quadrant */}
      {selectedQuadrant === 'all' && (
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Strategic Recommendations</h4>
          <div className="grid grid-cols-2 gap-2">
            <ActionChip
              icon={TrendingUp}
              title="Stars"
              action="Maximize promotion & visibility"
              impact={totals.star}
            />
            <ActionChip
              icon={Target}
              title="Plowhorses"
              action="Increase margins; add-on bundles"
              impact={totals.plowhorse}
            />
            <ActionChip
              icon={Lightbulb}
              title="Puzzles"
              action="Boost popularity via marketing"
              impact={totals.puzzle}
            />
            <ActionChip
              icon={AlertTriangle}
              title="Dogs"
              action="Review or discontinue items"
              impact={totals.dog}
            />
          </div>
        </section>
      )}

      {filteredItems.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center">
          <p className="text-sm text-white/40">
            No items in the {selectedQuadrant === 'all' ? 'menu' : QUADRANT_CONFIG[selectedQuadrant].label} quadrant yet.
          </p>
        </div>
      )}
    </div>
  );
}
