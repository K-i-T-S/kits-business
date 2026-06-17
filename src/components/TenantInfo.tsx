import React from 'react';

import { useApp } from '../context/AppContext';

interface TenantInfoProps {
  className?: string;
}

export function TenantInfo({ className = '' }: TenantInfoProps) {
  const { currentTenant } = useApp();

  if (!currentTenant) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-sm font-medium">
        {currentTenant.name}
      </div>
      <div className="px-2 py-1 bg-white/10 text-white/60 border border-white/10 rounded-full text-xs capitalize">
        {currentTenant.userRole}
      </div>
    </div>
  );
}

export default TenantInfo;
