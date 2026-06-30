import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { Product, Sale, Customer, Employee } from '../context/AppContext';
import { api, supabase } from '../utils/supabaseClient';

// API response shape from the Edge Function / localApi
interface ApiResp<T> {
  data: T;
  error: string | null;
}

// Query keys for cache management
export const queryKeys = {
  products: ['products'] as const,
  sales: ['sales'] as const,
  customers: ['customers'] as const,
  employees: ['employees'] as const,
  product: (id: string) => ['products', id] as const,
  customer: (id: string) => ['customers', id] as const,
  employee: (id: string) => ['employees', id] as const,
};

// Generic fetcher for Supabase queries
const supabaseFetcher = async <T>(table: string, select = '*'): Promise<T[]> => {
  const { data, error } = await supabase.from(table).select(select);
  if (error) throw error;
  return (data || []) as T[];
};

// Products hooks
export function useProducts(options?: Partial<UseQueryOptions<Product[]>>) {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => supabaseFetcher<Product>('products'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useProduct(id: string, options?: Partial<UseQueryOptions<Product>>) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Product;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for single product
    ...options,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id'>): Promise<Product> => {
      const result = await api.post('/products', product) as ApiResp<{ product: Product }>;
      if (result.error) throw new Error(result.error);
      return result.data.product;
    },
    onSuccess: (newProduct) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success('Product added', { description: newProduct.name });
    },
    onError: (error: Error) => {
      toast.error('Failed to add product', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, product }: { id: string; product: Partial<Product> }): Promise<Product> => {
      const result = await api.put(`/products/${id}`, product) as ApiResp<{ product: Product }>;
      if (result.error) throw new Error(result.error);
      return result.data.product;
    },
    onSuccess: (updatedProduct) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      if (updatedProduct.id) void queryClient.invalidateQueries({ queryKey: queryKeys.product(updatedProduct.id) });
      toast.success('Product updated', { description: updatedProduct.name });
    },
    onError: (error: Error) => {
      toast.error('Failed to update product', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const result = await api.delete(`/products/${id}`) as ApiResp<null>;
      if (result.error) throw new Error(result.error);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success('Product deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete product', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

// Sales hooks
export function useSales(options?: Partial<UseQueryOptions<Sale[]>>) {
  return useQuery({
    queryKey: queryKeys.sales,
    queryFn: () => supabaseFetcher<Sale>('sales'),
    staleTime: 2 * 60 * 1000, // 2 minutes for sales (more frequent updates)
    ...options,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sale: Omit<Sale, 'id'>): Promise<Sale> => {
      const result = await api.post('/sales', sale) as ApiResp<{ sale: Sale }>;
      if (result.error) throw new Error(result.error);
      return result.data.sale;
    },
    onSuccess: (newSale) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success('Sale recorded', {
        description: `Total $${newSale.total.toFixed(2)}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to record sale', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

// Customers hooks
export function useCustomers(options?: Partial<UseQueryOptions<Customer[]>>) {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: () => supabaseFetcher<Customer>('customers'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useCustomer(id: string, options?: Partial<UseQueryOptions<Customer>>) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for single customer
    ...options,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
      const result = await api.post('/customers', customer) as ApiResp<{ customer: Customer }>;
      if (result.error) throw new Error(result.error);
      return result.data.customer;
    },
    onSuccess: (newCustomer) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      toast.success('Customer added', { description: newCustomer.name });
    },
    onError: (error: Error) => {
      toast.error('Failed to add customer', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, customer }: { id: string; customer: Partial<Customer> }): Promise<Customer> => {
      const result = await api.put(`/customers/${id}`, customer) as ApiResp<{ customer: Customer }>;
      if (result.error) throw new Error(result.error);
      return result.data.customer;
    },
    onSuccess: (updatedCustomer) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer(updatedCustomer.id) });
      toast.success('Customer updated', { description: updatedCustomer.name });
    },
    onError: (error: Error) => {
      toast.error('Failed to update customer', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

// Employees hooks
export function useEmployees(options?: Partial<UseQueryOptions<Employee[]>>) {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: () => supabaseFetcher<Employee>('employees'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useEmployee(id: string, options?: Partial<UseQueryOptions<Employee>>) {
  return useQuery({
    queryKey: queryKeys.employee(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Employee;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for single employee
    ...options,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employee: Omit<Employee, 'id'>): Promise<Employee & { tempPassword: string }> => {
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
      const result = await api.post('/employees', { ...employee, password: tempPassword }) as ApiResp<{ employee: Employee }>;
      if (result.error) throw new Error(result.error);
      return { ...result.data.employee, tempPassword };
    },
    onSuccess: (newEmployee) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      toast.success('Employee created', {
        description: `Temp password: ${newEmployee.tempPassword}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to add employee', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employee }: { id: string; employee: Partial<Employee> }): Promise<Employee> => {
      const result = await api.put(`/employees/${id}`, employee) as ApiResp<{ employee: Employee }>;
      if (result.error) throw new Error(result.error);
      return result.data.employee;
    },
    onSuccess: (updatedEmployee) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      void queryClient.invalidateQueries({ queryKey: queryKeys.employee(updatedEmployee.id) });
      toast.success('Employee updated', { description: updatedEmployee.name });
    },
    onError: (error: Error) => {
      toast.error('Failed to update employee', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}

// Stock update hook
export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, variantId, quantity }: {
      productId: string
      variantId: string
      quantity: number
    }): Promise<Product> => {
      const result = await api.post(`/products/${productId}/variants/${variantId}/stock`, { quantity }) as ApiResp<{ product: Product }>;
      if (result.error) throw new Error(result.error);
      return result.data.product;
    },
    onSuccess: (updatedProduct) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      if (updatedProduct.id) void queryClient.invalidateQueries({ queryKey: queryKeys.product(updatedProduct.id) });
      toast.success('Stock updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update stock', {
        description: error.message || 'Unknown error occurred.',
      });
    },
  });
}
