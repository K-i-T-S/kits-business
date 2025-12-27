import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { api, supabase } from '../utils/supabaseClient';
import { getCurrentUserTenant } from '../utils/tenantManager';
import { DataValidator } from '../utils/dataValidation';
import { TransactionManager } from '../utils/transactionManager';
import { useOptimisticUpdates, useOptimisticStockUpdates } from '../utils/optimisticUpdates';
import { OperationQueue, StockUpdateLock, ConcurrentOperationGuard } from '../utils/raceConditionPrevention';

export interface Product {
  id: string;
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
  attributes: Record<string, string>; // color, size, capacity, type, etc.
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
  settings: Record<string, any>;
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
    try {
      setLoading(true);
      
      console.log('Loading data for tenant:', currentTenant?.id);
      
      if (!currentTenant) {
        console.log('No tenant set - skipping data load');
        return;
      }
      
      // Initialize demo data if needed
      await api.post('/init-demo', {});
      
      // Load all data using direct Supabase calls (RLS will filter by tenant)
      const [productsRes, salesRes, customersRes, employeesRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('employees').select('*')
      ]);

      console.log('Products loaded:', productsRes.data?.length || 0);
      console.log('Sales loaded:', salesRes.data?.length || 0);
      console.log('Customers loaded:', customersRes.data?.length || 0);
      console.log('Employees loaded:', employeesRes.data?.length || 0);

      // Transform database products to frontend format
      const transformedProducts = (productsRes.data || []).map(dbProduct => ({
        id: dbProduct.id,
        name: dbProduct.name,
        barcode: dbProduct.barcode || '',
        sku: dbProduct.sku || '',
        variants: dbProduct.variants || [{
          id: `${dbProduct.id}-1`,
          attributes: { size: 'Standard' },
          cost: dbProduct.cost || 0,
          costHistory: [],
          price: dbProduct.price || 0,
          stock: dbProduct.stock_quantity || 0,
          reorderLevel: dbProduct.min_stock_level || 0
        }],
        supplier: dbProduct.supplier || '',
        category: dbProduct.category || '',
        validityDate: dbProduct.validity_date || undefined
      }));

      setProducts(transformedProducts);
      setSales(salesRes.data || []);
      setCustomers(customersRes.data || []);
      setEmployees(employeesRes.data || []);
      
