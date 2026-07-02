// Local storage client for development without Supabase
// This mimics Supabase client functionality using browser localStorage

interface LocalUser {
  id: string;
  email: string;
  password: string;
  aud: string;
  role: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

interface LocalSession {
  user: LocalUser;
  access_token: string;
  refresh_token: string;
}

interface TenantUserDetail {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_id: string;
  user_role: string;
  user_active: boolean;
  tenant_active: boolean;
  settings: Record<string, unknown>;
}

interface LocalRecord {
  id: string;
  [key: string]: unknown;
}

interface LocalStorageData {
  users: LocalUser[];
  sessions: LocalSession[];
  products: LocalRecord[];
  sales: LocalRecord[];
  customers: LocalRecord[];
  employees: LocalRecord[];
  tenant_user_details: TenantUserDetail[];
}

interface FilterEntry { column: string; value: unknown }
interface OrderOptions { ascending?: boolean }
interface QueryResult { data: LocalRecord[]; error: null | { message: string } }
interface SingleQueryResult { data: LocalRecord | null; error: null | { message: string } }
interface QueryBuilder {
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (orderColumn: string, options: OrderOptions) => {
    limit: (limit: number) => Promise<QueryResult>;
    single: () => Promise<SingleQueryResult>;
  };
  limit: (limit: number) => Promise<QueryResult>;
  single: () => Promise<SingleQueryResult>;
  filters: FilterEntry[];
  then: (resolve: (result: QueryResult) => void, reject: (reason: unknown) => void) => QueryBuilder;
}

const STORAGE_KEY = 'business_terminal_local_data';

const getStorageData = (): LocalStorageData => {
  if (typeof window === 'undefined') {
    return { users: [], sessions: [], products: [], sales: [], customers: [], employees: [], tenant_user_details: [] };
  }

  const rawData = localStorage.getItem(STORAGE_KEY);
  if (rawData) {
    const parsed = JSON.parse(rawData) as LocalStorageData;
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
let currentUser: LocalSession | null = null;
let authStateChangeCallbacks: Array<(event: string, session: LocalSession | null) => void> = [];

export const localStorageClient = {
  auth: {
    onAuthStateChange: (callback: (event: string, session: LocalSession | null) => void) => {
      authStateChangeCallbacks.push(callback);
      // Immediately call with current state
      callback(currentUser ? 'SIGNED_IN' : 'SIGNED_IN', currentUser);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authStateChangeCallbacks = authStateChangeCallbacks.filter(cb => cb !== callback);
            },
          },
        },
      };
    },

    getSession: () => Promise.resolve({
      data: {
        session: currentUser,
      },
    }),

    signInWithPassword: ({ email, password }: { email: string; password: string }) => {
      const data = getStorageData();
      const user = data.users.find((u) => u.email === email && u.password === password);

      if (user) {
        currentUser = {
          user: { ...user },
          access_token: 'local-token-' + generateId(),
          refresh_token: 'local-refresh-' + generateId(),
        };

        // Ensure user has a tenant in local mode
        const existingTenant = data.tenant_user_details.find((t) => t.user_id === user.id);
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

        return { data: { user }, error: null };
      }

      // Create user if doesn't exist (for development convenience)
      const newUser: LocalUser = {
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

    signUp: ({ email, password }: { email: string; password: string }) => {
      const data = getStorageData();

      if (data.users.find((u) => u.email === email)) {
        return { data: null, error: { message: 'User already exists' } };
      }

      const newUser: LocalUser = {
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

    signOut: () => {
      currentUser = null;
      authStateChangeCallbacks.forEach(cb => cb('SIGNED_OUT', null));
      return { error: null };
    },
    getUser: () => {
      return { data: { user: currentUser?.user ?? null }, error: null };
    },
  },

  from: (table: string) => {
    const data = getStorageData();
    const tableData = (data[table as keyof LocalStorageData] ?? []) as LocalRecord[];

    // Helper to create chainable query builder
    const createQueryBuilder = (filters: FilterEntry[] = []): QueryBuilder => {
      const applyFilters = (rows: LocalRecord[]): LocalRecord[] => {
        if (filters.length === 0) return rows;
        return rows.filter((item) =>
          filters.every(({ column, value }) => item[column] === value),
        );
      };

      const builder: QueryBuilder = {
        eq: (column, value) => createQueryBuilder([...filters, { column, value }]),

        order: (orderColumn, options) => ({
          limit: (limit) => {
            let filtered = applyFilters(tableData);
            if (limit) filtered = filtered.slice(0, limit);
            const sorted = [...filtered];
            if (options.ascending === false) {
              sorted.sort((a, b) => ((a[orderColumn] as string) > (b[orderColumn] as string) ? 1 : -1));
            } else {
              sorted.sort((a, b) => ((a[orderColumn] as string) < (b[orderColumn] as string) ? 1 : -1));
            }
            return Promise.resolve({ data: sorted, error: null });
          },
          single: () => {
            const filtered = applyFilters(tableData);
            const sorted = [...filtered];
            if (options.ascending === false) {
              sorted.sort((a, b) => ((a[orderColumn] as string) > (b[orderColumn] as string) ? 1 : -1));
            } else {
              sorted.sort((a, b) => ((a[orderColumn] as string) < (b[orderColumn] as string) ? 1 : -1));
            }
            const result = sorted[0] ?? null;
            return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } });
          },
        }),

        limit: (limit) => {
          let filtered = applyFilters(tableData);
          if (limit) filtered = filtered.slice(0, limit);
          return Promise.resolve({ data: filtered, error: null });
        },

        single: () => {
          const filtered = applyFilters(tableData);
          const result = filtered[0] ?? null;
          return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } });
        },

