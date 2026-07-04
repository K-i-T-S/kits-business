# KiTS Restaurant OS — Master Development Plan

> **Audience:** AI agents and developers implementing the F&B vertical  
> **Version:** 2.1 | **Date:** 2026-06-22 | **Phase 1 Status:** ✅ COMPLETE & LIVE  
> **Stack:** React 18 / Vite / TypeScript strict / Supabase PostgREST / Tailwind (dark navy) / react-three-fiber / Framer Motion / Nivo / Dexie.js  
> **Supersedes:** `docs/f&b-plan.md` for all forward-looking work. Read `docs/f&b-plan.md` for what is already implemented.

---

## STATUS & ACCOMPLISHMENTS

### Phase 0: Complete (Prior Work)
- ✅ Bill close / payment flow with dual-currency support
- ✅ Send to KDS button with order status sync
- ✅ QR menu end-to-end (waiter confirm flow)
- ✅ Menu item photo upload to Supabase Storage

### Phase 1: LIVE ON PRODUCTION ✅

**Status:** Complete and deployed to Vercel (2026-06-22)  
**Latest Commit:** 74190572 (fix: resolve WaiterInterface imports and hook destructuring for typecheck)  
**Total Commits:** 13 Phase 1 commits (250371fc → 74190572)  
**Build:** ✓ 21.26s | **TypeCheck:** ✓ Strict mode passes | **PWA:** ✓ Service worker enabled

**What's Live:**
- `/restaurant` — 3D isometric floor plan with real-time table status (green/amber/purple/red)
  - Order badges floating above tables ($total · covers · minutes since order)
  - Live KPI dashboard (Open Tables, Covers, Today Revenue, Avg Check)
  - Toggle to Analytics Command Center view
  - Pulsing alert animation for slow-service tables (>15 min)

- `/restaurant/analytics` — Analytics Command Center
  - 4 animated KPI cards with react-countup
  - Gradient backgrounds per KPI type (emerald/blue/amber/violet)
  - Smooth Framer Motion hover effects
  - Placeholder sections ready for Phase 2 charts

**Infrastructure Delivered:**
- Supabase real-time subscriptions (tables, orders, items) — replaces polling
- Offline-first PWA foundation (Dexie.js local DB + service worker)
- Mobile-first waiter interface redesign (thumb-zone layout, bottom nav, FAB)
- Dark luxury design system (RESTAURANT_COLORS tokens)
- Framer Motion animation variants library (entrance, stagger, status pulses)
- React Three Fiber 3D rendering (isometric floor plan with WebGL + Konva fallback)

**Files Committed:**
- `src/components/restaurant/FloorPlan3D.tsx` — 3D floor plan canvas
- `src/components/restaurant/Table3D.tsx` — Individual animated table meshes
- `src/pages/restaurant/RestaurantHub.tsx` — Landing page with 3D + KPIs
- `src/pages/restaurant/AnalyticsCommandCenter.tsx` — Analytics dashboard
- `src/hooks/useRestaurantRealtime.ts` — Real-time subscriptions hook
- `src/constants/restaurantColors.ts` — Design system tokens
- `src/utils/restaurantDB.ts` — Dexie offline database
- `src/utils/animationVariants.ts` — Framer Motion variants library
- `vite.config.ts` — PWA plugin configured
- `src/App.tsx` — Routes added (/restaurant, /restaurant/analytics)
- `src/pages/restaurant/WaiterInterface.tsx` — Redesigned for thumb-zone

---

## 0. Core Principles (AI Agents Must Never Violate)

1. **Every SELECT must include `.eq('tenant_id', tenantId)`** — RLS `current_tenant_id()` is non-deterministic. This is non-negotiable.
2. **TypeScript strict — no `any`** — use `unknown` and narrow, or define proper types in `src/types/restaurant.ts`.
3. **Dark theme only** — `bg-slate-900`/`bg-slate-950`/`bg-white/5`/`bg-white/10` for surfaces. Never introduce light backgrounds in operational views.
4. **Navigate: `void navigate(-1)`** — React Router 7 NavigateFunction returns `void | Promise<void>`. Never `onClick={() => navigate(-1)}`.
5. **INSERT must include `tenant_id: tenantId`** — always explicit.
6. **Mobile-first** — all UI at 375px before 1440px. Waiter interface is designed for a phone held one-handed.
7. **Supabase real-time over polling** — replace all `setInterval` polling with `supabase.channel()` subscriptions.

---

## 1. Vision Statement

**KiTS Restaurant OS** is the first fully integrated, AI-powered, offline-first restaurant management platform built natively for the Lebanese and MENA F&B market — designed to outperform Toast, Lightspeed, Foodics, and POSRocket on every dimension that matters to this region.

**Three differentiators no competitor has:**

1. **3D Live Operational Hub** — a real-time 3D isometric floor plan where table status glows, order badges float, and the manager sees every corner of the restaurant from one screen. Nothing like this exists in any F&B platform today.
2. **Lebanon-native by design** — full offline PWA (power outages), dual USD+LBP daily-rate cash management, argile/shisha as a first-class revenue center, native Toters/Talabat aggregation that eliminates the $300/mo Deliverect bill.
3. **Embedded AI OS** — a bilingual (Arabic + English) AI assistant with full access to every metric, plus demand forecasting, menu engineering, live upsell prompts, and AI-generated menu content. Not bolted on — the AI is woven into every workflow.

**Target customers:** Every F&B venue from a single Mar Mikhael bar to a 10-location hotel restaurant group.

---

## 2. Pricing Model & Go-To-Market

### 2.1 Plan Tiers (Restaurant-specific, separate from core KiTS plans)

| Plan | Monthly Price | Target | Branches | Core Features |
|---|---|---|---|---|
| **Restaurant Starter** | $49/mo | Café, bar, food truck, single-location | 1 | POS, floor plan, QR menu, menu management, KDS, basic analytics, reservations, shifts |
| **Restaurant Pro** | $129/mo | Full-service restaurant, multi-outlet | Up to 5 | + AI features, offline PWA, delivery aggregation (Toters/Talabat/Careem), argile, loyalty, advanced analytics, recipe/inventory |
| **Restaurant Enterprise** | Custom | Multi-branch groups, hotels, chains, ghost kitchens | Unlimited | + Events module, ghost kitchen, hotel F&B, bar/nightclub, public API, webhooks, ZATCA compliance, dedicated onboarding |
| **Events Add-on** | $49/mo | Any Pro/Enterprise with event revenue | — | Catering CRM, BEO builder, event P&L, proposal builder, deposit tracking |

### 2.2 Free Trial Policy

- **All plans:** Minimum 1 month free trial on request, zero credit card required.
- **Restaurant Pro:** Trial extendable to 2 months on request.
- **Restaurant Enterprise:** Trial extendable to 3 months, includes full onboarding session.
- Implementation in DB: `restaurant_subscription.trial_ends_at` column. Platform unlocks all plan features during trial. No feature gating during trial period.

### 2.3 Referral Program

- **Referrer gets:** 1 extra free month added to their subscription for each successful referral.
- **Referred gets:** 1 extra free month added to their trial.
- Implementation: `referral_code` on tenant, `referred_by_tenant_id` on new tenant. Track in `restaurant_referrals` table. Auto-apply at first invoice.

### 2.4 Early Adopter Program

- First 50 restaurants: 50% off first 6 months (Starter + Pro) or 3 months custom pricing (Enterprise).
- Badge: "Founding Member" visible on tenant profile.
- Input: `restaurant_subscription.is_founding_member BOOLEAN`. Founding members get priority feature access and direct WhatsApp line to KiTS team.

### 2.5 Implementation & Support Pricing

- **Remote onboarding session** (2 hours): Free for Enterprise, $99 for Pro, $49 for Starter.
- **On-site staff training** (per day): Custom quote, "very lenient and flexible" per business direction.
- **Hardware sourcing assistance** (tablets, printers, KDS screens): KiTS sources at cost + 10% handling fee. No markup on software if hardware is purchased through KiTS.
- **Data migration** (import from legacy system): Free for Enterprise, $99/hr for Pro.

---

## 3. Technical Architecture

### 3.1 New Dependencies to Install/check if installed

```bash
# 3D Floor Plan
npm install three @react-three/fiber @react-three/drei @use-gesture/react

# 2D Canvas (floor plan fallback + editor)
npm install konva react-konva

# Animation
npm install framer-motion lottie-react react-countup

# Advanced Charts
npm install @nivo/core @nivo/line @nivo/bar @nivo/pie @nivo/calendar @nivo/stream @nivo/sankey @nivo/bump @nivo/heatmap

# Offline / PWA
npm install dexie dexie-react-hooks
npm install -D vite-plugin-pwa workbox-window

# AI
npm install @anthropic-ai/sdk

# Utilities
npm install date-fns-tz  # Beirut timezone handling
npm install react-intersection-observer  # Lazy load analytics
```

