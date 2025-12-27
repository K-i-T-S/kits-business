import React from 'react';
import { Shield, Lock, Eye, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('owner' | 'manager' | 'cashier' | 'viewer')[];
  fallback?: React.ReactNode;
}

export default function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { currentTenant } = useApp();

  if (!currentTenant) {
    return fallback || <div className="text-white/60">Loading...</div>;
  }

  const hasPermission = allowedRoles.includes(currentTenant.userRole);

  if (!hasPermission) {
    return fallback || (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Shield className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Access Restricted</h3>
        <p className="text-white/60">
          You need {allowedRoles.join(' or ')} permissions to view this content.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// Permission constants for easy reference
export const PERMISSIONS = {
  // Owner permissions - full access
  OWNER: ['owner'] as string[],
  
  // Management permissions - can manage most things
  MANAGEMENT: ['owner', 'manager'] as string[],
  
  // Staff permissions - can process sales and view basic reports
  STAFF: ['owner', 'manager', 'cashier'] as string[],
  
  // All users - including viewers
  ALL: ['owner', 'manager', 'cashier', 'viewer'] as string[],
  
  // Specific permissions
  CAN_MANAGE_EMPLOYEES: ['owner', 'manager'] as string[],
  CAN_MANAGE_PRODUCTS: ['owner', 'manager'] as string[],
  CAN_PROCESS_SALES: ['owner', 'manager', 'cashier'] as string[],
  CAN_VIEW_REPORTS: ['owner', 'manager', 'cashier', 'viewer'] as string[],
  CAN_MANAGE_SETTINGS: ['owner'] as string[],
};

// Hook for checking permissions
export function usePermissions() {
  const { currentTenant } = useApp();

  const hasPermission = (requiredRoles: string[]) => {
    if (!currentTenant) return false;
    return requiredRoles.includes(currentTenant.userRole);
  };

  const canManageEmployees = hasPermission(PERMISSIONS.CAN_MANAGE_EMPLOYEES);
  const canManageProducts = hasPermission(PERMISSIONS.CAN_MANAGE_PRODUCTS);
  const canProcessSales = hasPermission(PERMISSIONS.CAN_PROCESS_SALES);
  const canViewReports = hasPermission(PERMISSIONS.CAN_VIEW_REPORTS);
  const canManageSettings = hasPermission(PERMISSIONS.CAN_MANAGE_SETTINGS);

  return {
    currentRole: currentTenant?.userRole,
    hasPermission,
    canManageEmployees,
    canManageProducts,
    canProcessSales,
    canViewReports,
    canManageSettings,
  };
}

// Role-specific UI components
export function RoleBadge({ role }: { role: string }) {
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'owner':
        return {
          label: 'Owner',
          color: 'bg-purple-100 text-purple-700 border-purple-200',
          icon: Settings,
          description: 'Full access to all features'
        };
      case 'manager':
        return {
          label: 'Manager',
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: Shield,
          description: 'Can manage team and operations'
        };
      case 'cashier':
        return {
          label: 'Cashier',
          color: 'bg-green-100 text-green-700 border-green-200',
          icon: Eye,
          description: 'Can process sales and view reports'
        };
      case 'viewer':
        return {
          label: 'Viewer',
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Lock,
          description: 'Read-only access to data'
        };
      default:
        return {
          label: role,
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Lock,
          description: 'Unknown role'
        };
    }
  };

  const roleInfo = getRoleInfo(role);
  const Icon = roleInfo.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${roleInfo.color} text-xs font-medium`}>
      <Icon className="h-3 w-3" />
      <span>{roleInfo.label}</span>
    </div>
  );
}