      if (employeesRes.data && employeesRes.data.length > 0) {
        setCurrentEmployee(employeesRes.data[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  // Watch Supabase auth and only load data when a session exists
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const sessionResult = await supabase.auth.getSession();
        if (!isMounted) return;
        const session = sessionResult?.data?.session;
        setHasSession(!!session);
        if (session) {
          // Load tenant info first
          try {
            const tenantData = await getCurrentUserTenant();
            if (tenantData && isMounted) {
              setCurrentTenant({
                id: tenantData.tenant_id,
                name: tenantData.tenant_name,
                slug: tenantData.tenant_slug,
                userRole: tenantData.user_role,
                settings: tenantData.settings || {}
              });
            }
          } catch (tenantError) {
            console.error('Failed to load tenant:', tenantError);
          }
          loadData();
        }
      } catch (error) {
        console.error('Failed to get session:', error);
        if (!isMounted) return;
        setHasSession(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (session) {
        // Load tenant info on auth state change
        getCurrentUserTenant().then(tenantData => {
          if (tenantData) {
            setCurrentTenant({
              id: tenantData.tenant_id,
              name: tenantData.tenant_name,
              slug: tenantData.tenant_slug,
              userRole: tenantData.user_role,
              settings: tenantData.settings || {}
            });
          }
        }).catch(error => {
          console.error('Failed to load tenant on auth change:', error);
        });
        loadData();
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

  const addProduct = async (product: Product) => {
    const validation = DataValidator.validateProduct(product);
    if (!validation.isValid) {
      toast.error('Validation failed', {
        description: validation.errors.join(', ')
      });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', {
        description: validation.warnings.join(', ')
      });
    }

    try {
      const { product: newProduct } = await api.post('/products', product);
      setProducts([...products, newProduct]);
      toast.success('Product added', { description: newProduct.name });
      return newProduct;
    } catch (error) {
      console.error('Failed to add product:', error);
      toast.error('Failed to add product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateProduct = async (id: string, updatedProduct: Partial<Product>) => {
    try {
      const { product } = await api.put(`/products/${id}`, updatedProduct);
      setProducts(products.map(p => p.id === id ? product : p));
      toast.success('Product updated', { description: product.name });
      return product;
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error('Failed to update product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      setProducts(products.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const addSale = async (sale: Sale) => {
    const validation = DataValidator.validateSale(sale);
    if (!validation.isValid) {
      toast.error('Validation failed', {
        description: validation.errors.join(', ')
      });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', {
        description: validation.warnings.join(', ')
      });
    }

    try {
      const result = await TransactionManager.executeSaleTransaction(sale, products);
      
      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      const newSale = result.results[0].sale;
      setSales([...sales, newSale]);
      
      const updatedProducts = await api.get('/products');
      setProducts(updatedProducts.products);
      
      const updatedEmployees = await api.get('/employees');
      setEmployees(updatedEmployees.employees);
      
      if (currentEmployee && newSale.employeeId === currentEmployee.id) {
        const updated = updatedEmployees.employees.find((e: Employee) => e.id === currentEmployee.id);
        if (updated) setCurrentEmployee(updated);
      }
      
      if (sale.customerId) {
        const updatedCustomers = await api.get('/customers');
        setCustomers(updatedCustomers.customers);
      }
      
      toast.success('Sale recorded', {
        description: `Total ${newSale.total.toFixed(2)}`,
      });
      return newSale;
    } catch (error) {
      console.error('Failed to add sale:', error);
      toast.error('Failed to record sale', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const addCustomer = async (customer: Customer) => {
    const validation = DataValidator.validateCustomer(customer);
    if (!validation.isValid) {
      toast.error('Validation failed', {
        description: validation.errors.join(', ')
      });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', {
        description: validation.warnings.join(', ')
      });
    }

    try {
      const { customer: newCustomer } = await api.post('/customers', customer);
      setCustomers([...customers, newCustomer]);
      toast.success('Customer added', { description: newCustomer.name });
      return newCustomer;
    } catch (error) {
      console.error('Failed to add customer:', error);
      toast.error('Failed to add customer', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateCustomer = async (id: string, updatedCustomer: Partial<Customer>) => {
    try {
      const { customer } = await api.put(`/customers/${id}`, updatedCustomer);
      setCustomers(customers.map(c => c.id === id ? customer : c));
      toast.success('Customer updated', { description: customer.name });
      return customer;
    } catch (error) {
      console.error('Failed to update customer:', error);
      toast.error('Failed to update customer', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const addEmployee = async (employee: Employee) => {
    const validation = DataValidator.validateEmployee(employee);
    if (!validation.isValid) {
      toast.error('Validation failed', {
        description: validation.errors.join(', ')
      });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      toast.warning('Validation warnings', {
        description: validation.warnings.join(', ')
      });
    }

    try {
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      
      const { employee: newEmployee } = await api.post('/employees', {
        ...employee,
        password: tempPassword
      });
      
      setEmployees([...employees, newEmployee]);
      toast.success('Employee created', {
        description: `Temp password: ${tempPassword}`,
      });
      return newEmployee;
      
    } catch (error) {
      console.error('Failed to add employee:', error);
      toast.error('Failed to add employee', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateEmployee = async (id: string, updatedEmployee: Partial<Employee>) => {
    try {
      const { employee } = await api.put(`/employees/${id}`, updatedEmployee);
      setEmployees(employees.map(e => e.id === id ? employee : e));
      toast.success('Employee updated', { description: employee.name });
      return employee;
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast.error('Failed to update employee', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    }
  };

  const updateStock = async (productId: string, variantId: string, quantity: number) => {
    const validation = DataValidator.validateStockUpdate(productId, variantId, quantity);
    if (!validation.isValid) {
      toast.error('Validation failed', {
        description: validation.errors.join(', ')
      });
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const operationId = await StockUpdateLock.acquireLock(productId, variantId);
    if (!operationId) {
      toast.error('Stock update in progress', {
        description: 'Another operation is updating this stock. Please try again.'
      });
      throw new Error('Stock update locked');
    }

    try {
      const result = await OperationQueue.enqueue(
        `stock-${productId}-${variantId}`,
        async () => {
          const { product } = await api.post(`/products/${productId}/variants/${variantId}/stock`, { quantity });
          return product;
        },
        'stock-update'
      );
      
      setProducts(products.map(p => p.id === productId ? result : p));
      toast.success('Stock updated');
      return result;
    } catch (error) {
      console.error('Failed to update stock:', error);
      toast.error('Failed to update stock', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
      throw error;
    } finally {
      StockUpdateLock.releaseLock(productId, variantId, operationId);
    }
  };

  const switchTenant = async (tenantId: string) => {
    // For now, we'll reload data which will get the new tenant info
    // In the future, this could involve switching context without full reload
    await loadData();
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
      setCurrentTenant
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