### 3.2 Real-time Architecture (Replace All Polling)

All `setInterval` polling in restaurant pages must be replaced with Supabase channel subscriptions. Pattern:

```typescript
// src/hooks/useRestaurantRealtime.ts
export function useRestaurantRealtime(tenantId: string) {
  const [orderItems, setOrderItems] = useState<RestaurantOrderItem[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`restaurant:${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurant_order_items',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Handle INSERT, UPDATE, DELETE
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_orders',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Handle table order changes
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [tenantId]);
}
```

**Tables that need Supabase Realtime enabled** (enable in Supabase Dashboard → Database → Replication):
- `restaurant_order_items`
- `table_orders`
- `restaurant_pending_orders`
- `restaurant_kds_stations`
- `restaurant_argile_sessions`
- `restaurant_argile_events`
- `restaurant_slow_alerts`
- `restaurant_tables` (for floor plan live status)

### 3.3 Offline-First Architecture (PWA)

**Setup: `vite.config.ts`**

```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\/restaurant\/menu/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'restaurant-menu' },
          },
          {
            urlPattern: /supabase\.co\/rest\/v1\/restaurant_menu/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'menu-api',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
});
```

**Dexie.js Local Database: `src/utils/restaurantDB.ts`**

```typescript
import Dexie, { Table } from 'dexie';

interface OfflineOrder {
  id: string;
  tenantId: string;
  tableId: string;
  orderId: string;
  items: RestaurantOrderItem[];
  createdAt: string;
  synced: boolean;
}

interface OfflineMenuCache {
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
```

**Offline Detection Hook: `src/hooks/useOfflineStatus.ts`**

```typescript
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const goOnline = async () => {
      setIsOffline(false);
      await syncOfflineOrders();  // Sync queued orders on reconnect
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', () => setIsOffline(true));
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', () => setIsOffline(true));
    };
  }, []);

  return { isOffline, pendingCount };
}
```

**Offline Banner Component:** Persistent banner at top of all restaurant pages:
```
🔴 OFFLINE — Orders are saving locally and will sync when connection returns (3 orders queued)
```

### 3.4 AI Architecture

**AI Assistant: `src/utils/restaurantAI.ts`**

Uses Claude Sonnet 4.6 via Anthropic SDK with function calling. The assistant has read access to all restaurant data and can take actions.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,  // For browser-side calls
  // Better: route through a Supabase Edge Function for key security
});

export const RESTAURANT_ASSISTANT_TOOLS = [
  {
    name: 'get_revenue_summary',
    description: 'Get revenue summary for a date range',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
  },
  {
    name: 'get_top_items',
    description: 'Get top selling menu items by revenue or quantity',
    input_schema: { type: 'object', properties: { period: { type: 'string' }, metric: { type: 'string', enum: ['revenue', 'quantity', 'margin'] }, limit: { type: 'number' } }, required: ['period', 'metric'] },
  },
  {
    name: 'update_item_price',
    description: 'Update the price of a menu item (requires manager role)',
    input_schema: { type: 'object', properties: { itemId: { type: 'string' }, newPriceUsd: { type: 'number' } }, required: ['itemId', 'newPriceUsd'] },
  },
  {
    name: 'eighty_six_item',
    description: 'Mark a menu item as 86d (unavailable)',
    input_schema: { type: 'object', properties: { itemId: { type: 'string' }, reason: { type: 'string' } }, required: ['itemId'] },
  },
  {
    name: 'get_slow_alerts',
    description: 'Get current slow table alerts',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_staff_performance',
    description: 'Get waiter performance metrics for a period',
    input_schema: { type: 'object', properties: { period: { type: 'string' }, waiterId: { type: 'string' } } },
  },
  {
    name: 'generate_menu_description',
    description: 'Generate an Arabic + English menu description for an item',
    input_schema: { type: 'object', properties: { itemName: { type: 'string' }, ingredients: { type: 'array', items: { type: 'string' } }, cuisine: { type: 'string' } }, required: ['itemName', 'ingredients'] },
  },
  {
    name: 'get_demand_forecast',
    description: 'Get demand forecast for upcoming days/shifts',
    input_schema: { type: 'object', properties: { days: { type: 'number' } }, required: ['days'] },
  },
];

// Route through Edge Function for production (keeps API key server-side)
export async function askRestaurantAI(
  tenantId: string,
  question: string,
  language: 'en' | 'ar' = 'en'
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('restaurant-ai-assistant', {
    body: { tenantId, question, language },
  });
  if (error) throw error;
  return data.response as string;
}
```

**Edge Function: `supabase/functions/restaurant-ai-assistant/index.ts`** — receives question, fetches relevant data, calls Claude with system prompt + tools, executes tool calls, returns final answer. System prompt includes tenant's restaurant name, cuisine type, current shift, and recent metrics.

**Demand Forecasting: `src/utils/restaurantForecasting.ts`**

Uses the existing `src/utils/restaurantML.ts` as foundation. Extends to:
- Lebanese public holiday calendar (hardcoded + configurable per tenant)
- Ramadan detection (Islamic calendar calculation)
- Day-of-week baseline with seasonal multipliers (summer +40% July/August for diaspora)
- Weather integration optional (OpenWeatherMap API)

Output shape:
```typescript
interface DemandForecast {
  date: string;           // ISO date
  dayOfWeek: string;
  predictedCovers: number;
  predictedRevenue: number;
  confidence: number;      // 0-1
  factors: string[];       // ['public_holiday', 'ramadan_iftar', 'summer_peak']
  prepRecommendations: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    timeSlot: string;       // 'lunch', 'dinner', 'late_night'
  }>;
  staffingRecommendation: {
    waiters: number;
    kitchen: number;
    argileStaff: number;
  };
}
```

**Menu Engineering Matrix: `src/utils/menuEngineering.ts`**

BCG matrix applied to menu items:
```typescript
type MenuCategory = 'star' | 'plowhorse' | 'puzzle' | 'dog';

interface MenuItemEngineering {
  itemId: string;
  itemName: string;
  popularityScore: number;     // Relative to menu avg (0-1)
  marginScore: number;          // Relative to menu avg (0-1)
  category: MenuCategory;
  recommendedAction: string;    // AI-generated recommendation
  potentialRevenueImpact: number; // USD/month if action taken
}
```

Stars (high popularity + high margin) → promote, feature on QR menu  
Plowhorses (high popularity + low margin) → raise price or reduce portion  
Puzzles (low popularity + high margin) → reposition, better description, feature  
Dogs (low popularity + low margin) → remove or rebrand  

**Upsell Engine: `src/utils/upsellEngine.ts`**

```typescript
interface UpsellSuggestion {
  triggerItemId: string;
  suggestedItemId: string;
  suggestedItemName: string;
  confidence: number;           // 0-1
  supportingText: string;       // "73% of guests who ordered X also ordered Y"
}

// Called from QuickAddModal when an item is added to an order
export async function getUpsellSuggestions(
  tenantId: string,
  currentOrderItemIds: string[]
): Promise<UpsellSuggestion[]>
```

Association rules computed nightly from `restaurant_order_items` transaction data. Stored in `restaurant_upsell_rules` table. Frontend reads cached rules — no ML inference at order time.

### 3.5 Delivery Aggregation Architecture

**New Service: `src/services/deliveryAggregator.ts`**

Each delivery platform has a dedicated Edge Function webhook receiver:
- `supabase/functions/delivery-toters/` — Toters webhook endpoint
- `supabase/functions/delivery-talabat/` — Talabat Connect webhook
- `supabase/functions/delivery-careem/` — Careem Food webhook

All delivery webhooks normalize to a `DeliveryOrder` type and call `fn_create_delivery_order()` RPC which creates a `table_orders` record with `delivery_channel` set, plus creates a `restaurant_pending_orders` record for waiter confirmation if `order_flow = 'waiter_confirm'`.

```typescript
// src/types/delivery.ts
export type DeliveryChannel = 'toters' | 'talabat' | 'careem' | 'whatsapp' | 'phone' | 'walk_in';

export interface DeliveryOrder {
  externalId: string;
  channel: DeliveryChannel;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    externalItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: string[];
    notes?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: 'USD' | 'LBP';
  deliveryAddress?: string;
  estimatedPickup?: string;  // ISO datetime
  notes?: string;
}
```

