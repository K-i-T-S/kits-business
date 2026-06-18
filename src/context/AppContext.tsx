import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { DataValidator } from '../utils/dataValidation';
import { log } from '../utils/logger';
import { queueMutation } from '../utils/offlineQueue';
import { StockUpdateLock, OperationQueue } from '../utils/raceConditionPrevention';
import { supabase } from '../utils/supabaseClient';
import { getCurrentUserTenant } from '../utils/tenantManager';

// ── Activity log helper ───────────────────────────────────────────────────────
// Fire-and-forget: never awaited, never throws, never blocks a mutation.
function logActivity(params: {
  tenantId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): void {
  supabase.auth.getUser().then(({ data }) => {
    supabase.from('activity_log').insert({
      tenant_id: params.tenantId,
      user_id: data.user?.id ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    }).then(({ error }) => {
      if (error) console.warn('[ActivityLog] Insert failed:', error.message);
    });
  }).catch(err => {
    console.warn('[ActivityLog] getUser failed:', err);
  });
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
  role: 'admin' | 'manager' | 'cashier';
  commission: number;
  totalSales: number;
  shifts: Shift[];
}

export interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  salesCount: number;
  totalRevenue: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  userRole: 'owner' | 'manager' | 'cashier' | 'viewer';
  settings: Record<string, unknown>;
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
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addSale: (sale: Sale) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  updateStock: (productId: string, variantId: string, quantity: number) => void;
  setCurrentEmployee: (employee: Employee | null) => void;
  switchTenant: (tenantId: string) => void;
  setUser: (user: User | null) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  loading: boolean;
  hasSession: boolean;
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

function dbEmployeeToFrontend(e: DbEmployee): Employee {
  return {
    id: e.id,
    name: e.name,
    email: e.email ?? '',
    role: e.role === 'owner' ? 'admin' : (e.role as 'manager' | 'cashier'),
    commission: e.commission_rate,
    totalSales: 0,
    shifts: [],
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

      if (frontendEmployees.length > 0 && !currentEmployee) {
        setCurrentEmployee(frontendEmployees[0] ?? null);
      }
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
            const tenantData = await getCurrentUserTenant();
            if (tenantData && isMounted) {
              setCurrentTenant({
                id: tenantData.tenant_id,
                name: tenantData.tenant_name,
                slug: tenantData.tenant_slug,
                userRole: tenantData.user_role,
                settings: tenantData.settings || {},
              });
            }
          } catch (tenantError) {
            const errorObj = tenantError instanceof Error ? tenantError : new Error(String(tenantError));
            log.error('Failed to load tenant', errorObj);
          }
          if (isMounted) loadData();
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to get session', errorObj);
        if (!isMounted) return;
        setHasSession(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (session) {
        getCurrentUserTenant().then(tenantData => {
          if (tenantData) {
            setCurrentTenant({
              id: tenantData.tenant_id,
              name: tenantData.tenant_name,
              slug: tenantData.tenant_slug,
              userRole: tenantData.user_role,
              settings: tenantData.settings || {},
            });
          }
        }).catch(error => {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          log.error('Failed to load tenant on auth change', errorObj);
        }).finally(() => { loadData(); });
      } else {
        setProducts([]);
        setSales([]);
        setCustomers([]);
        setEmployees([]);
        setCurrentEmployee(null);
        setCurrentTenant(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData]);

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

      const { data, error } = await supabase.from('products').insert({
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

      if (error) throw error;

      const newProduct = dbProductToFrontend(data as DbProduct);
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

      const { data, error } = await supabase.from('products').update(dbUpdate).eq('id', id).select().single();
      if (error) throw error;

      const updated = dbProductToFrontend(data as DbProduct);
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

    // Offline path: queue for later replay
    if (!navigator.onLine) {
      await queueMutation({
        table: 'sales',
        operation: 'insert',
        payload: {
          tenant_id: currentTenant.id,
          employee_id: sale.employeeId || currentEmployee?.id || null,
          customer_id: sale.customerId || null,
          subtotal: sale.subtotal,
          total_amount: sale.total,
          discount: 0,
          tax_amount: 0,
          payment_method: sale.paymentMethod,
          payment_status: 'completed',
        },
      });
      toast.info('Sale queued — will sync when online');
      return;
    }

    try {
      const { data: saleRow, error: saleError } = await supabase.from('sales').insert({
        tenant_id: currentTenant.id,
        employee_id: sale.employeeId || currentEmployee?.id || null,
        customer_id: sale.customerId || null,
        subtotal: sale.subtotal,
        total_amount: sale.total,
        discount: 0,
        tax_amount: 0,
        payment_method: sale.paymentMethod,
        payment_status: 'completed',
      }).select().single();

      if (saleError) throw saleError;

      if (sale.items.length > 0) {
        const { error: itemsError } = await supabase.from('sale_items').insert(
          sale.items.map(item => ({
            sale_id: saleRow.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
          })),
        );
        if (itemsError) throw itemsError;
      }

      // Decrement stock for each sold item
      for (const item of sale.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const currentStock = product.variants?.[0]?.stock ?? 0;
          await supabase.from('products').update({
            stock_quantity: Math.max(0, currentStock - item.quantity),
          }).eq('id', item.productId);
        }
      }

      const newSale = dbSaleToFrontend(saleRow as DbSale);
      newSale.items = sale.items; // keep full items with names/costs for local state
      setSales(prev => [newSale, ...prev]);

      // Refresh products to get updated stock
      const { data: refreshedProducts } = await supabase.from('products').select('*').eq('is_active', true).order('name');
      if (refreshedProducts) setProducts((refreshedProducts as DbProduct[]).map(dbProductToFrontend));

      // Update customer stats if applicable
      if (sale.customerId) {
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
      logActivity({
        tenantId: currentTenant.id,
        action: 'sale_created',
        entityType: 'sale',
        entityId: newSale.id,
        metadata: { total: sale.total, items: sale.items.length },
      });
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
      const { data, error } = await supabase.from('customers').insert({
        tenant_id: currentTenant.id,
        name: customer.name,
        phone: customer.phone || null,
        email: customer.email || null,
        total_purchases: 0,
        visit_count: 0,
      }).select().single();

      if (error) throw error;

      const newCustomer = dbCustomerToFrontend(data as DbCustomer);
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

      const { data, error } = await supabase.from('customers').update(dbUpdate).eq('id', id).select().single();
      if (error) throw error;

      const updated = dbCustomerToFrontend(data as DbCustomer);
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
      const dbRole = employee.role === 'admin' ? 'owner' : employee.role;

      const { data, error } = await supabase.from('employees').insert({
        tenant_id: currentTenant.id,
        name: employee.name,
        email: employee.email || null,
        role: dbRole,
        commission_rate: employee.commission ?? 0,
        is_active: true,
      }).select().single();

      if (error) throw error;

      const newEmployee = dbEmployeeToFrontend(data as DbEmployee);
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
      if (updatedEmployee.role !== undefined) dbUpdate.role = updatedEmployee.role === 'admin' ? 'owner' : updatedEmployee.role;
      if (updatedEmployee.commission !== undefined) dbUpdate.commission_rate = updatedEmployee.commission;

      const { data, error } = await supabase.from('employees').update(dbUpdate).eq('id', id).select().single();
      if (error) throw error;

      const updated = dbEmployeeToFrontend(data as DbEmployee);
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

    const operationId = await StockUpdateLock.acquireLock(productId, variantId);
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
          const { data, error } = await supabase
            .from('products')
            .update({ stock_quantity: Math.max(0, quantity) })
            .eq('id', productId)
            .select()
            .single();
          if (error) throw error;
          return dbProductToFrontend(data as DbProduct);
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

  const switchTenant = async (_tenantId: string) => {
    setTimeout(() => { loadData(); }, 100);
  };

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
      setUser: () => {},
      setCurrentTenant,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
