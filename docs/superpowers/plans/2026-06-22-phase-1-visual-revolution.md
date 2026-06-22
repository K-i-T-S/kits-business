# Phase 1: Visual Revolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform KiTS Restaurant OS into a visually stunning, real-time operational hub with 3D floor plans, live metrics, premium dark luxury design, and Framer Motion animations — completing the "Visual Revolution" phase.

**Architecture:** 
- Install and configure 3D rendering stack (react-three-fiber, Nivo charts, Framer Motion)
- Build a new RestaurantHub landing page with 3D isometric floor plan as centerpiece
- Implement AnalyticsCommandCenter with live KPI cards, revenue calendars, and performance metrics
- Replace all polling (`setInterval`) with Supabase real-time channels for instant updates
- Redesign WaiterInterface for thumb-zone mobile-first interaction
- Apply consistent dark luxury design tokens and animation language across all restaurant pages
- Enable offline-first PWA foundation (Vite PWA plugin + Dexie)

**Tech Stack:** 
- React 18 / Vite / TypeScript strict
- `react-three-fiber` + `drei` (3D floor plan)
- `framer-motion` (animations)
- `@nivo/core` + `@nivo/calendar` / `stream` / `line` / `bar` (analytics charts)
- `dexie` + `dexie-react-hooks` (offline local DB)
- `vite-plugin-pwa` + `workbox-window` (PWA)
- `date-fns-tz` (timezone: Beirut)

---

## Global Constraints

- **TypeScript strict mode — no `any`** — use `unknown` and narrow, or define proper types in `src/types/restaurant.ts`
- **Every SELECT includes `.eq('tenant_id', tenantId)`** — RLS is non-deterministic; always explicit
- **INSERT includes `tenant_id: tenantId`** — never omitted
- **Mobile-first @ 375px** — test all UI at 375px before 1440px
- **Dark theme only** — `bg-slate-900`, `bg-slate-950`, `bg-white/5`, `bg-white/10` for surfaces; never light backgrounds
- **React Router 7:** `navigate(-1)` returns `void | Promise<void>`; never `onClick={() => navigate(-1)}`
- **Supabase real-time over polling** — replace all `setInterval` with `supabase.channel()` subscriptions
- **Timezone:** All date calculations use `date-fns-tz` with Beirut timezone (`'Asia/Beirut'`)
- **Commits early and often** — create a new commit after each task (not amend)

---

## File Structure Map

### New Files (Create)

```
src/
  constants/
    restaurantColors.ts              # Design system tokens (colors, gradients, glows)
  
  hooks/
    useRestaurantRealtime.ts          # Supabase real-time subscriptions (tables, orders, items)
    useOfflineStatus.ts               # Offline detection + pending count
    useDemandForecast.ts              # Placeholder for Phase 2 demand forecast hook
  
  components/restaurant/
    FloorPlan3D.tsx                   # Hero 3D component (canvas, tables, badges)
    Table3D.tsx                       # Extracted Table3D mesh (reusable)
    FloorPlan2D.tsx                   # 2D canvas fallback (Konva)
    FloorPlanAuto.tsx                 # WebGL detection → 3D or 2D
    MenuBrowserSheet.tsx              # Full-screen bottom sheet (categories, search, grid)
    OfflineBanner.tsx                 # Persistent banner at top (🔴 OFFLINE)
    KPICard.tsx                       # Reusable animated metric card (react-countup)
    SlowAlertFeed.tsx                 # Real-time slow table alerts (list)
    AIUpsellBanner.tsx                # "Guests who ordered X also loved Y" prompt
  
  pages/restaurant/
    RestaurantHub.tsx                 # NEW: Landing page (3D floor + metrics sidebar + toggles)
    AnalyticsCommandCenter.tsx        # Extended: Nivo charts, KPI row, forecast, matrix
  
  utils/
    restaurantDB.ts                   # Dexie.js offline DB schema + operations
    offlineOrderQueue.ts              # Queueing logic (queue order items on INSERT fail)
    restaurantColors.ts               # (moved to constants/restaurantColors.ts)
    restaurantColorsUtil.ts           # Color utility functions (hexToRgb, hexToGlow, etc.)
```

### Modified Files (Existing)

```
src/
  App.tsx                             # Add lazy routes: RestaurantHub, AnalyticsCommandCenter, etc.
  types/
    restaurant.ts                     # Add: DemandForecast, MenuItemEngineering, UpsellSuggestion types
  pages/restaurant/
    WaiterInterface.tsx               # Redesign: bottom nav tabs, thumb-zone layout, FAB
    TableManagement.tsx               # Apply animations + use real-time hook
    KitchenDisplay.tsx                # Use real-time hook, replace polling
  vite.config.ts                      # Add VitePWA plugin config
  providers/QueryProvider.tsx         # Ensure TanStack Query is initialized
```