**New DB table: `restaurant_delivery_orders`**
```sql
CREATE TABLE restaurant_delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  table_order_id UUID REFERENCES table_orders(id),
  channel delivery_channel_enum NOT NULL,
  external_id TEXT,                    -- Toters order ID, Talabat order ID, etc.
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  channel_fee_pct NUMERIC(5,2),        -- Commission % charged by platform
  raw_payload JSONB,                    -- Original webhook payload (for debugging)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Design System

### 4.1 Visual Philosophy

**Dual-mode adaptive interface:**
- **Operational mode** (floor plan, KDS, waiter interface): High-contrast dark navy. Large text. Glow states. Zero decorative elements. Optimized for use under restaurant lighting and by staff on the move.
- **Analytics/Command Center mode** (owner dashboard, reports, AI assistant): Premium dark luxury. Glassmorphism cards. Richer gradients. Information density balanced with breathing room. Feels like a Bloomberg Terminal meets a Michelin-star experience.

Toggle between modes is persistent per user role: waiter defaults to Operational, manager/owner defaults to Command Center.

### 4.2 Color System

```typescript
// src/constants/restaurantColors.ts
export const RESTAURANT_COLORS = {
  // Table status (used in 3D and 2D floor plan)
  available:  { fill: '#10b981', emissive: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  occupied:   { fill: '#f59e0b', emissive: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  reserved:   { fill: '#8b5cf6', emissive: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  cleaning:   { fill: '#64748b', emissive: '#64748b', glow: 'transparent' },
  alert:      { fill: '#ef4444', emissive: '#ef4444', glow: 'rgba(239,68,68,0.4)' },

  // Backgrounds
  base:       '#0a0f1e',   // Deepest dark navy — page background
  surface:    '#111827',   // Cards, panels
  elevated:   '#1e2d40',   // Modals, dropdowns
  glass:      'rgba(255,255,255,0.04)',  // Glassmorphism surface
  border:     'rgba(255,255,255,0.08)',

  // Accents
  primary:    'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',  // Indigo→Sky
  gold:       'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',  // AI features
  premium:    'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',  // Enterprise features
} as const;
```

### 4.3 3D Floor Plan System

**File: `src/components/restaurant/FloorPlan3D.tsx`**

Built with `react-three-fiber`. This is the hero component of the entire platform.

```tsx
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Text, Float } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

interface Table3DProps {
  table: RestaurantTable;
  orderInfo?: { total: number; covers: number; minutesSince: number; };
  onSelect: (tableId: string) => void;
  isSelected: boolean;
}

function Table3D({ table, orderInfo, onSelect, isSelected }: Table3DProps) {
  const status = table.status;
  const color = RESTAURANT_COLORS[status].fill;
  const emissive = RESTAURANT_COLORS[status].emissive;

  // Pulsing animation for occupied tables with slow orders (>15 min)
  const { emissiveIntensity } = useSpring({
    from: { emissiveIntensity: 0.2 },
    to: { emissiveIntensity: status === 'alert' ? 0.8 : 0.3 },
    loop: status === 'alert' ? { reverse: true } : false,
    config: { duration: 800 },
  });

  return (
    <group
      position={[table.position_x * 20 - 10, 0, table.position_y * 20 - 10]}
      onClick={() => onSelect(table.id)}
    >
      {/* Table surface */}
      <mesh>
        <boxGeometry args={[2.5, 0.15, 1.8]} />
        <animated.meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Table number */}
      <Text position={[0, 0.2, 0]} fontSize={0.4} color="white" anchorX="center">
        {table.table_number.toString()}
      </Text>

      {/* Order badge (floating above table) */}
      {orderInfo && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
          <group position={[0, 1.5, 0]}>
            {/* Badge background */}
            <mesh>
              <planeGeometry args={[2, 0.6]} />
              <meshBasicMaterial color="#111827" opacity={0.9} transparent />
            </mesh>
            <Text position={[0, 0.1, 0.01]} fontSize={0.2} color="#f59e0b">
              ${orderInfo.total.toFixed(0)} · {orderInfo.covers}pp · {orderInfo.minutesSince}min
            </Text>
          </group>
        </Float>
      )}
    </group>
  );
}

export function FloorPlan3D({ tables, orders, onTableSelect }: FloorPlan3DProps) {
  return (
    <div className="w-full h-full" style={{ height: '70vh' }}>
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 20, 0]} zoom={30} />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 10, 0]} intensity={0.8} color="#6366f1" />
        <pointLight position={[10, 10, 10]} intensity={0.3} />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[25, 25]} />
          <meshStandardMaterial color="#0a0f1e" />
        </mesh>

        {tables.map(table => (
          <Table3D
            key={table.id}
            table={table}
            orderInfo={orders.find(o => o.table_id === table.id)}
            onSelect={onTableSelect}
            isSelected={false}
          />
        ))}
      </Canvas>
    </div>
  );
}
```

**2D Konva Fallback** (for devices that fail WebGL detection):

```tsx
// src/components/restaurant/FloorPlan2D.tsx
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';

// Detect WebGL support
export function FloorPlanAuto(props: FloorPlanProps) {
  const canvas = document.createElement('canvas');
  const hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  return hasWebGL ? <FloorPlan3D {...props} /> : <FloorPlan2D {...props} />;
}
```

**3D Floor Plan Editor** (for table arrangement in TableManagement.tsx):

When a manager taps "Edit Layout" on the floor plan, it switches to edit mode where:
- Tables can be dragged in 3D space (x/z position maps to position_x/position_y in %)
- Table type can be changed (rectangle, round, booth)
- Sections (indoor, terrace, bar) shown as colored zones on the floor texture
- Save button commits changes to `restaurant_tables` with updated positions

### 4.4 Analytics Command Center

**File: `src/pages/restaurant/AnalyticsCommandCenter.tsx`**

This is the owner/manager view. Toggled from the floor plan via a button in the top nav.

Key panels:
1. **Live KPI Row** — animated `react-countup` cards: Today Revenue, Covers, Avg Check, Open Tables, Pending Orders
2. **Revenue Calendar** — Nivo `ResponsiveCalendar` showing daily revenue for past 365 days (GitHub heatmap style). Dark theme.
3. **Revenue Stream Chart** — Nivo `ResponsiveStream` showing food/argile/drinks revenue flowing over the past 30 days
4. **Demand Forecast Panel** — Next 7 days predicted covers with confidence bands (Nivo `ResponsiveLine` with area fill)
5. **Menu Engineering Matrix** — 4-quadrant plot with menu items plotted by margin (x) vs popularity (y). Interactive — click item to see recommendation.
6. **Top Waiters Leaderboard** — Ranked by avg check / covers / tip earnings. Animated rank changes.
7. **Slow Alert Feed** — Real-time list of tables that have been waiting too long
8. **AI Assistant Panel** — Embedded chat interface with AI assistant (see Section 5.1)

### 4.5 Motion Design

All state transitions use Framer Motion:

```typescript
// Status color transitions (tables, order items)
const statusVariants = {
  available: { scale: 1, opacity: 1 },
  occupied: { scale: 1.02, opacity: 1 },
  alert: { scale: 1, opacity: [1, 0.7, 1], transition: { repeat: Infinity, duration: 1 } },
};

// Order item addition
const itemVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

// Page transitions for restaurant routes
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0 },
};
```

**Lottie Animations** (store in `src/assets/lottie/restaurant/`):
- `order-sent.json` — checkmark burst when order is sent to kitchen
- `bill-paid.json` — coin shower when bill is closed
- `table-cleaned.json` — sparkle sweep when table marked clean
- `new-qr-order.json` — notification pulse for incoming QR/delivery orders
- `offline-mode.json` — disconnected plug animation for offline banner

Use `lottie-react` for all. Each plays once on trigger, does not loop (except `new-qr-order` which loops while pending).

### 4.6 KDS Display System (Multi-Mode)

**File: `src/pages/restaurant/KitchenDisplay.tsx`** — extend existing file.

**Three modes selectable from KDS header:**

1. **Station Mode** (default for kitchen tablets) — shows only items routed to this station. Full-screen, no navigation. Large text. Sound alerts. Bump to mark done.

2. **Expediter Mode** — shows ALL stations side-by-side. Head chef sees exactly what state each ticket is in at each station. "Ready to plate" signal when all stations have completed a ticket.

3. **Manager Overview** — condensed view of all open tickets. Sorted by age. Used for monitoring, not bumping. No interaction needed — read-only.

**Ticket Aging Colors (override existing):**
- `< 5 min`: border `#10b981` (green)
- `5–10 min`: border `#f59e0b` (amber)
- `10–15 min`: border `#f97316` (orange)
- `> 15 min`: border `#ef4444` (red) + pulsing animation
- Allergen ticket: red pulsing border for 5 seconds on arrival, then normal aging

