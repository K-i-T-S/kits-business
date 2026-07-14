import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { cacheBootstrapData, clearAllCachedCredentials, clearBootstrapData } from '../offlineAuth/credentialCache';
import { powerSyncDb } from '../powersync/db';
import { DataValidator } from '../utils/dataValidation';
import { log } from '../utils/logger';
import { StockUpdateLock, OperationQueue } from '../utils/raceConditionPrevention';
import { supabase } from '../utils/supabaseClient';
import { getCurrentUserTenant } from '../utils/tenantManager';

import type { SplitPayment } from '../types/pos';

// ── Activity log helper ───────────────────────────────────────────────────────
// Fire-and-forget: never awaited, never throws, never blocks a mutation.
function logActivity(params: {
  tenantId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const { error } = await supabase.from('activity_log').insert({
        tenant_id: params.tenantId,
        user_id: data.user?.id ?? null,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        metadata: params.metadata ?? null,
      });
      if (error) console.warn('[ActivityLog] Insert failed:', error.message);
    } catch (err) {
      console.warn('[ActivityLog] getUser failed:', err);
    }
  })();
}

export interface Product {
  id?: string;
  name: string;
  barcode: string;
  sku: string;
  variants: ProductVariant[];
  supplier: string;
  category: string;
  validityDate?: string;
}

export interface ProductVariant {
  id: string;
  attributes: Record<string, string>;
  cost: number;
  costHistory: CostEntry[];
  price: number;
  stock: number;
  reorderLevel: number;
}

export interface CostEntry {
  date: string;
  cost: number;
  quantity: number;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  employeeId: string;
  customerId?: string;
  /** Real tax/discount breakdown -- previously computed correctly in POS.tsx
   * but never threaded through to persistence (BUG-033); sale.total already
   * reflects the taxed/discounted amount either way. */
  tax?: number;
  discount?: number;
  /** Per-method breakdown for a split-payment sale (2+ methods); omit for a
   * single-method sale, which paymentMethod already fully describes
   * (BUG-032). */
  payments?: SplitPayment[];
}

export interface SaleItem {
  productId: string;
  variantId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  debtBalance: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  visitCount?: number;
  createdAt?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'supervisor' | 'cashier' | 'accountant' | 'stockkeeper' | 'viewer';
  commission: number;
  totalSales: number;
  shifts: Shift[];
  /** Real Supabase Auth identity link, if this employee has one (PIN or
   * email-invited staff) -- null for pure labor/commission-tracking
   * records with no login capability. Added for BUG-011: TipsManagement.tsx
   * needs this to resolve real waiters and previously had to run its own
   * independent employees fetch just to get it. */
  user_id: string | null;
}

export interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  salesCount: number;
  totalRevenue: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  userRole: 'owner' | 'admin' | 'manager' | 'supervisor' | 'accountant' | 'stockkeeper' | 'cashier' | 'viewer';
  settings: Record<string, unknown>;
  brand_logo_url?: string | null;
  brand_primary?: string;
  brand_secondary?: string;
  brand_tagline?: string | null;
  tax_rate?: number;
  secondary_currency?: string;
  exchange_rate?: number;
  show_dual_currency?: boolean;
  tin?: string | null;
  loyalty_enabled?: boolean;
  loyalty_points_per_dollar?: number;
  loyalty_points_redeem_rate?: number;
  industry?: string | null;
  qr_menu_palette?: string | null;
  tenant_slug?: string | null;
  qr_menu_promotional_banner?: string | null;
}

// ── Tenant RPC row shape (returned by get_current_user_tenant()) ──────────────
interface TenantRpcRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: string;
  settings: Record<string, unknown> | null;
  brand_logo_url?: string | null;
  brand_primary?: string | null;
  brand_secondary?: string | null;
  brand_tagline?: string | null;
  tax_rate?: number | null;
  secondary_currency?: string | null;
  exchange_rate?: number | null;
  show_dual_currency?: boolean | null;
  tin?: string | null;
  loyalty_enabled?: boolean | null;
  loyalty_points_per_dollar?: number | null;
  loyalty_points_redeem_rate?: number | null;
  industry?: string | null;
  qr_menu_palette?: string | null;
  qr_menu_promotional_banner?: string | null;
}

