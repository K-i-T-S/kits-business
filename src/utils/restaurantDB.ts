import Dexie from 'dexie';
import type { Table } from 'dexie';

import type { RestaurantOrderItem, RestaurantMenuCategory, RestaurantMenuItem } from '@/types/restaurant';

export interface OfflineOrder {
  id: string;
  tenantId: string;
  tableId: string;
  orderId: string;
  items: RestaurantOrderItem[];
  createdAt: string;
  synced: boolean;
}

export interface OfflineMenuCache {
  tenantId: string;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  cachedAt: string;
}

export class RestaurantDB extends Dexie {
  offlineOrders!: Table<OfflineOrder>;
  menuCache!: Table<OfflineMenuCache>;

  constructor() {
    super('kits-restaurant');
    this.version(1).stores({
      offlineOrders: 'id, tenantId, synced',
      menuCache: 'tenantId',
    });
  }
}

export const restaurantDB = new RestaurantDB();

/**
 * Queue an offline order to be synced when connection returns
 */
export async function queueOfflineOrder(order: OfflineOrder): Promise<string> {
  const id = (await restaurantDB.offlineOrders.add(order)) as string | number;
  return String(id);
}

/**
 * Get all unsynced orders for a tenant
 */
export async function getUnsyncedOrders(tenantId: string): Promise<OfflineOrder[]> {
  const orders = await restaurantDB.offlineOrders
    .where('tenantId')
    .equals(tenantId)
    .filter((order) => !order.synced)
    .toArray();
  return orders;
}

/**
 * Mark an order as synced
 */
export async function markOrderSynced(orderId: string): Promise<void> {
  await restaurantDB.offlineOrders.update(orderId, { synced: true });
}

/**
 * Cache the restaurant menu locally
 */
export async function cacheMenu(
  tenantId: string,
  categories: RestaurantMenuCategory[],
  items: RestaurantMenuItem[],
): Promise<void> {
  await restaurantDB.menuCache.put({
    tenantId,
    categories,
    items,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Get cached menu for a tenant
 */
export async function getCachedMenu(tenantId: string): Promise<OfflineMenuCache | undefined> {
  return restaurantDB.menuCache.get(tenantId);
}
