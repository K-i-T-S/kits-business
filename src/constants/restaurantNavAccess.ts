import type { RoleType } from '@/types/subscription';

/**
 * Single source of truth for which roles can reach each /restaurant/*
 * route — consumed by both App.tsx's RoleRoute allowedRoles (access
 * control) and Layout.tsx's sidebar (nav visibility), so the two can
 * never drift the way Dashboard.tsx's separate ROLE_REDIRECT map and
 * Track 2's resolveRoleHomeRoute() did (found via a live production
 * test, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 */
export const RESTAURANT_ROUTE_ROLES: Record<string, RoleType[]> = {
  '/restaurant': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/tables': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/kds': ['owner', 'admin', 'manager', 'supervisor', 'cashier', 'stockkeeper'],
  '/restaurant/reservations': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/waiter': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/argile': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/recipes': ['owner', 'admin', 'manager', 'supervisor', 'stockkeeper'],
  '/restaurant/operations': ['owner', 'admin', 'manager', 'supervisor'],
  '/restaurant/reception': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/accountant': ['owner', 'admin', 'manager', 'accountant'],
  '/restaurant/stockkeeper': ['owner', 'admin', 'manager', 'stockkeeper'],
  '/restaurant/analytics': ['owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'viewer'],
  '/restaurant/shifts': ['owner', 'admin', 'manager'],
  '/restaurant/eod': ['owner', 'admin', 'manager', 'cashier'],
  '/restaurant/tips': ['owner', 'admin', 'manager'],
  '/restaurant/menu': ['owner', 'admin', 'manager', 'supervisor'],
  '/restaurant/branches': ['owner', 'admin'],
  '/restaurant/settings': ['owner', 'admin'],
  '/restaurant/ai': ['owner', 'admin', 'manager'],
  '/restaurant/delivery': ['owner', 'admin', 'manager'],
  '/restaurant/delivery-orders': ['owner', 'admin', 'manager', 'cashier'],
  '/restaurant/waitlist': ['owner', 'admin', 'manager', 'supervisor', 'cashier'],
  '/restaurant/cash': ['owner', 'admin', 'manager', 'cashier'],
  '/restaurant/events': ['owner', 'admin', 'manager'],
};

/**
 * Fail-closed accessor — an unrecognized path grants nobody access rather
 * than falling through to `undefined` (which RoleRoute's `allowedRoles`
 * prop doesn't accept) or an accidentally-open route.
 */
export function getRestaurantRouteRoles(path: string): RoleType[] {
  return RESTAURANT_ROUTE_ROLES[path] ?? [];
}
