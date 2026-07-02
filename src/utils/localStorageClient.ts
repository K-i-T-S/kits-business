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

// BUG 3 FIX: Add explicit table fields + index signature so dynamic table access works
interface LocalStorageData {
  users: LocalUser[];
  sessions: LocalSession[];
  products: LocalRecord[];
  sales: LocalRecord[];
  customers: LocalRecord[];
  employees: LocalRecord[];
  tenant_user_details: TenantUserDetail[];
  expenses: LocalRecord[];
  expense_categories: LocalRecord[];
  expense_budgets: LocalRecord[];
  payroll_entries: LocalRecord[];
  restaurant_tables: LocalRecord[];
  table_orders: LocalRecord[];
  customer_points: LocalRecord[];
  activity_log: LocalRecord[];
  [key: string]: unknown;
}

// BUG 2 FIX: FilterEntry now carries optional op for comparison operators
interface FilterEntry { column: string; value: unknown; op?: string }
interface OrderOptions { ascending?: boolean }
interface QueryResult { data: LocalRecord[]; error: null | { message: string } }
interface SingleQueryResult { data: LocalRecord | null; error: null | { message: string } }

// BUG 1 FIX: OrderedResult is now thenable so `await query.order('col')` resolves correctly
interface OrderedResult {
  limit: (limit: number) => Promise<QueryResult>;
  single: () => Promise<SingleQueryResult>;
  then: (
    resolve: (r: QueryResult) => void,
    _reject: (reason: unknown) => void,
  ) => OrderedResult;
}

// Chainable update object with .then() so `await update().eq()` works
interface UpdateChain {
  eq: (column: string, value: unknown) => UpdateChain;
  then: (
    resolve: (r: QueryResult) => void,
    _reject: (reason: unknown) => void,
  ) => UpdateChain;
}

interface QueryBuilder {
  eq: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: unknown) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  gt: (column: string, value: unknown) => QueryBuilder;
  lt: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  is: (column: string, value: null | boolean) => QueryBuilder;
  order: (orderColumn: string, options?: OrderOptions) => OrderedResult;
  limit: (limit: number) => Promise<QueryResult>;
  single: () => Promise<SingleQueryResult>;
  maybeSingle: () => Promise<SingleQueryResult>;
  filters: FilterEntry[];
  then: (resolve: (result: QueryResult) => void, reject: (reason: unknown) => void) => QueryBuilder;
}

const STORAGE_KEY = 'business_terminal_local_data';