function applyBrandColors(primary?: string, secondary?: string) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primary ?? '#6366f1');
  root.style.setProperty('--brand-secondary', secondary ?? '#0ea5e9');
}

function applyFavicon(logoUrl?: string | null) {
  if (!logoUrl) return;
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  link.href = logoUrl;
  if (!existing) document.head.appendChild(link);
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface AppContextType {
  user: User | null;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  employees: Employee[];
  currentEmployee: Employee | null;
  currentTenant: Tenant | null;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  addProduct: (product: Product) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  addSale: (sale: Sale) => Promise<Sale | undefined>;
  addCustomer: (customer: Customer) => Promise<Customer>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<Customer>;
  addEmployee: (employee: Employee) => Promise<Employee>;
  updateEmployee: (id: string, employee: Partial<Employee>) => Promise<Employee>;
  updateStock: (productId: string, variantId: string, quantity: number) => Promise<Product>;
  setCurrentEmployee: (employee: Employee | null) => void;
  switchTenant: (tenantId: string) => void;
  setUser: (user: User | null) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  loading: boolean;
  hasSession: boolean;
  authMode: 'online' | 'provisional';
  establishProvisionalSession: (tenant: Tenant, employeeRoster: Employee[], signedInEmployee: Employee) => void;
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface DbProduct {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  supplier?: string | null;
  validity_date: string | null;
  price: number;
  cost: number;
  stock_quantity: number;
  min_stock_level: number;
}

interface DbCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  debt_balance: number;
  total_purchases: number;
  visit_count: number;
  last_purchase_date: string | null;
  created_at: string;
}

interface DbEmployee {
  id: string;
  name: string;
  email: string | null;
  role: string;
  commission_rate: number;
  is_active: boolean;
  user_id: string | null;
}

interface DbSaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DbSale {
  id: string;
  sale_date: string;
  subtotal: number;
  total_amount: number;
  payment_method: string | null;
  employee_id: string | null;
  customer_id: string | null;
  sale_items: DbSaleItem[];
}

// ── Transformers ──────────────────────────────────────────────────────────────

function dbProductToFrontend(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode ?? '',
    sku: p.sku ?? '',
    category: p.category ?? '',
    supplier: p.supplier ?? '',
    validityDate: p.validity_date ?? undefined,
    variants: [{
      id: `${p.id}-v0`,
      attributes: {},
      cost: p.cost,
      costHistory: [],
      price: p.price,
      stock: p.stock_quantity,
      reorderLevel: p.min_stock_level,
    }],
  };
}

function dbCustomerToFrontend(c: DbCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? undefined,
    debtBalance: c.debt_balance ?? 0,
    totalPurchases: c.total_purchases,
    visitCount: c.visit_count,
    lastPurchaseDate: c.last_purchase_date ?? undefined,
    createdAt: c.created_at,
  };
}

