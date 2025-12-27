import React, { memo } from 'react';
import { Activity, Package } from 'lucide-react';

interface NotificationItemProps {
  type: 'order' | 'stock';
  title: string;
  description: string;
  time: string;
}

const NotificationItem = memo(({ type, title, description, time }: NotificationItemProps) => {
  const icons = {
    order: Activity,
    stock: Package
  };

  const colors = {
    order: 'bg-indigo-500/20 text-indigo-400',
    stock: 'bg-green-500/20 text-green-400'
  };

  const Icon = icons[type];

  return (
    <div className="p-4 hover:bg-white/5 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={`h-8 w-8 rounded-full ${colors[type]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-white font-medium">{title}</p>
          <p className="text-xs text-white/60 mt-1">{description}</p>
          <p className="text-xs text-indigo-400 mt-2">{time}</p>
        </div>
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

export default NotificationItem;
