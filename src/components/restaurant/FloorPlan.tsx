import { DndContext, PointerSensor, useSensor, useSensors, useDraggable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { RestaurantTable, TableStatus } from '@/types/restaurant';
import { STATUS_COLORS } from '@/types/restaurant';

interface DraggableTableCardProps {
  table: RestaurantTable;
  selected: boolean;
  onSelect: () => void;
  activeOrderCount: number;
}

function DraggableTableCard({ table, selected, onSelect, activeOrderCount }: DraggableTableCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: table.id });

  const cfg = STATUS_COLORS[table.status];
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${table.x}%`,
    top: `${table.y}%`,
    zIndex: isDragging ? 50 : selected ? 20 : 10,
    transform: CSS.Translate.toString(transform),
    touchAction: 'none',
    opacity: isDragging ? 0.8 : 1,
  };

  const statusLabel = {
    available: t('restaurant.status.available', 'Available'),
    occupied: t('restaurant.status.occupied', 'Occupied'),
    reserved: t('restaurant.status.reserved', 'Reserved'),
    cleaning: t('restaurant.status.cleaning', 'Cleaning'),
  }[table.status];

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 ${cfg.bg} ${cfg.border} transition-all duration-200 ${
          selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''
        } ${isDragging ? 'shadow-2xl shadow-black/40' : 'shadow-lg'}`}
        style={{ width: 90, height: 90 }}
      >
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="absolute top-1 right-1 cursor-grab rounded p-0.5 hover:bg-white/10 active:cursor-grabbing"
          title={t('restaurant.dragTable', 'Drag to move')}
        >
          <GripVertical className="h-3 w-3 text-white/30" />
        </div>

        {/* Active order badge */}
        {activeOrderCount > 0 && (
          <div className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white shadow-lg">
            {activeOrderCount}
          </div>
        )}

        {/* Table card body */}
        <button
          onClick={onSelect}
          className="flex flex-col items-center gap-0.5 px-2 text-center"
          aria-label={`Table ${table.number} — ${statusLabel}`}
          aria-pressed={selected}
        >
          <span className="text-base font-bold text-white leading-none">T{table.number}</span>
          {table.name && (
            <span className="text-[9px] text-white/50 leading-none truncate max-w-[70px]">{table.name}</span>
          )}
          <span className="text-[10px] text-white/60">{table.seats}p</span>
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${cfg.text}`}>{statusLabel}</span>
        </button>
      </div>
    </div>
  );
}

interface FloorPlanProps {
  tables: RestaurantTable[];
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
  onMoveTable: (id: string, x: number, y: number) => void;
  onAddTable: () => void;
  activeOrdersByTable: Record<string, number>;
}

export default function FloorPlan({
  tables,
  selectedTableId,
  onSelectTable,
  onMoveTable,
  onAddTable,
  activeOrdersByTable,
}: FloorPlanProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (!containerRef.current) return;
    const container = containerRef.current.getBoundingClientRect();

    const table = tables.find((t) => t.id === active.id);
    if (!table) return;

    const deltaXPct = (delta.x / container.width) * 100;
    const deltaYPct = (delta.y / container.height) * 100;

    const newX = Math.max(0, Math.min(90, table.x + deltaXPct));
    const newY = Math.max(0, Math.min(90, table.y + deltaYPct));

    onMoveTable(String(active.id), newX, newY);
  };

  const tableSectionLabels: Record<string, string> = {
    indoor: t('restaurant.section.indoor', 'Indoor'),
    terrace: t('restaurant.section.terrace', 'Terrace'),
    bar: t('restaurant.section.bar', 'Bar'),
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {(['available', 'occupied', 'reserved', 'cleaning'] as TableStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[s].dot}`} />
            <span className="text-white/50 capitalize">{t(`restaurant.status.${s}`, s)}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">1</div>
          <span className="text-white/50">{t('restaurant.openOrders', 'Open orders')}</span>
        </div>
      </div>

      {/* Floor plan canvas */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50"
          style={{ height: 480 }}
        >
          {/* Section labels */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-3 left-3 rounded-lg bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/20">
              {tableSectionLabels['indoor']}
            </div>
          </div>

          {/* Grid dots background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-white/30 text-sm">{t('restaurant.noTables', 'No tables yet — add your first table')}</p>
            </div>
          )}

          {tables.map((table) => (
            <DraggableTableCard
              key={table.id}
              table={table}
              selected={selectedTableId === table.id}
              onSelect={() => onSelectTable(table.id)}
              activeOrderCount={activeOrdersByTable[table.id] ?? 0}
            />
          ))}
        </div>
      </DndContext>

      {/* Add table button */}
      <button
        onClick={onAddTable}
        className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-2.5 text-sm text-white/40 transition-all hover:border-indigo-500/50 hover:text-indigo-400"
      >
        <Plus className="h-4 w-4" />
        {t('restaurant.addTable', 'Add Table')}
      </button>
    </div>
  );
}