---

## Task Breakdown

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: Nothing (starting point)
- Produces: All Phase 1 libraries available in node_modules

- [ ] **Step 1: Install 3D + animation + chart dependencies**

```bash
npm install three @react-three/fiber @react-three/drei @use-gesture/react
npm install konva react-konva
npm install framer-motion lottie-react react-countup
npm install @nivo/core @nivo/line @nivo/bar @nivo/pie @nivo/calendar @nivo/stream @nivo/sankey @nivo/bump @nivo/heatmap
npm install dexie dexie-react-hooks
npm install -D vite-plugin-pwa workbox-window
npm install date-fns-tz
npm install react-intersection-observer
```

- [ ] **Step 2: Verify installation**

```bash
npm list three @react-three/fiber framer-motion @nivo/core dexie vite-plugin-pwa
```

Expected: All packages listed with versions >= those in f&b-development.md Section 3.1

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Phase 1 dependencies (3D, animation, charting, offline, PWA)"
```

---

### Task 2: Create Design System Tokens

**Files:**
- Create: `src/constants/restaurantColors.ts`

**Interfaces:**
- Consumes: Nothing
- Produces: `RESTAURANT_COLORS` object exported with shape:
  ```typescript
  {
    available: { fill, emissive, glow },
    occupied: { fill, emissive, glow },
    reserved: { fill, emissive, glow },
    cleaning: { fill, emissive, glow },
    alert: { fill, emissive, glow },
    base, surface, elevated, glass, border,
    primary, gold, premium
  }
  ```

- [ ] **Step 1: Create restaurantColors.ts**

```typescript
// src/constants/restaurantColors.ts
/**
 * KiTS Restaurant Design System — Dark Luxury Palette
 * Used across 3D floor plan, KDS, waiter interface, analytics
 */

export const RESTAURANT_COLORS = {
  // Table status (used in 3D and 2D floor plan)
  available: {
    fill: '#10b981',
    emissive: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    tailwind: 'bg-emerald-500'
  },
  occupied: {
    fill: '#f59e0b',
    emissive: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    tailwind: 'bg-amber-500'
  },
  reserved: {
    fill: '#8b5cf6',
    emissive: '#8b5cf6',
    glow: 'rgba(139,92,246,0.3)',
    tailwind: 'bg-violet-500'
  },
  cleaning: {
    fill: '#64748b',
    emissive: '#64748b',
    glow: 'transparent',
    tailwind: 'bg-slate-500'
  },
  alert: {
    fill: '#ef4444',
    emissive: '#ef4444',
    glow: 'rgba(239,68,68,0.4)',
    tailwind: 'bg-red-500'
  },

  // Backgrounds
  base: '#0a0f1e',        // Deepest dark navy — page background
  surface: '#111827',     // Cards, panels (Tailwind: slate-900)
  elevated: '#1e2d40',    // Modals, dropdowns (blue tint)
  glass: 'rgba(255,255,255,0.04)',  // Glassmorphism surface
  border: 'rgba(255,255,255,0.08)',

  // Accents
  primary: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',  // Indigo→Sky
  gold: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',      // AI features
  premium: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',   // Enterprise

  // Text
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.8)',
  textTertiary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
} as const;

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'alert';

/**
 * Utility: Get color set for a table status
 */
export function getTableStatusColor(status: TableStatus) {
  return RESTAURANT_COLORS[status];
}

/**
 * Utility: Hex to RGBA for three.js emissive intensity blending
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit src/constants/restaurantColors.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/constants/restaurantColors.ts
git commit -m "design: add restaurant color system (dark luxury palette)"
```

---

### Task 3: Create Dexie Offline Database

**Files:**
- Create: `src/utils/restaurantDB.ts`

**Interfaces:**
- Consumes: `dexie`, `dexie-react-hooks`
- Produces: `RestaurantDB` class, `restaurantDB` singleton, types:
  ```typescript
  interface OfflineOrder { id, tenantId, tableId, orderId, items, createdAt, synced }
  interface OfflineMenuCache { tenantId, categories, items, cachedAt }
  ```

- [ ] **Step 1: Create restaurantDB.ts**

```typescript
// src/utils/restaurantDB.ts
import Dexie, { Table } from 'dexie';
import type { RestaurantMenuCategory, RestaurantMenuItem, RestaurantOrderItem } from '@/types/restaurant';

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
 * Add an order to the offline queue
 */
export async function queueOfflineOrder(order: OfflineOrder): Promise<string> {
  return restaurantDB.offlineOrders.add(order);
}

/**
 * Get all unsynced orders for a tenant
 */