**Paper ticket fallback:** If `kds_mode = 'print_only'` in `restaurant_order_flow_config`, skip KDS display entirely and trigger Bluetooth printer on order send. Print to all configured printers.

---

## 5. Feature Modules — Phase 0 (Close Existing Gaps)

*These block go-live. Complete before any Phase 1 work.*

### 5.1 Bill Close / Payment Flow

**File:** `src/pages/restaurant/WaiterInterface.tsx` → `CloseBillModal` component

**UI Flow:**
1. Tap "Close Bill" on TableDetail → `CloseBillModal` opens
2. Shows itemized bill: all items + quantities + unit prices
3. Subtotals row: Food subtotal, Argile subtotal
4. Charges row: Service charge % (from settings), VAT % (from settings)
5. Tip input: cash tip entry (in USD) + if service charge is enabled, show breakdown
6. Discount input (RoleGate — manager only): percentage or fixed amount
7. Total in USD + total in LBP at today's rate (live calculation)
8. Payment method selector: Cash (USD) / Cash (LBP) / Card / Split
9. Cash received input → shows change due
10. "Confirm Payment" → calls `fn_close_restaurant_bill()` RPC → Lottie animation → table status → available → close modal

```typescript
// RPC call pattern
const { data, error } = await supabase.rpc('fn_close_restaurant_bill', {
  p_order_id: orderId,
  p_payment_method: 'cash_usd',  // 'cash_usd' | 'cash_lbp' | 'card' | 'split'
  p_tip_amount_usd: tipAmount,
  p_discount_pct: discountPct,
  p_cash_received_usd: cashReceived,
  p_exchange_rate: todayExchangeRate,
});
```

**Receipt generation:** After successful payment, offer to print receipt via Bluetooth printer OR send via WhatsApp to customer (if phone number on file).

### 5.2 Order Sending (Send to KDS)

**Files:** `WaiterInterface.tsx`, `src/hooks/useRestaurantOrder.ts`

In `TableDetail`, add "Send to Kitchen" FAB (Floating Action Button) at bottom:
- Styled: `bg-gradient-to-r from-indigo-600 to-sky-500` large button
- Shows count of unsent items: "Send 3 items to Kitchen"
- On tap: update all `restaurant_order_items` with `status = 'in_progress'`, `sent_at = now()`
- Trigger Lottie `order-sent.json` animation
- KDS auto-updates via Supabase real-time channel

### 5.3 QR Menu End-to-End

**File:** `src/pages/QRMenu.tsx`

Full flow verification:
1. Guest scans QR → `/menu/:tenantSlug` loads
2. Menu loads via `get_public_menu(:tenantSlug)` RPC
3. Guest adds items → cart
4. Guest taps checkout
5. If `order_flow = 'waiter_confirm'`: creates `restaurant_pending_orders` record → WaiterInterface shows notification badge
6. If `order_flow = 'direct'`: creates `table_orders` + `restaurant_order_items` directly → appears in KDS

**Pending Orders Panel** (new in `WaiterInterface.tsx`):
- Badge in header shows count of pending QR orders
- Drawer panel lists each pending order: table number (from QR slug param), items, guest note
- Waiter can: Confirm (creates table order) or Reject (deletes pending order + notifies guest on QR screen)

### 5.4 Menu Item Photo Upload

**File:** `src/pages/restaurant/MenuManagement.tsx` → `ItemFormModal`

Add image upload inside `ItemFormModal`:
1. Dropzone + preview
2. On drop: upload to Supabase Storage `menu-images/{tenantId}/{itemId}.{ext}`
3. Store public URL in `restaurant_menu_items.photo_url`
4. Display in item cards (MenuManagement) and QR menu (QRMenu.tsx)

Use `@supabase/storage-js` directly:
```typescript
const { data, error } = await supabase.storage
  .from('menu-images')
  .upload(`${tenantId}/${itemId}`, file, { upsert: true, contentType: file.type });
const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(`${tenantId}/${itemId}`);
```

---

## 6. Feature Modules — Phase 1 (Visual Revolution) ✅ COMPLETE

**Status:** All tasks implemented, committed, and live on production.  
**Reference Plan:** See `docs/superpowers/plans/2026-06-22-phase-1-visual-revolution.md` for detailed task breakdown.

### 6.1 Restaurant Hub Page (New Landing Page) ✅ LIVE

**New File:** `src/pages/restaurant/RestaurantHub.tsx`  
**Route:** `/restaurant` (new root route — replace current redirect to `/restaurant/tables`)

This is the new default view for the entire F&B vertical. Contains:
- 3D floor plan (left 65% of screen on desktop, full screen on mobile)
- Live metrics sidebar (right 35%): covers today, revenue today, open orders, slow alerts
- Toggle: "Floor View" / "Command Center" (slides between 3D floor plan and AnalyticsCommandCenter)
- Quick action FABs: + New Table Order, Scan QR, View KDS

**Mobile:** 3D floor plan is full screen. Bottom drawer for table details. Metrics accessible via pull-up.

### 6.2 Real-time Status Everywhere ✅ LIVE

**Status:** Implemented via `useRestaurantRealtime` hook.

Supabase channels replace all polling (see Section 3.2). Every restaurant page subscribes to its relevant tables and updates state on change with smooth Framer Motion transitions.

Specifically:
- ✅ `RestaurantHub.tsx` — `restaurant_tables` + `table_orders` (live KPI updates)
- ✅ `useRestaurantRealtime` hook — Subscribe to INSERT/UPDATE/DELETE events
- 🔄 `TableManagement.tsx`, `KitchenDisplay.tsx`, `WaiterInterface.tsx` — Ready for integration

### 6.3 Waiter Interface Full Redesign ✅ LIVE

**File:** `src/pages/restaurant/WaiterInterface.tsx` (commit 69f77100, updated 74190572)

✅ Full redesign following thumb-zone principles implemented:
- **Top bar** (read-only): restaurant name, current shift, pending order count badge, offline indicator
- **Main content**: Table grid OR open order detail
- **Bottom navigation** (primary action zone): Tabs — Tables / My Orders / Send Queue / Pending QR
- **FAB**: "+ Add Item" button (bottom right, always accessible, fixed position)
- AnimatePresence for smooth tab transitions between view modes
- Status indicators per table (occupied/available/reserved/cleaning/alert)

**Menu Browser sheet** — Foundation ready for Phase 2:
- Full-screen bottom sheet structure with category pills + search
- Item grid with photo, bilingual names, price display
- 86'd (unavailable) overlay support
- AI upsell banner placeholder

### 6.4 Premium UI Component Updates ✅ PARTIAL

✅ Design system applied:
- Dark theme enforced (no light backgrounds)
- RESTAURANT_COLORS tokens used throughout
- Framer Motion entrance animations on lists (containerVariants + itemVariants)
- KPI metric cards animated with react-countup
- Glassmorphism surfaces in dark theme

🔄 Additional refinements (future phases):
- Glow effects on interactive elements (ready to add with RESTAURANT_COLORS.glow)
- More extensive status badge animations across pages

---

## NEXT STEPS

Phase 1 is production-ready. Choose your path:

### Option A: Continue to Phase 2 (AI Layer)
Begin implementation of AI features using the plan below. Phase 2 adds:
- AI Restaurant Assistant (Claude API)
- Demand forecasting
- Menu engineering matrix
- AI-generated menu descriptions
- Upsell engine
- Advanced analytics charts

### Option B: Stabilize & Iterate on Phase 1
- Monitor production metrics (performance, user adoption)
- Gather feedback from first restaurants
- Refine mobile experience based on real usage
- Execute Phase 1 backlog (menu browser, full waiter flows)

### Option C: Prepare Phase 3 (Offline PWA)
- Service worker is live; Dexie DB ready
- Implement offline order sync queue
- Test complete offline workflows
- Plan for power outage scenarios (Lebanon-native design)

---

## 7. Feature Modules — Phase 2 (AI Layer) 🚧 PLANNED

### 7.1 AI Restaurant Assistant

**New Page:** `src/pages/restaurant/AIAssistant.tsx`  
**Route:** `/restaurant/ai`  
**Also:** Embedded panel in AnalyticsCommandCenter (right drawer)

**UI:**
- Full-screen chat interface with history
- Language toggle: EN / AR (switches assistant response language)
- Input: voice-to-text option (Web Speech API) + text input
- Suggested prompts (chips): "How did we do today?", "Which items should I 86?", "Write me a Friday promo", "Who's our best waiter this week?", "What should I prep for tomorrow?"
- Response renders markdown with tables, charts (inline Nivo sparklines)

