import React, { useMemo } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { cn } from './utils';

interface VirtualizedTableProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    width?: number;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  height?: number;
  rowHeight?: number;
  className?: string;
  onRowClick?: (row: any, index: number) => void;
}

const VirtualizedTable = React.memo<VirtualizedTableProps>(({
  data,
  columns,
  height = 400,
  rowHeight = 50,
  className,
  onRowClick
}) => {
  const columnWidths = useMemo(() => {
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0);
    const remainingWidth = Math.max(800 - totalWidth, 0);
    const flexibleColumns = columns.filter(col => !col.width).length;
    
    return columns.map(col => ({
      ...col,
      width: col.width || (flexibleColumns > 0 ? remainingWidth / flexibleColumns : 150)
    }));
  }, [columns]);

  const Row = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    
    return (
      <div 
        className={cn(
          "flex items-center border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors",
          "group"
        )}
        style={style}
        onClick={() => onRowClick?.(row, index)}
      >
        {columnWidths.map((column) => (
          <div
            key={column.key}
            className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-gray-600"
            style={{ width: column.width }}
          >
            {column.render ? column.render(row[column.key], row) : row[column.key]}
          </div>
        ))}
      </div>
    );
  });

  Row.displayName = 'VirtualizedTableRow';

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-96 text-gray-500", className)}>
        No data available
      </div>
    );
  }

  return (
    <div className={cn("border border-gray-200 rounded-lg overflow-hidden bg-white", className)}>
      <div className="flex bg-gray-50 border-b border-gray-200">
        {columnWidths.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            style={{ width: column.width }}
          >
            {column.label}
          </div>
        ))}
      </div>
      <div style={{ height }}>
        <AutoSizer
          Child={(props: { width?: number; height?: number }) => (
            <List
              width={props.width || 800}
              height={props.height || 400}
              itemCount={data.length}
              itemSize={rowHeight}
              overscanCount={5}
            >
              {({ index, style }: { index: number; style: React.CSSProperties }) => <Row key={index} index={index} style={style} />}
            </List>
          )}
        />
      </div>
    </div>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

export { VirtualizedTable };