export async function getUnsyncedOrders(tenantId: string): Promise<OfflineOrder[]> {
  return restaurantDB.offlineOrders
    .where('tenantId').equals(tenantId)
    .and(order => !order.synced)
    .toArray();
}

/**
 * Mark an order as synced
 */
export async function markOrderSynced(orderId: string): Promise<void> {
  await restaurantDB.offlineOrders.update(orderId, { synced: true });
}

/**
 * Cache the menu for offline access
 */
export async function cacheMenu(
  tenantId: string,
  categories: RestaurantMenuCategory[],
  items: RestaurantMenuItem[]
): Promise<void> {
  await restaurantDB.menuCache.put({
    tenantId,
    categories,
    items,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Get cached menu (returns null if not cached)
 */
export async function getCachedMenu(tenantId: string): Promise<OfflineMenuCache | undefined> {
  return restaurantDB.menuCache.get(tenantId);
}
```

- [ ] **Step 2: Add types to src/types/restaurant.ts**

Append to `src/types/restaurant.ts`:

```typescript
// Demand Forecasting (Phase 2 placeholder)
export interface DemandForecast {
  date: string;
  dayOfWeek: string;
  predictedCovers: number;
  predictedRevenue: number;
  confidence: number;
  factors: string[];
  prepRecommendations: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    timeSlot: string;
  }>;
  staffingRecommendation: {
    waiters: number;
    kitchen: number;
    argileStaff: number;
  };
}

// Menu Engineering (Phase 2 placeholder)
export interface MenuItemEngineering {
  itemId: string;
  itemName: string;
  popularityScore: number;
  marginScore: number;
  category: 'star' | 'plowhorse' | 'puzzle' | 'dog';
  recommendedAction: string;
  potentialRevenueImpact: number;
}

// Upsell (Phase 2 placeholder)
export interface UpsellSuggestion {
  triggerItemId: string;
  suggestedItemId: string;
  suggestedItemName: string;
  confidence: number;
  supportingText: string;
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit src/utils/restaurantDB.ts src/types/restaurant.ts
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/restaurantDB.ts src/types/restaurant.ts
git commit -m "feat: add Dexie offline order queue + menu cache"
```

---

### Task 4: Create Supabase Real-Time Hook

**Files:**
- Create: `src/hooks/useRestaurantRealtime.ts`

**Interfaces:**
- Consumes: `supabase` client, `tenantId` string
- Produces: Hook that sets up real-time subscriptions for tables/orders/items; returns void (state updates via useEffect)

- [ ] **Step 1: Create useRestaurantRealtime.ts**

```typescript
// src/hooks/useRestaurantRealtime.ts
import { useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import type { RestaurantTable, TableOrder, RestaurantOrderItem } from '@/types/restaurant';

/**
 * Subscribe to real-time changes for restaurant tables, orders, and order items.
 * Replace all polling (setInterval) with this hook.
 *
 * Usage:
 *   useRestaurantRealtime(tenantId, {
 *     onTableChange: (payload) => setTables(...),
 *     onOrderChange: (payload) => setOrders(...),
 *     onOrderItemChange: (payload) => setItems(...),
 *   });
 */
export function useRestaurantRealtime(
  tenantId: string,
  callbacks: {
    onTableChange?: (payload: any) => void;
    onOrderChange?: (payload: any) => void;
    onOrderItemChange?: (payload: any) => void;
  } = {}
): void {
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`restaurant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onTableChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderItemChange?.(payload)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, callbacks]);
}

/**
 * Hook to detect offline status and count pending orders
 */
export function useOfflineStatus(): { isOffline: boolean; pendingCount: number } {
  const [isOffline, setIsOffline] = useOfflineStatusState();
  const [pendingCount, setPendingCount] = useOfflineStatusState();

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      // Sync logic will be implemented in Task X (offline queue manager)
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOffline, pendingCount: 0 }; // pendingCount populated in future task
}

function useOfflineStatusState() {
  const [state, setState] = useOfflineStatusHook();
  return [state, setState];
}

function useOfflineStatusHook() {
  const [offline, setOffline] = useOfflineStateImpl();
  return [offline, setOffline];
}

function useOfflineStateImpl() {
  const [isOffline, setIsOffline] = useOfflineImplHook();
  return [isOffline, setIsOffline];
}

function useOfflineImplHook() {
  return useOfflineHookImpl(!navigator.onLine);
}

function useOfflineHookImpl(initial: boolean) {
  const [state, setState] = useOfflineState(initial);
  return [state, setState];
}

function useOfflineState(initial: boolean) {
  return React.useState(initial);
}
```

Actually, let me simplify this:

```typescript
// src/hooks/useRestaurantRealtime.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

/**
 * Subscribe to real-time changes for restaurant tables, orders, and order items.
 * Replace all polling (setInterval) with this hook.
 */
export function useRestaurantRealtime(
  tenantId: string,
  callbacks: {
    onTableChange?: (payload: any) => void;
    onOrderChange?: (payload: any) => void;
    onOrderItemChange?: (payload: any) => void;
  } = {}
): void {
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`restaurant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onTableChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderItemChange?.(payload)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, callbacks.onTableChange, callbacks.onOrderChange, callbacks.onOrderItemChange]);
}

/**
 * Hook to detect offline status
 */
export function useOfflineStatus(): { isOffline: boolean; pendingCount: number } {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOffline, pendingCount: 0 }; // pendingCount populated in Task X
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/hooks/useRestaurantRealtime.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRestaurantRealtime.ts
git commit -m "feat: add Supabase real-time subscriptions hook (tables, orders, items)"
```

---

### Task 5: Create 3D Floor Plan Component (FloorPlan3D.tsx + Table3D.tsx)

**Files:**
- Create: `src/components/restaurant/FloorPlan3D.tsx`
- Create: `src/components/restaurant/Table3D.tsx`

**Interfaces:**
- Consumes: `react-three-fiber`, `drei`, `framer-motion`, `RESTAURANT_COLORS` from Task 2
- Produces: Exported components:
  ```typescript
  export function Table3D(props: Table3DProps): JSX.Element
  export function FloorPlan3D(props: FloorPlanProps): JSX.Element
  ```

- [ ] **Step 1: Create Table3D.tsx (extracted table mesh)**

```typescript
// src/components/restaurant/Table3D.tsx
import { useSpring, animated } from '@react-spring/three';
import { Text, Float } from '@react-three/drei';
import { RESTAURANT_COLORS, type TableStatus } from '@/constants/restaurantColors';
import type { RestaurantTable } from '@/types/restaurant';

interface OrderInfo {
  total: number;
  covers: number;
  minutesSince: number;
}

interface Table3DProps {
  table: RestaurantTable;
  orderInfo?: OrderInfo;
  onSelect: (tableId: string) => void;
  isSelected: boolean;
}

export function Table3D({ table, orderInfo, onSelect, isSelected }: Table3DProps) {
  const status = (table.status as TableStatus) || 'available';
  const colors = RESTAURANT_COLORS[status];

  // Pulsing animation for alert status
  const { emissiveIntensity } = useSpring({
    from: { emissiveIntensity: 0.2 },
    to: { emissiveIntensity: status === 'alert' ? 0.8 : 0.3 },
    loop: status === 'alert',
    config: { duration: 800 },
  });

  return (
    <group
      position={[(table.position_x || 0) * 20 - 10, 0, (table.position_y || 0) * 20 - 10]}
      onClick={() => onSelect(table.id)}
    >
      {/* Table surface */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.15, 1.8]} />
        <animated.meshStandardMaterial
          color={colors.fill}
          emissive={colors.emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Table number label */}
      <Text position={[0, 0.2, 0]} fontSize={0.4} color={RESTAURANT_COLORS.textPrimary} anchorX="center">
        {table.table_number?.toString() || table.id.slice(0, 4)}
      </Text>

      {/* Order badge (floating above table) */}
      {orderInfo && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.5, 0]}>
            {/* Badge background */}
            <mesh>
              <planeGeometry args={[2, 0.6]} />
              <meshBasicMaterial color={RESTAURANT_COLORS.surface} opacity={0.9} transparent />
            </mesh>
            {/* Badge text */}
            <Text position={[0, 0.1, 0.01]} fontSize={0.2} color="#f59e0b" anchorX="center">
              ${orderInfo.total.toFixed(0)} · {orderInfo.covers}pp · {orderInfo.minutesSince}min
            </Text>
          </group>
        </Float>
      )}
    </group>
  );
}
```

- [ ] **Step 2: Create FloorPlan3D.tsx (main component)**

```typescript
// src/components/restaurant/FloorPlan3D.tsx
import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Table3D } from './Table3D';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import type { RestaurantTable } from '@/types/restaurant';