        filters,

        then: (resolve, _reject) => {
          const filtered = tableData.filter((item) =>
            filters.every(({ column, value }) => item[column] === value),
          );
          resolve({ data: filtered, error: null });
          return createQueryBuilder(filters);
        },
      };

      return builder;
    };

    return {
      select: (_columns = '*') => createQueryBuilder(),

      insert: (item: Record<string, unknown> | Record<string, unknown>[]) => {
        const newItem = Array.isArray(item)
          ? item.map(i => ({ ...i, id: (i['id'] as string | undefined) ?? generateId() }))
          : { ...item, id: (item['id'] as string | undefined) ?? generateId() };

        const rows = Array.isArray(newItem) ? newItem : [newItem];
        const updatedData = [...tableData, ...rows];
        (data as unknown as Record<string, LocalRecord[]>)[table] = updatedData;
        setStorageData(data);

        return Promise.resolve({ data: rows, error: null });
      },

      update: (updates: Record<string, unknown>) => ({
        eq: (column: string, value: unknown) => {
          const updatedData = tableData.map((item) =>
            item[column] === value ? { ...item, ...updates } : item,
          );
          (data as unknown as Record<string, LocalRecord[]>)[table] = updatedData;
          setStorageData(data);

          const updated = updatedData.filter((item) => item[column] === value);
          return Promise.resolve({ data: updated, error: null });
        },
      }),

      delete: () => ({
        eq: (column: string, value: unknown) => {
          const updatedData = tableData.filter((item) => item[column] !== value);
          (data as unknown as Record<string, LocalRecord[]>)[table] = updatedData;
          setStorageData(data);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  },

  rpc: () => Promise.resolve({ data: [], error: null }),
};

// Local API mock to replace Supabase Edge Function
const _LOCAL_API_BASE = '/api/local';

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

  async post(endpoint: string, item: Record<string, unknown>) {
    await new Promise(resolve => setTimeout(resolve, 100));

    const data = getStorageData();
    const resource = endpoint.split('/')[1];
    const newItem: LocalRecord = { ...item, id: (item['id'] as string | undefined) ?? generateId() };

    if (resource && (resource in data)) {
      (data as unknown as Record<string, LocalRecord[]>)[resource]!.push(newItem);
      setStorageData(data);
      return { [resource.slice(0, -1)]: newItem }; // products -> product
    }

    return { data: newItem };
  },

  async put(endpoint: string, updates: Record<string, unknown>) {
    await new Promise(resolve => setTimeout(resolve, 100));

    const data = getStorageData();
    const parts = endpoint.split('/');
    const resource = parts[1];
    const id = parts[2];

    if (resource && (resource in data)) {
      const tableItems = (data as unknown as Record<string, LocalRecord[]>)[resource]!;
      const updated = tableItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      );
      (data as unknown as Record<string, LocalRecord[]>)[resource] = updated;
      setStorageData(data);

      const updatedItem = updated.find((item) => item.id === id);
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

    if (resource && (resource in data)) {
      const tableItems = (data as unknown as Record<string, LocalRecord[]>)[resource]!;
      const filtered = tableItems.filter((item) => item.id !== id);
      (data as unknown as Record<string, LocalRecord[]>)[resource] = filtered;
      setStorageData(data);
    }

    return { success: true };
  },
};

export const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser?.access_token ?? 'local-token'}`,
  };
};