**Capabilities:**
- Answer any data question about the restaurant's history
- Draft Arabic + English marketing copy, menu descriptions, WhatsApp messages
- Recommend actions (price adjustments, 86 items, staffing changes)
- Execute actions on confirmation: update prices, 86 items, create promotions

**Backend:** Supabase Edge Function `restaurant-ai-assistant` using Claude Sonnet 4.6 with function calling (tools defined in Section 3.4).

**Nav entry:** Add to restaurant nav under "Intelligence" section. Icon: `Sparkles` (Lucide).

### 7.2 Demand Forecasting Dashboard

**File:** `src/pages/restaurant/RestaurantAnalytics.tsx` — add "Forecast" tab

**UI:**
- 7-day forecast: horizontal bar chart (Nivo) — each day shows predicted covers + confidence band
- "Tomorrow's prep list": ordered list of items to prepare by quantity + time slot
- Staffing recommendation: "Schedule 3 waiters + 2 kitchen + 1 argile for Friday dinner"
- Ramadan mode: when within Ramadan, shows Iftar/Suhoor separately with time annotations
- Historical accuracy card: "Our forecast was within X% of actual over the last 30 days"

### 7.3 Menu Engineering Matrix

**File:** `src/pages/restaurant/RestaurantAnalytics.tsx` — add "Menu Matrix" tab

**UI:**
- 4-quadrant scatter plot (D3 or Nivo ScatterPlot)
- X-axis: profit margin per item
- Y-axis: popularity (units sold relative to avg)
- Quadrant labels: Stars (top-right), Plowhorses (top-left), Puzzles (bottom-right), Dogs (bottom-left)
- Each point = a menu item. Hover: tooltip with item name, avg margin, weekly sales, recommended action
- Filter by category (only show mains, only show drinks, etc.)
- Export: "Download Menu Engineering Report" → PDF with recommendations per item

### 7.4 AI Upsell Prompts in Waiter Interface

**File:** `src/pages/restaurant/WaiterInterface.tsx` → `QuickAddModal`

After an item is added to the order, if `upsellRules` contains a match:
- Show a subtle banner below the order list: "💡 Guests who order [X] also love [Y] — tap to add"
- Tap → pre-fills QuickAddModal with suggested item
- Track acceptance rate per waiter in `restaurant_upsell_logs` table for analytics

### 7.5 AI Menu Content Generator

**File:** `src/pages/restaurant/MenuManagement.tsx` → `ItemFormModal`

"Generate with AI" button next to description fields:
- Modal: enter item name + ingredients list (comma separated)
- AI generates: English description (evocative, appetizing) + Arabic translation
- Preview both + edit before saving
- Also offers: "Generate promotional photo description" for social media use
- Powered by Claude API (same Edge Function as AI assistant, different tool)

---

## 8. Feature Modules — Phase 3 (Offline PWA)

### 8.1 Service Worker Setup

Add to `vite.config.ts` (see Section 3.3). The service worker must handle:
1. **Menu caching**: Full menu data cached on first app load, updated in background. Menu loads instantly offline.
2. **Order queuing**: Any `restaurant_order_items` INSERT that fails (offline) is queued in Dexie.js and replayed on reconnect.
3. **Asset caching**: All JS/CSS/images are cached for instant load.
4. **Offline page**: Custom offline page shown for routes that require live data (analytics, reports).

### 8.2 Offline Order Queue Manager

**File:** `src/hooks/useOfflineOrderQueue.ts`

- Monitors `navigator.onLine`
- On offline: intercepts Supabase INSERT calls for orders, saves to Dexie
- On reconnect: replays queued inserts in order, resolves conflicts (server wins on order totals)
- Shows queue count in offline banner

### 8.3 Offline Cash Tracking

Even offline, waiters can:
- Open new table orders (stored locally)
- Add items from cached menu
- Close bills (cash only, stored locally)
- On reconnect: all transactions sync with Supabase, P&L updates

Bluetooth receipts work offline (direct printer connection, no internet needed for printing).

---

## 9. Feature Modules — Phase 4 (Operations Complete)

### 9.1 Dual-Currency Cash Drawer System

**New DB Tables (Migration 43):**
```sql
CREATE TABLE restaurant_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID REFERENCES restaurant_branches(id),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance_usd NUMERIC(12,2) DEFAULT 0,
  opening_balance_lbp NUMERIC(16,0) DEFAULT 0,
  exchange_rate_at_open NUMERIC(10,0) NOT NULL,
  closing_balance_usd NUMERIC(12,2),
  closing_balance_lbp NUMERIC(16,0),
  exchange_rate_at_close NUMERIC(10,0),
  cash_difference_usd NUMERIC(12,2),  -- Over/short
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT
);

CREATE TABLE restaurant_cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES restaurant_cash_sessions(id),
  entry_type TEXT CHECK (entry_type IN ('sale', 'tip', 'petty_cash_out', 'petty_cash_in', 'opening', 'closing')),
  amount_usd NUMERIC(12,2),
  amount_lbp NUMERIC(16,0),
  exchange_rate NUMERIC(10,0),
  reference_order_id UUID REFERENCES table_orders(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

**New Page:** `src/pages/restaurant/CashManagement.tsx`  
**Route:** `/restaurant/cash`

Features:
- Open shift: enter opening balance in USD + LBP
- Real-time running total as sales/tips come in
- Denomination breakdown: enter exact bills on hand (e.g., 5x $100, 12x $20, etc.)
- LBP to USD reconciliation at end of shift using daily exchange rate
- Print shift report
- Over/short detection with alert

### 9.2 Exchange Rate Management

**File:** `src/pages/restaurant/RestaurantSettings.tsx` — add "Exchange Rates" section

- Daily rate input: "Today's USD:LBP rate" (editable by manager)
- Rate history log (last 30 days)
- Auto-update button: fetch from API (e.g., lirarate.org or similar Lebanese rate source)
- Rate change impact preview: "Changing rate from 90,000 to 92,000 LBP/USD will affect X menu item LBP prices"
- Stock revaluation: when rate changes, existing inventory is revalued and COGS is recalculated

This uses and extends existing algorithms in the codebase that handle currency rate effects on stocks and COGS.

### 9.3 Delivery Aggregation UI

**New Page:** `src/pages/restaurant/DeliveryHub.tsx`  
**Route:** `/restaurant/delivery`

Three-panel layout:
1. **Incoming orders panel** (left): Real-time feed of orders from Toters, Talabat, Careem, WhatsApp — color coded by platform. Accept/Reject buttons.
2. **Active delivery orders** (center): Orders accepted and in progress. Shows prep status, estimated pickup time.
3. **Platform analytics** (right): Revenue, order count, avg ticket, cancel rate — by platform. Last 30 days.

**Delivery order cards** show: platform logo, order number, customer name, items list, total, estimated time.
**Accept** → creates table order (delivery type), sends to KDS.
**Reject** → sends rejection back to platform API with reason.

### 9.4 Modifier Groups in Waiter Interface

**File:** `src/pages/restaurant/WaiterInterface.tsx` → `QuickAddModal`

When an item has associated `restaurant_menu_item_modifiers`:
1. Show modifier groups (e.g., "Temperature", "Size", "Add-ons") in the QuickAddModal
2. Required groups must be selected before adding to order
3. Optional groups shown with checkboxes
4. Selected modifiers appended to `restaurant_order_items.modifiers` JSONB field

### 9.5 Bill Split UI

**File:** `src/pages/restaurant/WaiterInterface.tsx` → `BillSplitModal`

Three split modes:
1. **Equal split**: N ways — enter number of people, divide total equally
2. **By amount**: Each person pays a custom amount (enter per person)
3. **By item**: Drag items to "Person 1", "Person 2", etc. columns

Uses `restaurant_bill_splits` + `restaurant_bill_split_parts` tables (already exist in DB).

### 9.6 Course Management

**File:** `src/pages/restaurant/WaiterInterface.tsx`

Add "Fire Course" button in TableDetail when items have course assignments:
- Items are tagged with course: `appetizer` | `main` | `dessert` | `drinks`
- "Fire Mains" button sends all main course items to KDS simultaneously
- KDS shows course tag on each ticket

Add course selector to `QuickAddModal` (optional field, defaults to 'main').

### 9.7 Reservation ↔ Table Link

**File:** `src/pages/restaurant/Reservations.tsx`

When a reservation status changes to "seated":
1. Prompt: "Open table order for this reservation?" 
2. Confirm → creates `table_orders` record for the reserved table with `covers = reservation.covers`
3. Table status updates to "occupied" on floor plan in real-time

---

## 10. Feature Modules — Phase 5 (Revenue Features)

### 10.1 Loyalty Ecosystem

**New DB Migration 45:**
```sql
CREATE TABLE restaurant_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  points_per_usd NUMERIC(5,2) DEFAULT 10,     -- 10 points per $1 spent
  tiers JSONB DEFAULT '[
    {"name":"Bronze","min_points":0,"color":"#cd7f32","perks":["5% off on birthday"]},
    {"name":"Silver","min_points":500,"color":"#c0c0c0","perks":["Free dessert monthly","Priority reservations"]},
    {"name":"Gold","min_points":2000,"color":"#ffd700","perks":["10% off all orders","Free argile monthly","Chef table access"]},
    {"name":"VIP","min_points":5000,"color":"#7c3aed","perks":["15% off","Free bottle wine monthly","Private events discount"]}
  ]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE restaurant_loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  total_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  current_tier TEXT DEFAULT 'Bronze',
  visits INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  referral_code TEXT UNIQUE,
  referred_by TEXT  -- referral_code of referrer
);