const getStorageData = (): LocalStorageData => {
  if (typeof window === 'undefined') {
    return {
      users: [], sessions: [], products: [], sales: [], customers: [],
      employees: [], tenant_user_details: [], expenses: [], expense_categories: [],
      expense_budgets: [], payroll_entries: [], restaurant_tables: [], table_orders: [],
      customer_points: [], activity_log: [],
    };
  }

  const rawData = localStorage.getItem(STORAGE_KEY);
  if (rawData) {
    const parsed = JSON.parse(rawData) as LocalStorageData;
    // Ensure all expected tables exist for backwards compatibility
    if (!parsed.tenant_user_details) parsed.tenant_user_details = [];
    if (!parsed.expenses) parsed.expenses = [];
    if (!parsed.expense_categories) parsed.expense_categories = [];
    if (!parsed.expense_budgets) parsed.expense_budgets = [];
    if (!parsed.payroll_entries) parsed.payroll_entries = [];
    if (!parsed.restaurant_tables) parsed.restaurant_tables = [];
    if (!parsed.table_orders) parsed.table_orders = [];
    if (!parsed.customer_points) parsed.customer_points = [];
    if (!parsed.activity_log) parsed.activity_log = [];
    return parsed;
  }

  // BUG 3 FIX: initialData now includes all known tables
  const initialData: LocalStorageData = {
    users: [],
    sessions: [],
    products: [],
    sales: [],
    customers: [],
    employees: [],
    tenant_user_details: [],
    expenses: [],
    expense_categories: [],
    expense_budgets: [],
    payroll_entries: [],
    restaurant_tables: [],
    table_orders: [],
    customer_points: [],
    activity_log: [],
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
    const tableData = (data[table] ?? []) as LocalRecord[];

    // Helper to create chainable query builder
    const createQueryBuilder = (filters: FilterEntry[] = []): QueryBuilder => {
      // BUG 2 FIX: applyFilters now handles comparison operators
      const applyFilters = (rows: LocalRecord[]): LocalRecord[] => {
        if (filters.length === 0) return rows;
        return rows.filter((item) =>
          filters.every(({ column, value, op }) => {
            const v = item[column];
            switch (op) {
              case 'gte': return (v as number) >= (value as number);
              case 'lte': return (v as number) <= (value as number);
              case 'gt': return (v as number) > (value as number);
              case 'lt': return (v as number) < (value as number);
              case 'neq': return v !== value;
              case 'in': return (value as unknown[]).includes(v);
              case 'is': return value === null ? v === null || v === undefined : v === value;
              default: return v === value;
            }
          }),
        );
      };

      // BUG 1 FIX: sort helper with corrected direction (ascending = A→Z)
      const sortRows = (rows: LocalRecord[], orderColumn: string, options?: OrderOptions): LocalRecord[] => {
        const sorted = [...rows];
        sorted.sort((a, b) => {
          const av = String(a[orderColumn] ?? '' as unknown);
          const bv = String(b[orderColumn] ?? '' as unknown);
          return options?.ascending === false ? bv.localeCompare(av) : av.localeCompare(bv);
        });
        return sorted;
      };

      const builder: QueryBuilder = {
        eq: (column, value) => createQueryBuilder([...filters, { column, value }]),
        gte: (column, value) => createQueryBuilder([...filters, { column, value, op: 'gte' }]),
        lte: (column, value) => createQueryBuilder([...filters, { column, value, op: 'lte' }]),
        gt: (column, value) => createQueryBuilder([...filters, { column, value, op: 'gt' }]),
        lt: (column, value) => createQueryBuilder([...filters, { column, value, op: 'lt' }]),
        neq: (column, value) => createQueryBuilder([...filters, { column, value, op: 'neq' }]),
        in: (column, values) => createQueryBuilder([...filters, { column, value: values, op: 'in' }]),
        is: (column, value) => createQueryBuilder([...filters, { column, value, op: 'is' }]),

        // BUG 1 FIX: order() now returns a thenable OrderedResult
        order: (orderColumn, options): OrderedResult => {
          const orderedResult: OrderedResult = {
            limit: (limit) => {
              let rows = sortRows(applyFilters(tableData), orderColumn, options);
              if (limit) rows = rows.slice(0, limit);
              return Promise.resolve({ data: rows, error: null });
            },
            single: () => {
              const rows = sortRows(applyFilters(tableData), orderColumn, options);
              const result = rows[0] ?? null;
              return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } });
            },
            // .then() makes the OrderedResult directly awaitable
            then: (resolve, _reject) => {
              const rows = sortRows(applyFilters(tableData), orderColumn, options);
              resolve({ data: rows, error: null });
              return orderedResult;
            },
          };
          return orderedResult;
        },

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

        // BUG 2 FIX: maybeSingle returns null (not error) when no row found
        maybeSingle: (): Promise<SingleQueryResult> => {
          const row = applyFilters(tableData)[0] ?? null;
          return Promise.resolve({ data: row, error: null });
        },

        filters,

        // BUG 1 FIX: then() now delegates to applyFilters so operators work
        then: (resolve, _reject) => {
          resolve({ data: applyFilters(tableData), error: null });
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

      // BUG 2 FIX: upsert added as a top-level method on from()
      upsert: (
        items: Record<string, unknown> | Record<string, unknown>[],
        _opts?: Record<string, unknown>,
      ) => {
        const rows = Array.isArray(items) ? items : [items];
        const tableRows = [...tableData];
        for (const row of rows) {
          const id = row['id'] as string | undefined;
          const idx = tableRows.findIndex(t => t['id'] === id);
          const newRow: LocalRecord = { ...row, id: id ?? generateId() };
          if (idx >= 0) tableRows[idx] = { ...tableRows[idx], ...newRow };
          else tableRows.push(newRow);
        }
        (data as unknown as Record<string, LocalRecord[]>)[table] = tableRows;
        setStorageData(data);
        return Promise.resolve({ data: tableRows, error: null });
      },

      // BUG 2 FIX: update() now returns a chainable UpdateChain with .then()
      // so `await supabase.from(t).update(x).eq(col, val)` resolves correctly
      // and multiple .eq() calls are supported
      update: (updates: Record<string, unknown>): UpdateChain => {
        const updateFilters: FilterEntry[] = [];

        const applyAndResolve = (): Promise<QueryResult> => {
          const updated = tableData.map(item =>
            updateFilters.every(f => item[f.column] === f.value)
              ? { ...item, ...updates }
              : item,
          );
          (data as unknown as Record<string, LocalRecord[]>)[table] = updated;
          setStorageData(data);
          const affected = updated.filter(item =>
            updateFilters.every(f => item[f.column] === f.value),
          );
          return Promise.resolve({ data: affected, error: null });
        };

        const chain: UpdateChain = {
          eq: (column, value) => {
            updateFilters.push({ column, value });
            return chain;
          },
          then: (resolve, _reject) => {
            void applyAndResolve().then(resolve);
            return chain;
          },
        };
        return chain;
      },

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