interface OrderInfo {
  tableId: string;
  total: number;
  covers: number;
  minutesSince: number;
}

interface FloorPlan3DProps {
  tables: RestaurantTable[];
  orders: OrderInfo[];
  selectedTableId?: string;
  onTableSelect: (tableId: string) => void;
  isLoading?: boolean;
}

function FloorPlanContent({ tables, orders, onTableSelect, selectedTableId }: FloorPlan3DProps) {
  const orderMap = useMemo(() => {
    return new Map(orders.map(o => [o.tableId, o]));
  }, [orders]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#6366f1" castShadow />
      <pointLight position={[10, 10, 10]} intensity={0.4} color="#0ea5e9" />

      {/* Floor surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[25, 25]} />
        <meshStandardMaterial color={RESTAURANT_COLORS.base} />
      </mesh>

      {/* Tables */}
      {tables.map(table => (
        <Table3D
          key={table.id}
          table={table}
          orderInfo={orderMap.get(table.id)}
          onSelect={onTableSelect}
          isSelected={selectedTableId === table.id}
        />
      ))}
    </>
  );
}

export function FloorPlan3D({
  tables,
  orders,
  selectedTableId,
  onTableSelect,
  isLoading = false,
}: FloorPlan3DProps) {
  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950">
        <div className="text-white/60">Loading floor plan...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-950">
      <Canvas shadows>
        <Suspense fallback={null}>
          <OrthographicCamera makeDefault position={[0, 20, 0]} zoom={25} />
          <FloorPlanContent
            tables={tables}
            orders={orders}
            selectedTableId={selectedTableId}
            onTableSelect={onTableSelect}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit src/components/restaurant/FloorPlan3D.tsx src/components/restaurant/Table3D.tsx
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/restaurant/FloorPlan3D.tsx src/components/restaurant/Table3D.tsx
git commit -m "feat: create 3D floor plan component with animated tables and order badges"
```

---

### Task 6: Create RestaurantHub Landing Page

**Files:**
- Create: `src/pages/restaurant/RestaurantHub.tsx`

**Interfaces:**
- Consumes: `FloorPlan3D`, `useRestaurantRealtime`, `useOfflineStatus`, `AppContext`
- Produces: Page component exported as default

- [ ] **Step 1: Create RestaurantHub.tsx**

```typescript
// src/pages/restaurant/RestaurantHub.tsx
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { FloorPlan3D } from '@/components/restaurant/FloorPlan3D';
import { useOfflineStatus } from '@/hooks/useRestaurantRealtime';
import { useAppContext } from '@/context/AppContext';

interface OrderInfo {
  tableId: string;
  total: number;
  covers: number;
  minutesSince: number;
}

export default function RestaurantHub() {
  const navigate = useNavigate();
  const { currentTenant, restaurantTables = [], tableOrders = [] } = useAppContext();
  const { isOffline } = useOfflineStatus();
  const [selectedTableId, setSelectedTableId] = useState<string>();
  const [viewMode, setViewMode] = useState<'floor' | 'analytics'>('floor');

  const tenantId = currentTenant?.id;

  // Calculate order info for each table
  const orderInfoMap = useMemo<Map<string, OrderInfo>>(() => {
    const map = new Map();
    tableOrders.forEach(order => {
      if (order.table_id) {
        const items = order.items || [];
        const total = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        const minutesSince = order.created_at
          ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
          : 0;
        map.set(order.table_id, {
          tableId: order.table_id,
          total,
          covers: order.covers || 2,
          minutesSince,
        });
      }
    });
    return map;
  }, [tableOrders]);

  const orders = useMemo(() => Array.from(orderInfoMap.values()), [orderInfoMap]);

  // Live metrics (KPIs)
  const metrics = useMemo(() => {
    const openTables = restaurantTables.filter(t => t.status === 'occupied').length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalCovers = orders.reduce((sum, o) => sum + o.covers, 0);

    return {
      openTables,
      totalRevenue,
      totalCovers,
      avgCheck: totalCovers > 0 ? (totalRevenue / totalCovers).toFixed(2) : '0.00',
    };
  }, [restaurantTables, orders]);

  const handleTableSelect = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    navigate(`/restaurant/waiter?table=${tableId}`);
  }, [navigate]);

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/80 border-b border-white/10 px-6 py-4 flex justify-between items-center"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">{currentTenant?.name || 'Restaurant'}</h1>
          <p className="text-white/60 text-sm">Live Operations Hub</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'floor' ? 'analytics' : 'floor')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
          >
            {viewMode === 'floor' ? '📊 Analytics' : '🎯 Floor'}
          </button>
          <button
            onClick={() => navigate('/restaurant/kds')}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
          >
            Kitchen Display
          </button>
        </div>
      </motion.div>

      {/* Offline Banner */}
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-3 text-red-400 text-sm"
        >
          <span className="text-xl">🔴</span>
          <span>OFFLINE — Orders are saving locally and will sync when connection returns</span>
        </motion.div>
      )}

      {/* Main Content */}
      {viewMode === 'floor' ? (
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Floor Plan (65% width on desktop) */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
            <FloorPlan3D
              tables={restaurantTables}
              orders={orders}
              selectedTableId={selectedTableId}
              onTableSelect={handleTableSelect}
            />
          </motion.div>

          {/* Metrics Sidebar (35% width) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-96 flex flex-col gap-4"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <KPICard label="Open Tables" value={metrics.openTables.toString()} icon="🍽️" />
              <KPICard label="Covers" value={metrics.totalCovers.toString()} icon="👥" />
              <KPICard label="Revenue" value={`$${metrics.totalRevenue.toFixed(2)}`} icon="💰" />
              <KPICard label="Avg Check" value={`$${metrics.avgCheck}`} icon="📊" />
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <ActionButton icon="+" label="New Table Order" onClick={() => navigate('/restaurant/waiter')} />
                <ActionButton icon="📱" label="Scan QR Code" onClick={() => navigate('/menu')} />
                <ActionButton icon="⏱️" label="View Slow Alerts" onClick={() => navigate('/restaurant/analytics')} />
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/60">
          <p>📈 Analytics Command Center — Coming in this phase...</p>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4 hover:border-white/20 transition"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-white/60 text-xs">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition flex items-center gap-2"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/pages/restaurant/RestaurantHub.tsx
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/restaurant/RestaurantHub.tsx
git commit -m "feat: create RestaurantHub landing page with 3D floor plan and live KPIs"
```

---

### Task 7: Create AnalyticsCommandCenter (Nivo Charts + KPI Cards)

**Files:**
- Create: `src/pages/restaurant/AnalyticsCommandCenter.tsx`

**Interfaces:**
- Consumes: `@nivo/calendar`, `@nivo/stream`, `AppContext`, `react-countup`
- Produces: Page component that shows revenue calendar, revenue stream, KPI cards with animations

- [ ] **Step 1: Create AnalyticsCommandCenter.tsx**

```typescript
// src/pages/restaurant/AnalyticsCommandCenter.tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Calendar } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

export default function AnalyticsCommandCenter() {
  const { tableOrders = [] } = useAppContext();

  // Compute metrics
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = tableOrders.filter(o => o.created_at?.startsWith(today));
    
    const revenue = todayOrders.reduce((sum, o) => {
      const items = o.items || [];
      return sum + items.reduce((s, item) => s + ((item.price || 0) * (item.quantity || 1)), 0);
    }, 0);

    const covers = todayOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
    const avgCheck = covers > 0 ? revenue / covers : 0;

    return { revenue, covers, avgCheck, ordersCount: todayOrders.length };
  }, [tableOrders]);

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-4xl font-bold text-white mb-2">Analytics Command Center</h1>
        <p className="text-white/60 mb-8">Today's performance at a glance</p>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KPICard
            label="Today's Revenue"
            value={metrics.revenue}
            prefix="$"
            icon="💰"
            color="from-emerald-500/20"
          />
          <KPICard
            label="Covers"
            value={metrics.covers}
            icon="👥"
            color="from-blue-500/20"
          />
          <KPICard
            label="Average Check"
            value={metrics.avgCheck}
            prefix="$"
            icon="🧾"
            color="from-amber-500/20"
          />
          <KPICard
            label="Orders"
            value={metrics.ordersCount}
            icon="📋"
            color="from-violet-500/20"
          />
        </div>

        {/* Placeholder sections for later */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-white/10 rounded-xl p-8 text-center text-white/60"
        >
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>Revenue Calendar, Stream Charts, Menu Matrix, and Forecast coming in Phase 1...</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function KPICard({
  label,
  value,
  prefix = '',
  icon,
  color,
}: {
  label: string;
  value: number;
  prefix?: string;
  icon: string;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-gradient-to-br ${color} to-slate-900 border border-white/10 rounded-xl p-6 hover:border-white/20 transition`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/60 text-sm mb-2">{label}</p>
          <p className="text-white text-3xl font-bold">
            {prefix}
            <CountUp end={value} duration={1} decimals={value < 100 ? 2 : 0} />
          </p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/pages/restaurant/AnalyticsCommandCenter.tsx
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/restaurant/AnalyticsCommandCenter.tsx
git commit -m "feat: create AnalyticsCommandCenter with animated KPI cards (Phase 1 foundation)"
```

---

### Task 8: Update App.tsx Routes

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Existing router setup
- Produces: Three new lazy routes added

- [ ] **Step 1: Add lazy imports and routes in App.tsx**

Find the lazy route imports section (around line 30-50) and add:

```typescript
const RestaurantHub = lazy(() => import('./pages/restaurant/RestaurantHub'));
const AnalyticsCommandCenter = lazy(() => import('./pages/restaurant/AnalyticsCommandCenter'));
const OldTableManagement = lazy(() => import('./pages/restaurant/TableManagement'));
```

Then find the route definitions and update/add the restaurant routes:

```typescript
// In the router path definition, find the restaurant sub-routes and update:
{
  path: '/restaurant',
  element: <RestaurantHub />, // NEW: Replace redirect
},
{
  path: '/restaurant/analytics',
  element: <AnalyticsCommandCenter />, // NEW
},
{
  path: '/restaurant/tables',
  element: <OldTableManagement />, // Existing, keep as-is
},
// ... other routes remain unchanged
```

- [ ] **Step 2: Verify compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 3: Test build**

```bash
npm run build
```

Expected: Build succeeds without errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add RestaurantHub and AnalyticsCommandCenter routes"
```

---

### Task 9: Refactor WaiterInterface for Thumb-Zone Layout

**Files:**
- Modify: `src/pages/restaurant/WaiterInterface.tsx`

**Interfaces:**
- Consumes: Existing WaiterInterface props and state
- Produces: Redesigned layout with bottom navigation tabs and thumb-zone FAB

- [ ] **Step 1: Restructure WaiterInterface.tsx layout**

Replace the entire component export with this structure (keep existing logic, just reorganize layout):

```typescript
// src/pages/restaurant/WaiterInterface.tsx
import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, SendHorizontal, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

export default function WaiterInterface() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTenant, restaurantTables = [], tableOrders = [] } = useAppContext();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    searchParams.get('table') || null
  );
  const [activeTab, setActiveTab] = useState<'tables' | 'orders' | 'queue' | 'pending'>('tables');

  const selectedTable = useMemo(
    () => restaurantTables.find(t => t.id === selectedTableId),
    [selectedTableId, restaurantTables]
  );

  const selectedOrder = useMemo(
    () => tableOrders.find(o => o.table_id === selectedTableId),
    [selectedTableId, tableOrders]
  );

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col">
      {/* Top Bar (Read-Only) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border-b border-white/10 px-6 py-4 flex justify-between items-center"
      >
        <div>
          <h2 className="text-lg font-bold text-white">{currentTenant?.name || 'Restaurant'}</h2>
          <p className="text-white/60 text-xs">Shift: Lunch • 11 Pending Orders</p>
        </div>
        <div className="flex gap-2">
          {/* Pending Orders Badge */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="relative px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium"
          >
            📱 3 QR Orders
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <motion.div
              key="tables"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 grid grid-cols-2 gap-3"
            >
              {restaurantTables.map(table => (
                <motion.button
                  key={table.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`p-4 rounded-xl border-2 transition ${
                    selectedTableId === table.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-white/10 bg-slate-900/50 hover:border-white/20'
                  }`}
                >
                  <p className="text-2xl font-bold text-white">{table.table_number}</p>
                  <p className={`text-xs ${
                    table.status === 'occupied' ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {table.status === 'occupied' ? '🔴 Occupied' : '🟢 Free'}
                  </p>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Other Tabs (Placeholder) */}
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 text-white/60 text-center py-20"
            >
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>My Orders — Coming soon</p>
            </motion.div>
          )}

          {activeTab === 'queue' && (
            <motion.div
              key="queue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 text-white/60 text-center py-20"
            >
              <SendHorizontal className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Send Queue — Coming soon</p>
            </motion.div>
          )}

          {activeTab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 text-white/60 text-center py-20"
            >
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Pending QR Orders — Coming soon</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation (Primary Action Zone) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border-t border-white/10 grid grid-cols-4 gap-2 p-3"
      >
        {[
          { id: 'tables' as const, icon: '🍽️', label: 'Tables' },
          { id: 'orders' as const, icon: '🛒', label: 'Orders' },
          { id: 'queue' as const, icon: '📤', label: 'Queue' },
          { id: 'pending' as const, icon: '⏳', label: 'Pending' },
        ].map(tab => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 rounded-xl font-medium text-sm transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <div className="text-lg mb-1">{tab.icon}</div>
            <div>{tab.label}</div>
          </motion.button>
        ))}
      </motion.div>

      {/* FAB (Floating Action Button) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/50 transition"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/pages/restaurant/WaiterInterface.tsx
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/restaurant/WaiterInterface.tsx
git commit -m "refactor: WaiterInterface for thumb-zone mobile-first design with bottom nav"
```

---

### Task 10: Add Vite PWA Plugin Configuration

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Existing vite.config.ts
- Produces: PWA configuration with service worker and cache strategies

- [ ] **Step 1: Update vite.config.ts with VitePWA**

Find the existing `plugins: [` array and add VitePWA:

```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // ... existing plugins ...
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'KiTS Restaurant OS',
        short_name: 'KiTS',
        description: 'Restaurant Management Platform',
        theme_color: '#0a0f1e',
        background_color: '#0a0f1e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 100x100 (existing favicon, or create PWA icon)',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/your-supabase-url\.supabase\.co\/rest\/v1\/restaurant_menu/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'menu-api',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 24 * 60 * 60, // 1 day
              },
            },
          },
          {
            urlPattern: /^https:\/\/your-supabase-url\.supabase\.co\/storage\/v1\/object\/public\/menu-images/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'menu-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 2: Verify vite.config.ts compiles**

```bash
npx tsc --noEmit vite.config.ts
```

Expected: No errors (or only unused variable warnings)

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: configure Vite PWA plugin with offline caching strategies"
```

---

### Task 11: Apply Framer Motion Animations Across Pages

**Files:**
- Modify: `src/pages/restaurant/TableManagement.tsx` (or similar existing pages)
- Modify: `src/components/restaurant/KitchenDisplay.tsx`

**Interfaces:**
- Consumes: Existing component structure + `framer-motion`
- Produces: Wrapped components with entrance animations, hover effects, status transitions

- [ ] **Step 1: Add animation variants helper**

Create `src/utils/animationVariants.ts`:

```typescript
// src/utils/animationVariants.ts
export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

export const itemVariants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

export const statusVariants = {
  available: { scale: 1, opacity: 1 },
  occupied: { scale: 1.02, opacity: 1 },
  alert: {
    scale: 1,
    opacity: [1, 0.7, 1],
    transition: { repeat: Infinity, duration: 1 },
  },
};

export const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};
```

- [ ] **Step 2: Apply animations to TableManagement.tsx**

Wrap your table cards/list with:

```typescript
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '@/utils/animationVariants';

// Wrap container:
<motion.div
  variants={containerVariants}
  initial="initial"
  animate="animate"
  className="grid grid-cols-2 gap-4"
>
  {tables.map((table, index) => (
    <motion.div key={table.id} variants={itemVariants}>
      {/* table card content */}
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit src/utils/animationVariants.ts src/pages/restaurant/TableManagement.tsx
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/animationVariants.ts src/pages/restaurant/TableManagement.tsx
git commit -m "feat: add Framer Motion animations (entrance, status, stagger) across pages"
```

---

### Task 12: Test Phase 1 End-to-End

**Files:**
- Test: All new components via manual verification

**Interfaces:**
- Consumes: Running dev server, browser
- Produces: Verified functionality

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:5173`

- [ ] **Step 2: Navigate to RestaurantHub**

In browser: `http://localhost:5173/restaurant`

Expected:
- 3D floor plan visible (if WebGL available)
- Tables rendered with colors
- KPI sidebar on the right
- "Floor" / "Analytics" toggle works
- Offline banner visible if offline

- [ ] **Step 3: Test WaiterInterface redesign**

Navigate: `http://localhost:5173/restaurant/waiter`

Expected:
- Bottom navigation tabs visible (Tables, Orders, Queue, Pending)
- Clicking tabs changes content
- FAB button visible bottom-right
- Tab labels clearly visible
- Smooth transitions between tabs

- [ ] **Step 4: Test AnalyticsCommandCenter**

Click "Analytics" toggle from RestaurantHub

Expected:
- KPI cards display (Revenue, Covers, Avg Check, Orders)
- Values animate with react-countup
- Cards hover smoothly
- No errors in console

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 6: Run build**

```bash
npm run build
```

Expected: Build succeeds, output in `build/` directory

- [ ] **Step 7: Commit final verification**

```bash
git add -A
git commit -m "test: verify Phase 1 components (3D, real-time, redesigned UI, animations)"
```

---

## Summary of Deliverables

**Phase 1 complete delivers:**
1. ✅ 3D floor plan with animated tables and order badges (react-three-fiber)
2. ✅ RestaurantHub landing page with toggle to Analytics
3. ✅ AnalyticsCommandCenter with live KPI cards (react-countup)
4. ✅ Supabase real-time subscriptions (replaces polling)
5. ✅ Redesigned WaiterInterface (thumb-zone + bottom navigation)
6. ✅ Framer Motion animations across pages
7. ✅ Dark luxury design tokens (RESTAURANT_COLORS)
8. ✅ Dexie offline DB foundation (for Phase 3)
9. ✅ Vite PWA configuration (for Phase 3)

**Not in Phase 1 (pushed to Phase 2+):**
- AI assistant chat interface
- Demand forecasting
- Menu engineering matrix
- Upsell engine
- Full offline sync logic
- Delivery aggregation

---

## Testing Checklist

- [ ] 3D floor plan renders without WebGL fallback errors
- [ ] Table status colors update in real-time
- [ ] KPI cards animate smoothly on load
- [ ] WaiterInterface tabs switch without lag
- [ ] Bottom navigation is accessible on mobile (375px)
- [ ] Framer Motion animations don't cause layout shift
- [ ] TypeScript strict mode passes
- [ ] Build succeeds without warnings
- [ ] Dark theme consistent (no light backgrounds)
- [ ] All routes accessible from App.tsx