CREATE TABLE restaurant_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  member_id UUID NOT NULL REFERENCES restaurant_loyalty_members(id),
  order_id UUID REFERENCES table_orders(id),
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  transaction_type TEXT CHECK (transaction_type IN ('earn', 'redeem', 'bonus', 'expire', 'adjust')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE restaurant_loyalty_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,               -- "Summer Argile Challenge"
  description TEXT,
  challenge_type TEXT CHECK (challenge_type IN ('visit_streak', 'spend_target', 'item_order', 'referral')),
  target_value NUMERIC,             -- e.g., 5 visits, $100 spend
  bonus_points INTEGER,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true
);
```

**New Page:** `src/pages/restaurant/LoyaltyProgram.tsx`  
**Route:** `/restaurant/loyalty`

**Manager view:**
- Member list with tier badges, visit count, points balance
- Challenge builder (create gamified challenges)
- Tier configuration editor
- Points redemption log
- Analytics: retention rate, avg visits per tier, top members

**Waiter-side (embedded in WaiterInterface):**
- "Add to loyalty" button on bill close
- Phone number lookup → show member card (tier, points, perks)
- Auto-apply earned points after payment
- Show "You earned X points!" on receipt

**QR-based enrollment:** Generate loyalty QR code per tenant. Customer scans → fills name + phone → enrolled. Show on bill or table card.

### 10.2 Events Module (Add-on: $49/mo)

**New DB Migration 46:**
```sql
CREATE TABLE restaurant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('private_dining', 'wedding', 'corporate', 'birthday', 'other')),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue_section TEXT,              -- 'main_hall', 'terrace', 'private_room'
  covers INTEGER,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'proposal_sent', 'confirmed', 'deposit_paid', 'completed', 'cancelled')),
  deposit_amount NUMERIC(12,2),
  deposit_paid_at TIMESTAMPTZ,
  total_budget NUMERIC(12,2),
  menu_packages JSONB,             -- Array of selected menu packages
  notes TEXT,
  assigned_manager UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE restaurant_event_beos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES restaurant_events(id),
  content JSONB NOT NULL,          -- Full BEO structure: timeline, staff, setup, menu, notes
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

**New Page:** `src/pages/restaurant/EventsManager.tsx`  
**Route:** `/restaurant/events`

**Features:**
- Events calendar (month view — Nivo TimeRange or custom FullCalendar-style)
- Event pipeline Kanban: Inquiry → Proposal → Confirmed → Deposit Paid → Completed
- Proposal builder: select date/covers/section + choose menu packages → generates professional PDF proposal with pricing
- BEO (Banquet Event Order): structured day-of document with timeline, staff assignments, setup instructions, menu, contact list
- Event P&L: revenue vs. food cost + labor cost + venue cost
- Client CRM: past events, total spend, preferences

**FeatureGate:** Wrap entire `/restaurant/events` route with Events add-on gate. Show "upgrade" CTA if not subscribed.

### 10.3 Ghost Kitchen Module

**New Page:** `src/pages/restaurant/GhostKitchen.tsx`  
**Route:** `/restaurant/ghost-kitchen`

A ghost kitchen runs multiple virtual restaurant brands from one physical kitchen:

**Virtual Brand Management:**
- Create virtual brands (separate name, logo, cuisine, delivery platform profiles)
- Each brand has its own menu (subset of the main menu or unique items)
- Brand-specific pricing (same item can have different price per brand)
- Brand-specific delivery platform configurations

**KDS Integration:**
- KDS tickets show brand logo + brand name above item list
- Separate queue filter per brand for kitchen organization
- Brand-level ticket routing (can send different brands to different stations)

**Analytics:**
- Revenue per brand
- Orders per brand per platform (Toters Brand A vs. Toters Brand B)
- Comparative P&L across brands
- Which brand is most efficient per square meter of kitchen

**DB:** Extend `restaurant_menu_items` with `virtual_brand_id UUID REFERENCES restaurant_virtual_brands(id)`.  
**New table:** `restaurant_virtual_brands(id, tenant_id, name, logo_url, cuisine, is_active)`

### 10.4 Staff Performance Dashboard

**File:** `src/pages/restaurant/RestaurantAnalytics.tsx` — add "Team" tab

**Waiter Leaderboard:**
- Cards per waiter: avg check, covers served, tip earned, upsell rate, customer rating (from `restaurant_table_feedback`)
- Sortable by any metric
- Period selector: Today / This Week / This Month
- Trend arrows (up/down vs. previous period)
- Share: "Export team performance PDF" for team meeting

**Kitchen Performance:**
- Avg ticket time per station
- Tickets bumped per hour (throughput)
- Wastage per cook (from `restaurant_waste_log`)

---

## 11. Feature Modules — Phase 6 (Expansion & Specialized Verticals)

### 11.1 Bar & Nightclub Module

**New Tab/Sub-section under WaiterInterface for bar mode**

Key differences from restaurant mode:
- **Tab management**: A customer can open a tab (running credit) — add drinks throughout the night without closing per round
- **Tab transfer**: Tabs can be moved between tables or transferred to another name
- **Bottle service**: Track bottle service sessions (bottle type, opener fee, mixer tracking)
- **Nightclub mode**: Remove course management, enable "round ordering" (quick repeat of last round)
- **Late checkout**: EOD closes at 5am instead of midnight
- **Age verification note**: Flag on table if ID not checked (reminder, not enforcement)

**DB additions:** `restaurant_tabs` table with `customer_name`, `credit_limit`, `items`, `status`.

### 11.2 Hotel F&B Module

**New Page:** `src/pages/restaurant/HotelFnB.tsx`  
**Route:** `/restaurant/hotel`

Hotels run multiple F&B outlets from one roof:
- Outlet management: Main Restaurant / Bar / Rooftop / Pool / Room Service / Minibar
- Each outlet has its own floor plan, menu, KDS, and staff
- Consolidated reporting across outlets
- Room service: order takes `room_number` instead of `table_number`. Printer auto-prints in kitchen and sends to room delivery staff.
- Hotel guest profile sync: if connected to PMS (Property Management System), guest name autofills from room number.

**DB additions:** `restaurant_outlets` table. `table_orders.outlet_id` FK. `table_orders.room_number` for room service.

### 11.3 Catering & Wedding Venue (see Phase 5.2 Events Module)

Already defined in Section 10.2. Phase 6 adds:
- Seating chart builder (drag-and-drop round tables with guest assignments)
- Dietary requirement tracking per guest
- Day-of timeline (runsheet) with automated WhatsApp/SMS alerts to staff at each milestone

### 11.4 WhatsApp Integration

**Implementation approach:** One channel among many — not the primary interface.

WhatsApp channels:
1. **Outbound receipts**: Send receipt after bill close (if customer phone on file)
2. **Outbound loyalty**: Points earned notification after visit
3. **Outbound marketing**: Campaign messages via AI-generated copy
4. **Inbound orders**: Webhook from WhatsApp Business API → creates `restaurant_pending_orders` with `channel = 'whatsapp'`
5. **Reservation confirmation**: WhatsApp confirmation message with reservation details

Edge Function: `supabase/functions/whatsapp-restaurant/` — adapts the existing `whatsapp-receipt` function for restaurant receipts.

### 11.5 ZATCA E-Invoicing (Saudi Arabia Compliance)

