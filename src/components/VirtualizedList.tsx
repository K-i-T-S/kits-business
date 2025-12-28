import { AlertTriangle, Package } from 'lucide-react';
import React, { memo, useMemo } from 'react';

interface VirtualizedListProps {
  items: any[];
  height: number;
  itemHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
}

const VirtualizedList = memo(({
  items,
  height,
  itemHeight,
  renderItem,
  className,
}: VirtualizedListProps) => {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(height / itemHeight) + 1,
      items.length,
    );
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
    }));
  }, [items, scrollTop, height, itemHeight]);

  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-10 text-center text-white/60 ${className || ''}`} style={{ height }}>
        <Package className="h-8 w-8 text-white/40" />
        <p className="mt-3 text-sm">No items found</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ height, overflowY: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
            className="px-2"
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

export default VirtualizedList;
