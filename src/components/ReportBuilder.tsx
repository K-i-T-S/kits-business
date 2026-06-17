import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grip, Plus, Trash2, BarChart3, LineChart, PieChart, TrendingUp, Users, DollarSign, Package } from 'lucide-react';
import { useState } from 'react';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export interface ReportWidget {
  id: string;
  type: 'revenue' | 'sales-trend' | 'top-products' | 'payment-methods' | 'employee-performance' | 'kpi-cards';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: number;
}

interface ReportBuilderProps {
  onSave: (widgets: ReportWidget[]) => void;
  onCancel: () => void;
  initialWidgets?: ReportWidget[];
}

const widgetTypes = [
  { value: 'revenue', label: 'Revenue Overview', icon: DollarSign, description: 'Total revenue and profit metrics' },
  { value: 'sales-trend', label: 'Sales Trend', icon: LineChart, description: 'Historical sales data over time' },
  { value: 'top-products', label: 'Top Products', icon: Package, description: 'Best performing products' },
  { value: 'payment-methods', label: 'Payment Methods', icon: PieChart, description: 'Payment distribution' },
  { value: 'employee-performance', label: 'Employee Performance', icon: Users, description: 'Sales by employee' },
  { value: 'kpi-cards', label: 'KPI Cards', icon: TrendingUp, description: 'Key performance indicators' },
];

const widgetSizes = [
  { value: 'small', label: 'Small (1x1)' },
  { value: 'medium', label: 'Medium (2x1)' },
  { value: 'large', label: 'Large (2x2)' },
];

function SortableWidget({ widget, onRemove, onSizeChange }: {
  widget: ReportWidget;
  onRemove: (id: string) => void;
  onSizeChange: (id: string, size: 'small' | 'medium' | 'large') => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const widgetType = widgetTypes.find(w => w.value === widget.type);
  const Icon = widgetType?.icon || BarChart3;

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card className="p-4 bg-white/50 backdrop-blur-sm border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <Grip className="h-4 w-4 text-gray-400" />
            </div>
            <Icon className="h-5 w-5 text-indigo-600" />
            <div>
              <h4 className="font-medium text-gray-900">{widget.title}</h4>
              <p className="text-xs text-gray-500">{widgetType?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={widget.size}
              onValueChange={(value: 'small' | 'medium' | 'large') => onSizeChange(widget.id, value)}
            >
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {widgetSizes.map(size => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(widget.id)}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ReportBuilder({ onSave, onCancel, initialWidgets = [] }: ReportBuilderProps) {
  const [widgets, setWidgets] = useState<ReportWidget[]>(initialWidgets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  const addWidget = () => {
    if (!selectedWidgetType) return;

    const widgetType = widgetTypes.find(w => w.value === selectedWidgetType);
    if (!widgetType) return;

    const newWidget: ReportWidget = {
      id: `${selectedWidgetType}-${Date.now()}`,
      type: selectedWidgetType as ReportWidget['type'],
      title: widgetType.label,
      size: 'medium',
      position: widgets.length,
    };

    setWidgets([...widgets, newWidget]);
    setSelectedWidgetType('');
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const changeWidgetSize = (id: string, size: 'small' | 'medium' | 'large') => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, size } : w));
  };

  const handleSave = () => {
    onSave(widgets);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/10">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">Custom Report Builder</h2>
          <p className="text-white/60 mt-1">Drag and drop widgets to create your custom report</p>
        </div>

        <div className="flex h-[calc(90vh-200px)]">
          {/* Widget Palette */}
          <div className="w-80 border-r border-white/10 p-6 overflow-y-auto">
            <h3 className="font-semibold text-white mb-4">Add Widgets</h3>

            <div className="space-y-4">
              <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select widget type" />
                </SelectTrigger>
                <SelectContent>
                  {widgetTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={addWidget}
                disabled={!selectedWidgetType}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>

              <div className="mt-6">
                <h4 className="font-medium text-white mb-2">Available Widgets</h4>
                <div className="space-y-2">
                  {widgetTypes.map(type => (
                    <div key={type.value} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4 text-indigo-400" />
                        <span className="font-medium text-sm text-white">{type.label}</span>
                      </div>
                      <p className="text-xs text-white/60 mt-1">{type.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="font-semibold text-white mb-4">Report Canvas</h3>

            {widgets.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No widgets added yet</p>
                <p className="text-sm text-white/40 mt-1">Select a widget type and click "Add Widget" to get started</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                  {widgets.map((widget) => (
                    <SortableWidget
                      key={widget.id}
                      widget={widget}
                      onRemove={removeWidget}
                      onSizeChange={changeWidgetSize}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div className="opacity-50">
                      <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
                        <div className="flex items-center gap-3">
                          <Grip className="h-4 w-4 text-white/40" />
                          <span className="text-white/80">Dragging...</span>
                        </div>
                      </Card>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setWidgets([])}
              disabled={widgets.length === 0}
            >
              Clear All
            </Button>
            <Button onClick={handleSave} disabled={widgets.length === 0}>
              Save Report ({widgets.length} widgets)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