For tenants with `country = 'SA'`:
- All `table_orders` must generate a ZATCA-compliant e-invoice (XML format with QR code)
- `fn_close_restaurant_bill()` triggers ZATCA submission for Saudi tenants
- Receipt QR code contains encoded invoice hash per ZATCA Phase 2 requirements
- **New table:** `restaurant_zatca_invoices(id, tenant_id, order_id, invoice_xml, zatca_hash, submitted_at, zatca_status)`

### 11.6 Public API & Webhooks

**New Pages:**
- `src/pages/restaurant/APIManagement.tsx` — API key management + webhook configuration
- **Route:** `/restaurant/settings/api`

Reuses and extends the existing `api_keys` and `webhooks` tables from migration 012.

**Restaurant-specific webhook events:**
- `order.created` — new table order opened
- `order.sent_to_kitchen` — items sent to KDS
- `order.closed` — bill paid
- `delivery.order_received` — new delivery order from Toters/Talabat/Careem
- `loyalty.points_earned` — member earns points
- `reservation.created` — new reservation

### 11.7 International Expansion Architecture

All features must be built with these constants in mind:

```typescript
// src/constants/internationalization.ts
export const MENA_COUNTRIES = {
  LB: { name: 'Lebanon', currency: 'USD', secondaryCurrency: 'LBP', vat: 11, timezone: 'Asia/Beirut', locale: 'ar-LB' },
  AE: { name: 'UAE', currency: 'AED', vat: 5, timezone: 'Asia/Dubai', locale: 'ar-AE' },
  SA: { name: 'Saudi Arabia', currency: 'SAR', vat: 15, timezone: 'Asia/Riyadh', locale: 'ar-SA', zatcaRequired: true },
  KW: { name: 'Kuwait', currency: 'KWD', vat: 0, timezone: 'Asia/Kuwait', locale: 'ar-KW' },
  EG: { name: 'Egypt', currency: 'EGP', vat: 14, timezone: 'Africa/Cairo', locale: 'ar-EG' },
  JO: { name: 'Jordan', currency: 'JOD', vat: 16, timezone: 'Asia/Amman', locale: 'ar-JO' },
} as const;

export const RAMADAN_PERIODS = {
  2026: { start: '2026-02-18', end: '2026-03-19' },
  2027: { start: '2027-02-08', end: '2027-03-09' },
  // etc.
};
```

Every new feature must:
- Accept `timezone` parameter for date calculations (use `date-fns-tz`)
- Support RTL layout via `dir={language === 'ar' ? 'rtl' : 'ltr'}`
- Store VAT rate from tenant config, not hardcoded
- Display currency from tenant config

---

## 12. Database Migrations Required

Run in order. All must be `IF NOT EXISTS` safe and include `RLS ENABLED`.

| # | File | What it adds |
|---|---|---|
| 42 | `20260622_000042_restaurant_3d_floor.sql` | `restaurant_tables.table_shape` (rectangle\|round\|booth), `zone_color`, 3D position metadata |
| 43 | `20260622_000043_restaurant_cash.sql` | `restaurant_cash_sessions`, `restaurant_cash_entries`, `restaurant_daily_rates` |
| 44 | `20260622_000044_restaurant_delivery.sql` | `restaurant_delivery_orders`, `restaurant_virtual_brands`, `delivery_channel_enum` type, `fn_create_delivery_order()` |
| 45 | `20260622_000045_restaurant_loyalty.sql` | `restaurant_loyalty_programs`, `restaurant_loyalty_members`, `restaurant_loyalty_transactions`, `restaurant_loyalty_challenges` |
| 46 | `20260622_000046_restaurant_events.sql` | `restaurant_events`, `restaurant_event_beos`, `restaurant_event_packages` |
| 47 | `20260622_000047_restaurant_ai.sql` | `restaurant_ai_queries`, `restaurant_demand_forecasts`, `restaurant_upsell_rules`, `restaurant_menu_engineering_cache` |
| 48 | `20260622_000048_restaurant_hotel.sql` | `restaurant_outlets`, `room_number` column on `table_orders`, `restaurant_tabs` |
| 49 | `20260622_000049_restaurant_subscriptions.sql` | `restaurant_subscriptions` table with plan/trial/referral tracking |
| 50 | `20260622_000050_restaurant_zatca.sql` | `restaurant_zatca_invoices` (SA compliance) |

---

## 13. New Routes & Navigation

### New Routes (add to `App.tsx` lazy imports)

```typescript
const RestaurantHub = lazy(() => import('./pages/restaurant/RestaurantHub'));
const AnalyticsCommandCenter = lazy(() => import('./pages/restaurant/AnalyticsCommandCenter'));
const AIAssistant = lazy(() => import('./pages/restaurant/AIAssistant'));
const CashManagement = lazy(() => import('./pages/restaurant/CashManagement'));
const DeliveryHub = lazy(() => import('./pages/restaurant/DeliveryHub'));
const LoyaltyProgram = lazy(() => import('./pages/restaurant/LoyaltyProgram'));
const EventsManager = lazy(() => import('./pages/restaurant/EventsManager'));
const GhostKitchen = lazy(() => import('./pages/restaurant/GhostKitchen'));
const HotelFnB = lazy(() => import('./pages/restaurant/HotelFnB'));
const APIManagement = lazy(() => import('./pages/restaurant/APIManagement'));
```

### Full Route Table (Updated)

| Path | Page | Plan Gate | Notes |
|---|---|---|---|
| `/restaurant` | `RestaurantHub` | Starter+ | **NEW** — 3D floor plan hub, replaces redirect |
| `/restaurant/tables` | `TableManagement` | Starter+ | Floor plan editor |
| `/restaurant/waiter` | `WaiterInterface` | Starter+ | Redesigned waiter app |
| `/restaurant/menu` | `MenuManagement` | Starter+ | |
| `/restaurant/kds` | `KitchenDisplay` | Starter+ | Multi-mode KDS |
| `/restaurant/reservations` | `Reservations` | Starter+ | |
| `/restaurant/analytics` | `RestaurantAnalytics` | Starter+ | |
| `/restaurant/ai` | `AIAssistant` | Pro+ | **NEW** |
| `/restaurant/cash` | `CashManagement` | Starter+ | **NEW** |
| `/restaurant/delivery` | `DeliveryHub` | Pro+ | **NEW** |
| `/restaurant/loyalty` | `LoyaltyProgram` | Pro+ | **NEW** |
| `/restaurant/events` | `EventsManager` | Add-on | **NEW** |
| `/restaurant/ghost-kitchen` | `GhostKitchen` | Pro+ | **NEW** |
| `/restaurant/hotel` | `HotelFnB` | Enterprise | **NEW** |
| `/restaurant/argile` | `ArgileStation` | Starter+ | |
| `/restaurant/shifts` | `ShiftManager` | Starter+ | |
| `/restaurant/tips` | `TipsManagement` | Starter+ | |
| `/restaurant/eod` | `EODReport` | Starter+ | |
| `/restaurant/recipes` | `RecipeInventory` | Pro+ | |
| `/restaurant/branches` | `MultiBranchHub` | Pro+ | |
| `/restaurant/settings` | `RestaurantSettings` | Starter+ | |
| `/restaurant/settings/api` | `APIManagement` | Enterprise | **NEW** |
| `/menu/:slug` | `QRMenu` | Public | |

### Coming Soon Pages

For routes not yet implemented, render a `ComingSoonPage` component with:
- Feature description + key capabilities list
- "Notify me when ready" button (saves email to `restaurant_feature_waitlist` table)
- Estimated timeline badge
- Preview screenshot/mockup if available

Apply to: `/restaurant/hotel`, `/restaurant/ghost-kitchen` (Phase 6), `/restaurant/settings/api`.

### Navigation Update (`src/components/Layout.tsx`)

Reorganize the restaurant nav section into groups:

```
📊 Operations
  — Hub (3D Floor Plan)
  — Waiter Interface
  — Kitchen Display
  — Cash Management
  — Delivery Hub

📋 Menu & Service
  — Menu Management
  — QR Menu
  — Reservations
  — Argile Station

👥 Staff
  — Shift Manager
  — Tips Management
  — Team Performance

📈 Intelligence
  — Analytics
  — AI Assistant  [✨ Pro]
  — Demand Forecast
  — EOD Report

🏪 Business
  — Loyalty Program  [Pro]
  — Events Manager   [Add-on]
  — Multi-Branch
  — Ghost Kitchen    [Pro]
  — Recipe & Inventory

⚙️ Settings
  — Restaurant Settings
  — API & Webhooks   [Enterprise]
```

Add `[Pro]` / `[Enterprise]` / `[Add-on]` badges inline in nav items for features requiring upgrade. These are tappable and open an upgrade modal.

