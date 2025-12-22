import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../utils/supabaseClient';

interface Product {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  variants: ProductVariant[];
  supplier: string;
  category: string;
  validityDate?: string;
}

interface ProductVariant {
  id: string;
  attributes: Record<string, string>; // color, size, capacity, type, etc.
  cost: number;
  costHistory: CostEntry[];
  price: number;
  stock: number;
  reorderLevel: number;
}

interface CostEntry {
  date: string;
  cost: number;
  quantity: number;
}

interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  employeeId: string;
  customerId?: string;
}

interface SaleItem {
  productId: string;
  variantId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  debtBalance: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  commission: number;
  totalSales: number;
  shifts: Shift[];
}

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  salesCount: number;
  totalRevenue: number;
}

interface AppContextType {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  employees: Employee[];
  currentEmployee: Employee | null;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data from backend
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Initialize demo data if needed
      await api.post('/init-demo', {});
      
      // Load all data
      const [productsRes, salesRes, customersRes, employeesRes] = await Promise.all([
        api.get('/products'),
        api.get('/sales'),
        api.get('/customers'),
        api.get('/employees')
      ]);

      setProducts(productsRes.products || []);
      setSales(salesRes.sales || []);
      setCustomers(customersRes.customers || []);
      setEmployees(employeesRes.employees || []);
      
      if (employeesRes.employees && employeesRes.employees.length > 0) {
        setCurrentEmployee(employeesRes.employees[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (product: Product) => {
    try {
      const { product: newProduct } = await api.post('/products', product);
      setProducts([...products, newProduct]);
    } catch (error) {
      console.error('Failed to add product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updatedProduct: Partial<Product>) => {
    try {
      const { product } = await api.put(`/products/${id}`, updatedProduct);
      setProducts(products.map(p => p.id === id ? product : p));
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  };

  const addSale = async (sale: Sale) => {
    try {
      const { sale: newSale } = await api.post('/sales', sale);
      setSales([...sales, newSale]);
      
      // Reload products to get updated stock
      const { products: updatedProducts } = await api.get('/products');
      setProducts(updatedProducts);
      
      // Reload employees to get updated sales totals
      const { employees: updatedEmployees } = await api.get('/employees');
      setEmployees(updatedEmployees);
      
      // Update current employee if it's them
      if (currentEmployee && newSale.employeeId === currentEmployee.id) {
        const updated = updatedEmployees.find((e: Employee) => e.id === currentEmployee.id);
        if (updated) setCurrentEmployee(updated);
      }
      
      // Reload customers if customer was involved
      if (sale.customerId) {
        const { customers: updatedCustomers } = await api.get('/customers');
        setCustomers(updatedCustomers);
      }
    } catch (error) {
      console.error('Failed to add sale:', error);
      throw error;
    }
  };

  const addCustomer = async (customer: Customer) => {
    try {
      const { customer: newCustomer } = await api.post('/customers', customer);
      setCustomers([...customers, newCustomer]);
    } catch (error) {
      console.error('Failed to add customer:', error);
      throw error;
    }
  };

  const updateCustomer = async (id: string, updatedCustomer: Partial<Customer>) => {
    try {
      const { customer } = await api.put(`/customers/${id}`, updatedCustomer);
      setCustomers(customers.map(c => c.id === id ? customer : c));
    } catch (error) {
      console.error('Failed to update customer:', error);
      throw error;
    }
  };

  const addEmployee = async (employee: Employee) => {
    try {
      // Generate a temporary password for the employee
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      
      const { employee: newEmployee } = await api.post('/employees', {
        ...employee,
        password: tempPassword
      });
      
      setEmployees([...employees, newEmployee]);
      
      // In a real app, you'd send the password to the employee via email
      alert(`Employee created! Temporary password: ${tempPassword}\nPlease share this with the employee securely.`);
    } catch (error) {
      console.error('Failed to add employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (id: string, updatedEmployee: Partial<Employee>) => {
    try {
      const { employee } = await api.put(`/employees/${id}`, updatedEmployee);
      setEmployees(employees.map(e => e.id === id ? employee : e));
    } catch (error) {
      console.error('Failed to update employee:', error);
      throw error;
    }
  };

  const updateStock = async (productId: string, variantId: string, quantity: number) => {
    try {
      const { product } = await api.post(`/products/${productId}/variants/${variantId}/stock`, { quantity });
      setProducts(products.map(p => p.id === productId ? product : p));
    } catch (error) {
      console.error('Failed to update stock:', error);
      throw error;
    }
  };

  if (loading) {
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
      products,
      sales,
      customers,
      employees,
      currentEmployee,
      addProduct,
      updateProduct,
      deleteProduct,
      addSale,
      addCustomer,
      updateCustomer,
      addEmployee,
      updateEmployee,
      updateStock,
      setCurrentEmployee
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