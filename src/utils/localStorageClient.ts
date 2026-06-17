// Local storage client for development without Supabase
// This mimics Supabase client functionality using browser localStorage

interface LocalStorageData {
  users: any[];
  sessions: any[];
  products: any[];
  sales: any[];
  customers: any[];
  employees: any[];
  tenant_user_details: any[];
}

const STORAGE_KEY = 'business_terminal_local_data';

const getStorageData = (): LocalStorageData => {
  if (typeof window === 'undefined') {
    return { users: [], sessions: [], products: [], sales: [], customers: [], employees: [], tenant_user_details: [] };
  }
  
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    // Ensure tenant_user_details exists for backwards compatibility
    if (!parsed.tenant_user_details) {
      parsed.tenant_user_details = [];
    }
    return parsed;
  }
  
  const initialData: LocalStorageData = {
    users: [],
    sessions: [],
    products: [],
    sales: [],
    customers: [],
    employees: [],
    tenant_user_details: [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};

const setStorageData = (data: LocalStorageData) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// Mock auth functionality
let currentUser: any = null;
let authStateChangeCallbacks: Array<(event: string, session: any) => void> = [];

export const localStorageClient = {
  auth: {
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      authStateChangeCallbacks.push(callback);
      // Immediately call with current state
      callback(currentUser ? 'SIGNED_IN' : 'SIGNED_IN', currentUser);
      
      return {
        data: { 
          subscription: { 
            unsubscribe: () => {
              authStateChangeCallbacks = authStateChangeCallbacks.filter(cb => cb !== callback);
            }
          } 
        },
      };
    },
    
    getSession: () => Promise.resolve({
      data: {
        session: currentUser,
      },
    }),
    
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const data = getStorageData();
      const user = data.users.find((u: any) => u.email === email && u.password === password);
      
      if (user) {
        currentUser = {
          user: { ...user },
          access_token: 'local-token-' + generateId(),
          refresh_token: 'local-refresh-' + generateId(),
        };
        
        // Ensure user has a tenant in local mode
        const existingTenant = data.tenant_user_details.find((t: any) => t.user_id === user.id);
        if (!existingTenant) {
          const tenantId = generateId();
          data.tenant_user_details.push({
            tenant_id: tenantId,
            tenant_name: 'Local Business',
            tenant_slug: 'local',
            user_id: user.id,
            user_role: 'owner',
            user_active: true,
            tenant_active: true,
            settings: {},
          });
          setStorageData(data);
        }
        
        // Notify callbacks
        authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));
        
        return { data: { user: user }, error: null };
      }
      
      // Create user if doesn't exist (for development convenience)
      const newUser = {
        id: generateId(),
        email,
        password, // In production, never store plain text passwords
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: { name: email.split('@')[0] },
      };
      
      data.users.push(newUser);
      
      // Create default tenant for new user
      const tenantId = generateId();
      data.tenant_user_details.push({
        tenant_id: tenantId,
        tenant_name: 'Local Business',
        tenant_slug: 'local',
        user_id: newUser.id,
        user_role: 'owner',
        user_active: true,
        tenant_active: true,
        settings: {},
      });
      
      setStorageData(data);
      
      currentUser = {
        user: newUser,
        access_token: 'local-token-' + generateId(),
        refresh_token: 'local-refresh-' + generateId(),
      };
      
      authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));
      
      return { data: { user: newUser }, error: null };
    },
    
    signUp: async ({ email, password }: { email: string; password: string }) => {
      const data = getStorageData();
      
      if (data.users.find((u: any) => u.email === email)) {
        return { data: null, error: { message: 'User already exists' } };
      }
      
      const newUser = {
        id: generateId(),
        email,
        password,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: { name: email.split('@')[0] },
      };
      
      data.users.push(newUser);
      
      // Create default tenant for new user
      const tenantId = generateId();
      data.tenant_user_details.push({
        tenant_id: tenantId,
        tenant_name: 'Local Business',
        tenant_slug: 'local',
        user_id: newUser.id,
        user_role: 'owner',
        user_active: true,
        tenant_active: true,
        settings: {},
      });
      
      setStorageData(data);
      
      currentUser = {
        user: newUser,
        access_token: 'local-token-' + generateId(),
        refresh_token: 'local-refresh-' + generateId(),
      };
      
      authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));
      
      return { data: { user: newUser }, error: null };
    },
    
    signOut: async () => {
      currentUser = null;
      authStateChangeCallbacks.forEach(cb => cb('SIGNED_OUT', null));
      return { error: null };
    },
    getUser: async () => {
      return { data: { user: currentUser?.user || null }, error: null };
    },
  },
  
  from: (table: string) => {
    const data = getStorageData();
    const tableData = data[table as keyof LocalStorageData] || [];
    
    // Helper to create chainable query builder
    const createQueryBuilder = (filters: Array<{column: string, value: any}> = []) => {
      const applyFilters = (data: any[]) => {
        if (filters.length === 0) return data;
        const filtered = data.filter((item: any) => {
          return filters.every(({ column, value }) => item[column] === value);
        });
        return filtered;
      };
      
      const builder: any = {
        eq: (column: string, value: any) => {
          return createQueryBuilder([...filters, { column, value }]);
        },
        order: (orderColumn: string, options: any) => {
          return {
            limit: (limit: number) => {
              let filtered = applyFilters(tableData);
              if (limit) filtered = filtered.slice(0, limit);
              
              let sorted = [...filtered];
              if (options.ascending === false) {
                sorted.sort((a, b) => a[orderColumn] > b[orderColumn] ? 1 : -1);
              } else {
                sorted.sort((a, b) => a[orderColumn] < b[orderColumn] ? 1 : -1);
              }
              
              return Promise.resolve({ data: sorted, error: null });
            },
            single: () => {
              let filtered = applyFilters(tableData);
              
              let sorted = [...filtered];
              if (options.ascending === false) {
                sorted.sort((a, b) => a[orderColumn] > b[orderColumn] ? 1 : -1);
              } else {
                sorted.sort((a, b) => a[orderColumn] < b[orderColumn] ? 1 : -1);
              }
              
              const result = sorted[0] || null;
              return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } });
            },
          };
        },
        limit: (limit: number) => {
          let filtered = applyFilters(tableData);
          if (limit) filtered = filtered.slice(0, limit);
          return Promise.resolve({ data: filtered, error: null });
        },
        single: () => {
          let filtered = applyFilters(tableData);
          const result = filtered[0] || null;
          return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } });
        },
      };
      
      // Store filters on the builder for execution
      builder.filters = filters;
      
      // Make the builder thenable so it executes when awaited
      builder.then = (resolve: any, reject: any) => {
        const filtered = tableData.filter((item: any) => {
          return filters.every(({ column, value }: any) => item[column] === value);
        });
        resolve({ data: filtered, error: null });
        return builder;
      };
      
      return builder;
    };
    
    return {
      select: (columns = '*') => {
        return createQueryBuilder();
      },
      
      insert: (item: any) => {
        const newItem = Array.isArray(item) 
          ? item.map(i => ({ ...i, id: i.id || generateId() }))
          : { ...item, id: item.id || generateId() };
        
        const updatedData = [...tableData, ...(Array.isArray(newItem) ? newItem : [newItem])];
        data[table as keyof LocalStorageData] = updatedData;
        setStorageData(data);
        
        return Promise.resolve({ data: Array.isArray(newItem) ? newItem : [newItem], error: null });
      },
      
      update: (updates: any) => {
        return {
          eq: (column: string, value: any) => {
            const updatedData = tableData.map((item: any) => 
              item[column] === value ? { ...item, ...updates } : item
            );
            data[table as keyof LocalStorageData] = updatedData;
            setStorageData(data);
            
            const updated = updatedData.filter((item: any) => item[column] === value);
            return Promise.resolve({ data: updated, error: null });
          },
        };
      },
      
      delete: () => {
        return {
          eq: (column: string, value: any) => {
            const updatedData = tableData.filter((item: any) => item[column] !== value);
            data[table as keyof LocalStorageData] = updatedData;
            setStorageData(data);
            
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  },
  
  rpc: () => Promise.resolve({ data: [], error: null }),
};

// Local API mock to replace Supabase Edge Function
const LOCAL_API_BASE = '/api/local';

export const localApi = {
  async get(endpoint: string) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    const resource = endpoint.split('/')[1]; // products, sales, etc.
    
    if (resource === 'products') return { products: data.products };
    if (resource === 'sales') return { sales: data.sales };
    if (resource === 'customers') return { customers: data.customers };
    if (resource === 'employees') return { employees: data.employees };
    
    return { data: [] };
  },

  async post(endpoint: string, item: any) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    const resource = endpoint.split('/')[1];
    const newItem = { ...item, id: generateId() };
    
    if (resource && data[resource as keyof LocalStorageData]) {
      data[resource as keyof LocalStorageData].push(newItem);
      setStorageData(data);
      return { [resource.slice(0, -1)]: newItem }; // products -> product
    }
    
    return { data: newItem };
  },

  async put(endpoint: string, updates: any) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    const parts = endpoint.split('/');
    const resource = parts[1];
    const id = parts[2];
    
    if (resource && data[resource as keyof LocalStorageData]) {
      const updated = data[resource as keyof LocalStorageData].map((item: any) =>
        item.id === id ? { ...item, ...updates } : item
      );
      data[resource as keyof LocalStorageData] = updated;
      setStorageData(data);
      
      const updatedItem = updated.find((item: any) => item.id === id);
      return { [resource.slice(0, -1)]: updatedItem };
    }
    
    return { data: updates };
  },

  async delete(endpoint: string) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    const parts = endpoint.split('/');
    const resource = parts[1];
    const id = parts[2];
    
    if (resource && data[resource as keyof LocalStorageData]) {
      const filtered = data[resource as keyof LocalStorageData].filter((item: any) => item.id !== id);
      data[resource as keyof LocalStorageData] = filtered;
      setStorageData(data);
    }
    
    return { success: true };
  },
};

export const getAuthHeaders = async () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser?.access_token || 'local-token'}`,
  };
};