---

## 14. New TypeScript Types (Add to `src/types/restaurant.ts`)

```typescript
// Delivery
export type DeliveryChannel = 'toters' | 'talabat' | 'careem' | 'whatsapp' | 'phone' | 'walk_in';
export interface DeliveryOrder { /* see Section 3.5 */ }

// Loyalty
export interface LoyaltyMember {
  id: string;
  tenantId: string;
  customerName: string;
  phone?: string;
  email?: string;
  totalPoints: number;
  lifetimePoints: number;
  currentTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  visits: number;
  lastVisit?: string;
  enrolledAt: string;
  referralCode?: string;
}
export interface LoyaltyTransaction { id: string; memberId: string; orderId?: string; pointsEarned: number; pointsRedeemed: number; transactionType: 'earn' | 'redeem' | 'bonus' | 'expire' | 'adjust'; createdAt: string; }

// Events
export interface RestaurantEvent { id: string; tenantId: string; eventName: string; eventType: 'private_dining' | 'wedding' | 'corporate' | 'birthday' | 'other'; eventDate: string; covers: number; clientName: string; status: 'inquiry' | 'proposal_sent' | 'confirmed' | 'deposit_paid' | 'completed' | 'cancelled'; depositAmount?: number; totalBudget?: number; }

// Cash
export interface CashSession { id: string; tenantId: string; openedAt: string; closedAt?: string; openingBalanceUsd: number; openingBalanceLbp: number; exchangeRateAtOpen: number; closingBalanceUsd?: number; closingBalanceLbp?: number; }
export interface DailyRate { id: string; tenantId: string; date: string; rateUsdToLbp: number; setBy: string; }

// AI
export interface DemandForecast { /* see Section 3.4 */ }
export interface MenuItemEngineering { /* see Section 3.4 */ }
export interface UpsellSuggestion { /* see Section 3.4 */ }
export interface AIQuery { id: string; tenantId: string; question: string; language: 'en' | 'ar'; response: string; tokensUsed: number; createdAt: string; }

// Ghost Kitchen
export interface VirtualBrand { id: string; tenantId: string; name: string; logoUrl?: string; cuisine: string; isActive: boolean; }

// Subscriptions
export interface RestaurantSubscription { tenantId: string; plan: 'starter' | 'pro' | 'enterprise'; status: 'trial' | 'active' | 'past_due' | 'cancelled'; trialEndsAt?: string; isFoundingMember: boolean; referralCode: string; addOns: Array<'events' | 'api'>; }
```

---

## 15. Edge Functions Required

Deploy all to Supabase:

| Function | Trigger | Purpose |
|---|---|---|
| `restaurant-ai-assistant` | Called from AIAssistant.tsx | Claude API with restaurant tools |
| `restaurant-demand-forecast` | Nightly cron at 2am Beirut | Runs ML forecasting, saves to `restaurant_demand_forecasts` |
| `restaurant-upsell-compute` | Nightly cron at 3am | Computes association rules, saves to `restaurant_upsell_rules` |
| `restaurant-menu-engineering` | Nightly cron at 3:30am | Computes BCG matrix, saves to `restaurant_menu_engineering_cache` |
| `delivery-toters` | Toters webhook | Receives Toters order webhooks → `fn_create_delivery_order()` |
| `delivery-talabat` | Talabat webhook | Receives Talabat Connect webhooks |
| `delivery-careem` | Careem webhook | Receives Careem Food webhooks |
| `whatsapp-restaurant` | Called from WaiterInterface | Sends WhatsApp receipts + loyalty notifications |
| `restaurant-zatca` | After bill close (SA tenants) | Submits ZATCA e-invoice for Saudi Arabia |

---

## 16. Testing Strategy

### Unit Tests (Vitest)
- `src/utils/restaurantML.test.ts` — forecasting accuracy
- `src/utils/menuEngineering.test.ts` — BCG matrix classification
- `src/utils/upsellEngine.test.ts` — association rule calculation
- `src/utils/restaurantDB.test.ts` — Dexie offline queue

### E2E Tests (Playwright)
- `tests/e2e/restaurant-qr-flow.spec.ts` — full QR menu → pending order → waiter confirm flow
- `tests/e2e/restaurant-bill-close.spec.ts` — full bill close with payment, tip, discount
- `tests/e2e/restaurant-offline.spec.ts` — simulate offline, add orders, verify queue, reconnect sync
- `tests/e2e/restaurant-delivery.spec.ts` — delivery webhook → KDS → close flow

### Visual Regression
- `tests/visual/floor-plan-3d.spec.ts` — 3D floor plan renders and status colors
- `tests/visual/kds-modes.spec.ts` — all three KDS modes render correctly

---

## 17. Migration Path (Switching from Legacy Systems)

**Data Import Wizard (new page in onboarding):**

1. **Menu import**: CSV upload for categories + items (name EN, name AR, price USD, category, allergens). Template downloadable.
2. **Supplier import**: CSV for suppliers + basic ingredient list.
3. **Historical sales import**: CSV from prior POS (maps to `restaurant_eod_reports` as historical snapshots for ML training).
4. **Staff import**: CSV of staff names, roles, daily rates.

**Zero-friction migration commitments:**
- Can be up and running with a full menu loaded in under 2 hours
- Existing hardware works on day 1 (any Android/iOS tablet, any supported Bluetooth printer)
- Run KiTS alongside old system for 2 weeks with zero data loss
- Free data migration assistance for Enterprise

---

## 18. Implementation Priority Summary

**Phase 0 — Close Gaps (Immediate):**
- [ ] Bill close / payment flow (`CloseBillModal`)
- [ ] Send to KDS button + order status update
- [ ] QR menu E2E + pending orders panel in WaiterInterface
- [ ] Menu item photo upload

**Phase 1 — Visual Revolution:**
- [ ] Install 3D dependencies (react-three-fiber, drei, framer-motion, nivo)
- [ ] `RestaurantHub.tsx` with 3D floor plan + toggle to Command Center
- [ ] `FloorPlan3D.tsx` component with live status glow
- [ ] `AnalyticsCommandCenter.tsx` with Nivo charts + KPI cards
- [ ] Replace all polling with Supabase real-time channels
- [ ] Redesign WaiterInterface with thumb-zone layout
- [ ] Apply Framer Motion animations across all restaurant pages
- [ ] AI upsell prompts in QuickAddModal (placeholder UI until Phase 2 data)
- [ ] Premium dark luxury design system tokens applied globally

**Phase 2 — AI Layer:**
- [ ] `restaurant-ai-assistant` Edge Function + Claude API integration
- [ ] `AIAssistant.tsx` chat page
- [ ] AI assistant panel in AnalyticsCommandCenter
- [ ] Demand forecasting Edge Function (nightly cron)
- [ ] Demand forecast UI in analytics
- [ ] Menu engineering matrix UI in analytics
- [ ] AI menu content generator in ItemFormModal
- [ ] Upsell computation Edge Function + QuickAddModal integration

**Phase 3 — Offline PWA:**
- [ ] Vite PWA plugin + service worker config
- [ ] Dexie.js offline order queue
- [ ] Offline detection + banner component
- [ ] Sync-on-reconnect logic
- [ ] Offline cash tracking

**Phase 4 — Operations Complete:**
- [ ] Dual-currency cash drawer system + `CashManagement.tsx`
- [ ] Exchange rate management in RestaurantSettings
- [ ] Delivery aggregation hub + `DeliveryHub.tsx`
- [ ] Delivery Edge Functions (Toters, Talabat, Careem)
- [ ] Modifier groups in waiter interface
- [ ] Bill split UI
- [ ] Course management + Fire Course button
- [ ] Reservation ↔ Table link

**Phase 5 — Revenue Features:**
- [ ] Loyalty ecosystem + `LoyaltyProgram.tsx`
- [ ] Events module + `EventsManager.tsx`
- [ ] Ghost kitchen module + `GhostKitchen.tsx`
- [ ] Staff performance dashboard
- [ ] Auto-86 from recipe stock (ingredient → menu item)
- [ ] WhatsApp integration (receipts + loyalty)

**Phase 6 — Expansion:**
- [ ] Hotel F&B module + `HotelFnB.tsx`
- [ ] Bar & nightclub tab management
- [ ] ZATCA compliance (Saudi)
- [ ] Public API + webhooks management
- [ ] GCC localization (AED, SAR, KWD currency support)
- [ ] Data import migration wizard

---

*Document maintained by KiTS development team. AI agents implementing features must read Sections 0, 2, and 4 before writing any code. Reference `docs/f&b-plan.md` for the current implementation baseline.*
