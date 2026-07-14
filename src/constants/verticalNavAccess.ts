import type { RoleType } from '@/types/subscription';

/**
 * Same pattern as restaurantNavAccess.ts, for the pharmacy/supermarket
 * verticals — single source of truth for which roles can reach each
 * route, consumed by both App.tsx's RoleRoute and Layout.tsx's sidebar.
 * Fashion/electronics/mobile/retail have no real routes yet (their nav
 * items carry no `href`), so nothing to gate there.
 */
export const PHARMACY_ROUTE_ROLES: Record<string, RoleType[]> = {
  '/pharmacy': ['owner', 'admin', 'manager', 'cashier'],
  '/pharmacy/drugs': ['owner', 'admin', 'manager', 'cashier'],
  '/pharmacy/prescriptions': ['owner', 'admin', 'manager', 'cashier'],
  '/pharmacy/narcotics': ['owner', 'admin'],
  // Role-native hubs (mirrors restaurant's Waiter/Stockkeeper/Operations
  // pattern) -- /restaurant/accountant is a deliberately shared route,
  // AccountantHomeHub.tsx is industry-agnostic, see postLoginRoute.ts.
  '/pharmacy/counter': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/pharmacy/stockkeeper': ['owner', 'admin', 'manager', 'supervisor', 'stockkeeper'],
  '/pharmacy/operations': ['owner', 'admin', 'manager', 'supervisor'],
  '/restaurant/accountant': ['owner', 'admin', 'manager', 'accountant'],
};

export const SUPERMARKET_ROUTE_ROLES: Record<string, RoleType[]> = {
  '/supermarket': ['owner', 'admin', 'manager', 'cashier', 'stockkeeper'],
  '/supermarket/departments': ['owner', 'admin', 'manager', 'stockkeeper'],
  '/supermarket/shelf-life': ['owner', 'admin', 'manager', 'stockkeeper'],
  // Role-native hubs (mirrors restaurant's Stockkeeper/Operations pattern)
  // -- /restaurant/accountant is a deliberately shared route,
  // AccountantHomeHub.tsx is industry-agnostic, see postLoginRoute.ts.
  '/supermarket/stockkeeper': ['owner', 'admin', 'manager', 'supervisor', 'stockkeeper'],
  '/supermarket/operations': ['owner', 'admin', 'manager', 'supervisor'],
  '/restaurant/accountant': ['owner', 'admin', 'manager', 'accountant'],
};

export function getPharmacyRouteRoles(path: string): RoleType[] {
  return PHARMACY_ROUTE_ROLES[path] ?? [];
}

export function getSupermarketRouteRoles(path: string): RoleType[] {
  return SUPERMARKET_ROUTE_ROLES[path] ?? [];
}
