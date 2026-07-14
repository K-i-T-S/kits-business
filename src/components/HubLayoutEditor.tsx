import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import type { ResolvedHubWidget } from '@/utils/hubWidgetConfig';

interface SortableWidgetRowProps {
  widget: ResolvedHubWidget;
  onToggleVisible: (id: string) => void;
}

function SortableWidgetRow({ widget, onToggleVisible }: SortableWidgetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        widget.visible ? 'border-white/10 bg-slate-900' : 'border-white/5 bg-white/[0.02] opacity-60'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-white/30 hover:text-white/60 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <label className="flex flex-1 items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={widget.visible}
          onChange={() => onToggleVisible(widget.id)}
          className="h-4 w-4 rounded border-white/20 bg-slate-800 accent-indigo-500"
        />
        <span className="text-sm font-medium text-white">{widget.label}</span>
      </label>
    </div>
  );
}

interface HubLayoutEditorProps {
  widgets: ResolvedHubWidget[];
  onChange: (widgets: ResolvedHubWidget[]) => void;
}

/**
 * Toggle-visibility + drag-reorder checklist for a single hub's widgets --
 * same @dnd-kit pattern (SortableContext + arrayMove) as ReportBuilder.tsx.
 * Presentational/controlled only -- SystemSettings.tsx owns load/save.
 */
export function HubLayoutEditor({ widgets, onChange }: HubLayoutEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    onChange(arrayMove(widgets, oldIndex, newIndex));
  };

  const toggleVisible = (id: string) => {
    onChange(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {widgets.map((widget) => (
            <SortableWidgetRow key={widget.id} widget={widget} onToggleVisible={toggleVisible} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