const VALID_EMPLOYEE_ROLES: readonly Employee['role'][] =
  ['owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'stockkeeper', 'viewer'];

function dbEmployeeToFrontend(e: DbEmployee): Employee {
  // Previously aliased DB role 'owner' -> frontend 'admin' (and the write
  // paths below aliased the reverse) -- a leftover from before
  // employees.role's CHECK constraint was widened to all 8 roles (it now
  // is, verified live). With no DB-level reason left, this silently
  // mislabeled a real owner's own employee record as "admin" on every
  // read, and silently stored "owner" instead of "admin" on every write
  // through addEmployee/updateEmployee below -- a real data-accuracy bug,
  // found via a platform-wide audit. Now stores/displays the actual
  // value, fail-closed to 'viewer' for anything unrecognized (same
  // pattern as coerceRole in SubscriptionContext.tsx).
  const role = (VALID_EMPLOYEE_ROLES as readonly string[]).includes(e.role)
    ? (e.role as Employee['role'])
    : 'viewer';
  return {
    id: e.id,
    name: e.name,
    email: e.email ?? '',
    role,
    commission: e.commission_rate,
    totalSales: 0,
    shifts: [],
    user_id: e.user_id,
  };
}

function dbSaleToFrontend(s: DbSale): Sale {
  return {
    id: s.id,
    date: s.sale_date,
    subtotal: s.subtotal,
    total: s.total_amount,
    paymentMethod: (s.payment_method as 'cash' | 'card') ?? 'cash',
    employeeId: s.employee_id ?? '',
    customerId: s.customer_id ?? undefined,
    items: (s.sale_items ?? []).map((item) => ({
      productId: item.product_id,
      variantId: `${item.product_id}-v0`,
      productName: '',
      quantity: item.quantity,
      price: item.unit_price,
      cost: 0,
    })),
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  // 'provisional' = identity verified locally (offline PIN check) with no
  // real Supabase session yet -- see src/offlineAuth/*.ts and
  // PinLockScreen's submitPin(). Reset to 'online' the moment a real
  // session actually lands, in the onAuthStateChange handler below.
  const [authMode, setAuthMode] = useState<'online' | 'provisional'>('online');

  const loadData = useCallback(async () => {
    // RLS handles tenant isolation server-side via current_tenant_id().
    // We only need a valid auth session — no React state dependency required.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);
    try {
      const [productsRes, salesRes, customersRes, employeesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('sales').select('*, sale_items(*)').order('sale_date', { ascending: false }).limit(500),
        supabase.from('customers').select('*').order('name'),
        supabase.from('employees').select('*').eq('is_active', true).order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (employeesRes.error) throw employeesRes.error;

      const frontendProducts = (productsRes.data as DbProduct[]).map(dbProductToFrontend);
      const frontendSales = (salesRes.data as DbSale[]).map(dbSaleToFrontend);
      const frontendCustomers = (customersRes.data as DbCustomer[]).map(dbCustomerToFrontend);
      const frontendEmployees = (employeesRes.data as DbEmployee[]).map(dbEmployeeToFrontend);

      setProducts(frontendProducts);
      setSales(frontendSales);
      setCustomers(frontendCustomers);
      setEmployees(frontendEmployees);

      setCurrentEmployee(prev => (prev === null && frontendEmployees.length > 0) ? (frontendEmployees[0] ?? null) : prev);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to load data', errorObj);
      toast.error('Failed to load data', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setLoading(false);
    }
  }, []); // stable — RLS enforces tenant isolation, no React state needed here

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const sessionResult = await supabase.auth.getSession();
        if (!isMounted) return;
        const session = sessionResult?.data?.session;
        setHasSession(!!session);
        if (session) {
          try {
            const tenantData = await getCurrentUserTenant() as TenantRpcRow | null;
            if (tenantData && isMounted) {
              const tenant: Tenant = {
                id: tenantData.tenant_id,
                name: tenantData.tenant_name,
                slug: tenantData.tenant_slug,
                userRole: tenantData.user_role as Tenant['userRole'],
                settings: tenantData.settings || {},
                brand_logo_url: tenantData.brand_logo_url ?? null,
                brand_primary: tenantData.brand_primary ?? '#6366f1',
                brand_secondary: tenantData.brand_secondary ?? '#0ea5e9',
                brand_tagline: tenantData.brand_tagline ?? null,
                tax_rate: tenantData.tax_rate !== null ? Number(tenantData.tax_rate) : undefined,
                secondary_currency: tenantData.secondary_currency ?? 'LBP',
                exchange_rate: tenantData.exchange_rate !== null ? Number(tenantData.exchange_rate) : undefined,
                show_dual_currency: tenantData.show_dual_currency ?? false,
                tin: tenantData.tin ?? null,
                loyalty_enabled: tenantData.loyalty_enabled ?? false,
                loyalty_points_per_dollar: tenantData.loyalty_points_per_dollar !== null && tenantData.loyalty_points_per_dollar !== undefined ? Number(tenantData.loyalty_points_per_dollar) : 1,
                loyalty_points_redeem_rate: tenantData.loyalty_points_redeem_rate !== null && tenantData.loyalty_points_redeem_rate !== undefined ? Number(tenantData.loyalty_points_redeem_rate) : 0.01,
                industry: tenantData.industry ?? null,
                qr_menu_palette: tenantData.qr_menu_palette ?? null,
                qr_menu_promotional_banner: tenantData.qr_menu_promotional_banner ?? null,
              };
              setCurrentTenant(tenant);
              applyBrandColors(tenant.brand_primary, tenant.brand_secondary);
              applyFavicon(tenant.brand_logo_url);
            }
          } catch (tenantError) {
            const errorObj = tenantError instanceof Error ? tenantError : new Error(String(tenantError));
            log.error('Failed to load tenant', errorObj);
          }
          if (isMounted) void loadData();
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to get session', errorObj);
        if (!isMounted) return;
        setHasSession(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (session) {
        // A real session just landed (fresh login, or a provisional
        // session's background retry finally succeeding) -- always online
        // from here, regardless of what authMode was a moment ago.
        setAuthMode('online');
        void (async () => {
          try {
            const tenantData = await getCurrentUserTenant() as TenantRpcRow | null;
            if (!isMounted) return;
            if (tenantData) {
              const tenant: Tenant = {
                id: tenantData.tenant_id,
                name: tenantData.tenant_name,
                slug: tenantData.tenant_slug,
                userRole: tenantData.user_role as Tenant['userRole'],
                settings: tenantData.settings || {},
                brand_logo_url: tenantData.brand_logo_url ?? null,
                brand_primary: tenantData.brand_primary ?? '#6366f1',
                brand_secondary: tenantData.brand_secondary ?? '#0ea5e9',
                brand_tagline: tenantData.brand_tagline ?? null,
                tax_rate: tenantData.tax_rate !== null ? Number(tenantData.tax_rate) : undefined,
                secondary_currency: tenantData.secondary_currency ?? 'LBP',
                exchange_rate: tenantData.exchange_rate !== null ? Number(tenantData.exchange_rate) : undefined,
                show_dual_currency: tenantData.show_dual_currency ?? false,
                tin: tenantData.tin ?? null,
                loyalty_enabled: tenantData.loyalty_enabled ?? false,
                loyalty_points_per_dollar: tenantData.loyalty_points_per_dollar !== null && tenantData.loyalty_points_per_dollar !== undefined ? Number(tenantData.loyalty_points_per_dollar) : 1,
                loyalty_points_redeem_rate: tenantData.loyalty_points_redeem_rate !== null && tenantData.loyalty_points_redeem_rate !== undefined ? Number(tenantData.loyalty_points_redeem_rate) : 0.01,
                industry: tenantData.industry ?? null,
                qr_menu_palette: tenantData.qr_menu_palette ?? null,
                qr_menu_promotional_banner: tenantData.qr_menu_promotional_banner ?? null,
              };
              setCurrentTenant(tenant);
              applyBrandColors(tenant.brand_primary, tenant.brand_secondary);
              applyFavicon(tenant.brand_logo_url);
            }
            void loadData();
          } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            log.error('Failed to load tenant on auth change', errorObj);
          }
        })();
      } else {
        setProducts([]);
        setSales([]);
        setCustomers([]);
        setEmployees([]);
        setCurrentEmployee(null);
        setCurrentTenant(null);
        // A genuine full sign-out (session === null), not a PIN swap to a
        // different employee -- a PIN swap produces a new session for the
        // new employee and never hits this branch, so the locally-cached
        // PowerSync data and offline-auth caches (same tenant regardless
        // of which employee is signed in) are correctly left intact across
        // PIN swaps. Wipe them only here, where the device is genuinely
        // leaving this tenant -- a signed-out device shouldn't retain
        // another tenant's cached credentials or data indefinitely.
        void powerSyncDb.disconnectAndClear();
        void clearAllCachedCredentials();
        void clearBootstrapData();
        setAuthMode('online');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData]);

  // Refreshes the offline bootstrap cache (src/offlineAuth/credentialCache.ts)
  // whenever a genuine online tenant+employee snapshot is available --
  // deliberately excludes authMode==='provisional' data, which would just
  // be re-caching the last cache back onto itself. This is what lets the
  // app render something correct if it's opened cold while already
  // offline, not just "went offline mid-session" (where in-memory state
  // is already populated regardless of this cache).
  useEffect(() => {
    if (authMode !== 'online' || !currentTenant || employees.length === 0) return;
    void cacheBootstrapData({
      tenant: currentTenant as unknown as Record<string, unknown>,
      employees: employees as unknown as Array<Record<string, unknown>>,
    });
  }, [authMode, currentTenant, employees]);

  // ── Products ─────────────────────────────────────────────────────────────

  const addProduct = async (product: Product) => {
    const validation = DataValidator.validateProduct(product);
    if (!validation.isValid) {
      toast.error('Validation failed', { description: validation.errors.join(', ') });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', { description: validation.warnings.join(', ') });
    }

    if (!currentTenant) throw new Error('No active tenant');

    try {
      const variant = product.variants?.[0];
      log.info('Creating product', { product });

      const insertResult = await supabase.from('products').insert({
        tenant_id: currentTenant.id,
        name: product.name,
        sku: product.sku || null,
        barcode: product.barcode || null,
        category: product.category || null,
        supplier: product.supplier || null,
        validity_date: product.validityDate || null,
        price: variant?.price ?? 0,
        cost: variant?.cost ?? 0,
        stock_quantity: variant?.stock ?? 0,
        min_stock_level: variant?.reorderLevel ?? 0,
      }).select().single();

      if (insertResult.error) throw insertResult.error;

      const newProduct = dbProductToFrontend(insertResult.data as DbProduct);
      log.info('Product created successfully', { newProduct });
      setProducts(prev => [...prev, newProduct]);
      toast.success('Product added', { description: newProduct.name });
      logActivity({
        tenantId: currentTenant.id,
        action: 'product_created',
        entityType: 'product',
        entityId: newProduct.id,
        metadata: { name: newProduct.name },
      });
      return newProduct;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to add product', errorObj);
      toast.error('Failed to add product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateProduct = async (id: string, updatedProduct: Partial<Product>) => {
    try {
      const variant = updatedProduct.variants?.[0];
      const dbUpdate: Record<string, unknown> = {};
      if (updatedProduct.name !== undefined) dbUpdate.name = updatedProduct.name;
      if (updatedProduct.sku !== undefined) dbUpdate.sku = updatedProduct.sku;
      if (updatedProduct.barcode !== undefined) dbUpdate.barcode = updatedProduct.barcode;
      if (updatedProduct.category !== undefined) dbUpdate.category = updatedProduct.category;
      if (updatedProduct.supplier !== undefined) dbUpdate.supplier = updatedProduct.supplier;
      if (updatedProduct.validityDate !== undefined) dbUpdate.validity_date = updatedProduct.validityDate;
      if (variant?.price !== undefined) dbUpdate.price = variant.price;
      if (variant?.cost !== undefined) dbUpdate.cost = variant.cost;
      if (variant?.stock !== undefined) dbUpdate.stock_quantity = variant.stock;
      if (variant?.reorderLevel !== undefined) dbUpdate.min_stock_level = variant.reorderLevel;

      const updateResult = await supabase.from('products').update(dbUpdate).eq('id', id).select().single();
      if (updateResult.error) throw updateResult.error;

      const updated = dbProductToFrontend(updateResult.data as DbProduct);
      setProducts(prev => prev.map(p => p.id === id ? updated : p));
      toast.success('Product updated', { description: updated.name });
      if (currentTenant) {
        logActivity({
          tenantId: currentTenant.id,
          action: 'product_updated',
          entityType: 'product',
          entityId: updated.id,
          metadata: { name: updated.name },
        });
      }
      return updated;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to update product', errorObj);
      toast.error('Failed to update product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Product deleted');
      if (currentTenant) {
        logActivity({
          tenantId: currentTenant.id,
          action: 'product_deleted',
          entityType: 'product',
          entityId: id,
        });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to delete product', errorObj);
      toast.error('Failed to delete product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  // ── Sales ────────────────────────────────────────────────────────────────

  const addSale = async (sale: Sale) => {
    const validation = DataValidator.validateSale(sale);
    if (!validation.isValid) {
      toast.error('Validation failed', { description: validation.errors.join(', ') });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', { description: validation.warnings.join(', ') });
    }

    if (!currentTenant) throw new Error('No active tenant');

    try {
      // Always write through PowerSync's local database -- online and
      // offline are the same code path, no navigator.onLine branch needed.
      // sale.id is generated client-side by the caller (crypto.randomUUID())
      // and is canonical everywhere: a genuinely offline write can't wait
      // on a server round-trip for an id that might not arrive for days.
      await powerSyncDb.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO sales (id, tenant_id, employee_id, customer_id, subtotal, total_amount, discount, tax_amount, payment_method, payment_status, sale_date, payment_breakdown)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sale.id,
            currentTenant.id,
            sale.employeeId || currentEmployee?.id || null,
            sale.customerId ?? null,
            sale.subtotal,
            sale.total,
            sale.discount ?? 0,
            sale.tax ?? 0,
            sale.paymentMethod,
            'completed',
            sale.date,
            sale.payments && sale.payments.length > 0 ? JSON.stringify(sale.payments) : null,
          ],
        );

        for (const item of sale.items) {
          await tx.execute(
            `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total_price)
             VALUES (uuid(), ?, ?, ?, ?, ?)`,
            [sale.id, item.productId, item.quantity, item.price, item.price * item.quantity],
          );

          // Stock delta -- the connector's uploadData() computes the actual
          // delta from PowerSync's trackPrevious tracking and applies it via
          // apply_product_stock_delta() on sync, so the absolute-value race
          // the old online path had (two concurrent sales both reading the
          // same stale stock and overwriting each other's decrement) can't
          // reoccur once this syncs.
          const product = products.find(p => p.id === item.productId);
          const currentStock = product?.variants?.[0]?.stock ?? 0;
          await tx.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [Math.max(0, currentStock - item.quantity), item.productId],
          );
        }
      });

      const newSale: Sale = { ...sale };
      setSales(prev => [newSale, ...prev]);

      // Optimistic local stock update mirroring the write above -- the UI
      // reflects it immediately rather than waiting on a server refetch,
      // which may not complete for a long time while offline.
      setProducts(prev => prev.map((p) => {
        if (p.id === undefined) return p;
        const soldQty = sale.items
          .filter(item => item.productId === p.id)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (soldQty === 0) return p;
        const variant = p.variants[0];
        if (!variant) return p;
        return {
          ...p,
          variants: [{ ...variant, stock: Math.max(0, variant.stock - soldQty) }, ...p.variants.slice(1)],
        };
      }));

      // customers/activity_log aren't in PowerSync's offline sync scope --
      // only attempt these when genuinely connected, using PowerSync's own
      // connection status rather than navigator.onLine (which reflects
      // "has a network interface," not "an actual connection succeeded").
      if (powerSyncDb.currentStatus.connected && sale.customerId) {
        const customer = customers.find(c => c.id === sale.customerId);
        if (customer) {
          await supabase.from('customers').update({
            total_purchases: customer.totalPurchases + sale.total,
            visit_count: (customer.visitCount ?? 0) + 1,
            last_purchase_date: new Date().toISOString(),
          }).eq('id', sale.customerId);
          setCustomers(prev => prev.map(c =>
            c.id === sale.customerId
              ? { ...c, totalPurchases: c.totalPurchases + sale.total, visitCount: (c.visitCount ?? 0) + 1 }
              : c,
          ));
        }
      }

      toast.success('Sale recorded', { description: `Total $${sale.total.toFixed(2)}` });
      if (powerSyncDb.currentStatus.connected) {
        logActivity({
          tenantId: currentTenant.id,
          action: 'sale_created',
          entityType: 'sale',
          entityId: newSale.id,
          metadata: { total: sale.total, items: sale.items.length },
        });
      }
      return newSale;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to add sale', errorObj);
      toast.error('Failed to record sale', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  // ── Customers ────────────────────────────────────────────────────────────

  const addCustomer = async (customer: Customer) => {
    const validation = DataValidator.validateCustomer(customer);
    if (!validation.isValid) {
      toast.error('Validation failed', { description: validation.errors.join(', ') });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', { description: validation.warnings.join(', ') });
    }

    if (!currentTenant) throw new Error('No active tenant');

    try {
      const insertResult = await supabase.from('customers').insert({
        tenant_id: currentTenant.id,
        name: customer.name,
        phone: customer.phone || null,
        email: customer.email || null,
        total_purchases: 0,
        visit_count: 0,
      }).select().single();

      if (insertResult.error) throw insertResult.error;

      const newCustomer = dbCustomerToFrontend(insertResult.data as DbCustomer);
      setCustomers(prev => [...prev, newCustomer]);
      toast.success('Customer added', { description: newCustomer.name });
      logActivity({
        tenantId: currentTenant.id,
        action: 'customer_created',
        entityType: 'customer',
        entityId: newCustomer.id,
        metadata: { name: newCustomer.name },
      });
      return newCustomer;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to add customer', errorObj);
      toast.error('Failed to add customer', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateCustomer = async (id: string, updatedCustomer: Partial<Customer>) => {
    try {
      const dbUpdate: Record<string, unknown> = {};
      if (updatedCustomer.name !== undefined) dbUpdate.name = updatedCustomer.name;
      if (updatedCustomer.phone !== undefined) dbUpdate.phone = updatedCustomer.phone;
      if (updatedCustomer.email !== undefined) dbUpdate.email = updatedCustomer.email;
      if (updatedCustomer.totalPurchases !== undefined) dbUpdate.total_purchases = updatedCustomer.totalPurchases;
      if (updatedCustomer.visitCount !== undefined) dbUpdate.visit_count = updatedCustomer.visitCount;
      if (updatedCustomer.lastPurchaseDate !== undefined) dbUpdate.last_purchase_date = updatedCustomer.lastPurchaseDate;

      const updateResult = await supabase.from('customers').update(dbUpdate).eq('id', id).select().single();
      if (updateResult.error) throw updateResult.error;

      const updated = dbCustomerToFrontend(updateResult.data as DbCustomer);
      setCustomers(prev => prev.map(c => c.id === id ? updated : c));
      toast.success('Customer updated', { description: updated.name });
      if (currentTenant) {
        logActivity({
          tenantId: currentTenant.id,
          action: 'customer_updated',
          entityType: 'customer',
          entityId: updated.id,
          metadata: { name: updated.name },
        });
      }
      return updated;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to update customer', errorObj);
      toast.error('Failed to update customer', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  // ── Employees ────────────────────────────────────────────────────────────

  const addEmployee = async (employee: Employee) => {
    const validation = DataValidator.validateEmployee(employee);
    if (!validation.isValid) {
      toast.error('Validation failed', { description: validation.errors.join(', ') });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', { description: validation.warnings.join(', ') });
    }

    if (!currentTenant) throw new Error('No active tenant');

    try {
      const insertResult = await supabase.from('employees').insert({
        tenant_id: currentTenant.id,
        name: employee.name,
        email: employee.email || null,
        role: employee.role,
        commission_rate: employee.commission ?? 0,
        is_active: true,
      }).select().single();

      if (insertResult.error) throw insertResult.error;

      const newEmployee = dbEmployeeToFrontend(insertResult.data as DbEmployee);
      setEmployees(prev => [...prev, newEmployee]);
      toast.success('Employee created', { description: newEmployee.name });
      logActivity({
        tenantId: currentTenant.id,
        action: 'employee_created',
        entityType: 'employee',
        entityId: newEmployee.id,
        metadata: { name: newEmployee.name },
      });
      return newEmployee;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to add employee', errorObj);
      toast.error('Failed to add employee', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateEmployee = async (id: string, updatedEmployee: Partial<Employee>) => {
    try {
      const dbUpdate: Record<string, unknown> = {};
      if (updatedEmployee.name !== undefined) dbUpdate.name = updatedEmployee.name;
      if (updatedEmployee.email !== undefined) dbUpdate.email = updatedEmployee.email;
      if (updatedEmployee.role !== undefined) dbUpdate.role = updatedEmployee.role;
      if (updatedEmployee.commission !== undefined) dbUpdate.commission_rate = updatedEmployee.commission;

      const updateResult = await supabase.from('employees').update(dbUpdate).eq('id', id).select().single();
      if (updateResult.error) throw updateResult.error;

      const updated = dbEmployeeToFrontend(updateResult.data as DbEmployee);
      setEmployees(prev => prev.map(e => e.id === id ? updated : e));
      if (currentEmployee?.id === id) setCurrentEmployee(updated);
      toast.success('Employee updated', { description: updated.name });
      if (currentTenant) {
        logActivity({
          tenantId: currentTenant.id,
          action: 'employee_updated',
          entityType: 'employee',
          entityId: updated.id,
          metadata: { name: updated.name },
        });
      }
      return updated;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to update employee', errorObj);
      toast.error('Failed to update employee', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  // ── Stock ────────────────────────────────────────────────────────────────

  const updateStock = async (productId: string, variantId: string, quantity: number) => {
    const validation = DataValidator.validateStockUpdate(productId, variantId, quantity);
    if (!validation.isValid) {
      toast.error('Validation failed', { description: validation.errors.join(', ') });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const operationId = StockUpdateLock.acquireLock(productId, variantId);
    if (!operationId) {
      toast.error('Stock update in progress', {
        description: 'Another operation is updating this stock. Please try again.',
      });
      throw new Error('Stock update locked');
    }

    try {
      const result = await OperationQueue.enqueue(
        `stock-${productId}-${variantId}`,
        async () => {
          const stockResult = await supabase
            .from('products')
            .update({ stock_quantity: Math.max(0, quantity) })
            .eq('id', productId)
            .select()
            .single();
          if (stockResult.error) throw stockResult.error;
          return dbProductToFrontend(stockResult.data as DbProduct);
        },
        'stock-update',
      );

      setProducts(prev => prev.map(p => p.id === productId ? result : p));
      toast.success('Stock updated');
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to update stock', errorObj);
      toast.error('Failed to update stock', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    } finally {
      StockUpdateLock.releaseLock(productId, variantId, operationId);
    }
  };

  // ── Tenant ───────────────────────────────────────────────────────────────

  const switchTenant = (_tenantId: string) => {
    void setTimeout(() => { void loadData(); }, 100);
  };

  // Establishes identity from a LOCAL, offline-verified PIN check --
  // src/offlineAuth/*.ts -- with no real Supabase session. Populates
  // currentTenant/currentEmployee/employees from the last cached online
  // snapshot so the app has something correct to render, and sets
  // hasSession=true so existing "am I logged in" guards throughout the app
  // keep working without needing to special-case provisional mode
  // individually. authMode='provisional' is the actual signal that
  // distinguishes this from a real session, for the few places that need
  // to know (route-gating to the core-POS-only offline scope).
  const establishProvisionalSession = useCallback((tenant: Tenant, employeeRoster: Employee[], signedInEmployee: Employee) => {
    setCurrentTenant(tenant);
    setEmployees(employeeRoster);
    setCurrentEmployee(signedInEmployee);
    setHasSession(true);
    setAuthMode('provisional');
  }, []);

  if (loading && hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      user: null,
      products,
      sales,
      customers,
      employees,
      currentEmployee,
      currentTenant,
      isModalOpen,
      setModalOpen: setIsModalOpen,
      addProduct,
      updateProduct,
      deleteProduct,
      addSale,
      addCustomer,
      updateCustomer,
      addEmployee,
      updateEmployee,
      setCurrentEmployee,
      switchTenant,
      updateStock,
      loading,
      hasSession,
      authMode,
      establishProvisionalSession,
      setUser: () => {},
      setCurrentTenant,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
