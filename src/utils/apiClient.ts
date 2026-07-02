// API client for backend database
// This mimics Supabase client functionality using the backend API

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

const generateId = () => Math.random().toString(36).substring(2, 15);

interface ApiUser {
  id: string;
  [key: string]: unknown;
}

interface ApiSession {
  user: ApiUser;
  access_token: string;
  refresh_token: string;
}

interface ApiResponse {
  data?: unknown;
  [key: string]: unknown;
}

type ApiRecord = Record<string, unknown>;

interface FilterEntry { column: string; value: unknown }
interface OrderOptions { ascending?: boolean }
interface QueryResult { data: ApiRecord[]; error: null | { message: string } }
interface SingleQueryResult { data: ApiRecord | null; error: null | { message: string } }
interface QueryBuilder {
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (orderColumn: string, options: OrderOptions) => {
    limit: (limit: number) => Promise<QueryResult>;
    single: () => Promise<SingleQueryResult>;
  };
  limit: (limit: number) => Promise<QueryResult>;
  single: () => Promise<SingleQueryResult>;
  then: (resolve: (result: QueryResult) => void, reject: (reason: unknown) => void) => QueryBuilder;
}

// Mock auth functionality
let currentUser: ApiSession | null = null;
let authStateChangeCallbacks: Array<(event: string, session: ApiSession | null) => void> = [];

const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<ApiResponse> => {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' })) as { message?: string };
    throw new Error(error.message ?? 'Request failed');
  }

  return response.json() as Promise<ApiResponse>;
};

export const apiClient = {
  auth: {
    onAuthStateChange: (callback: (event: string, session: ApiSession | null) => void) => {
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

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await apiRequest('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        currentUser = {
          user: response['data'] as ApiUser,
          access_token: 'api-token-' + generateId(),
          refresh_token: 'api-refresh-' + generateId(),
        };

        // Notify callbacks
        authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));

        return { data: { user: response['data'] as ApiUser }, error: null };
      } catch (error: unknown) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed' } };
      }
    },

    signUp: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await apiRequest('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        currentUser = {
          user: response['data'] as ApiUser,
          access_token: 'api-token-' + generateId(),
          refresh_token: 'api-refresh-' + generateId(),
        };

        authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));

        return { data: { user: response['data'] as ApiUser }, error: null };
      } catch (error: unknown) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed' } };
      }
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
    // Helper to create chainable query builder
    const createQueryBuilder = (filters: FilterEntry[] = []): QueryBuilder => {
      const applyFilters = (rows: ApiRecord[]): ApiRecord[] => {
        if (filters.length === 0) return rows;
        return rows.filter((item) =>
          filters.every(({ column, value }) => item[column] === value),
        );
      };

      const builder: QueryBuilder = {
        eq: (column, value) => createQueryBuilder([...filters, { column, value }]),

        order: (orderColumn, options) => ({
          limit: (limit) =>
            apiRequest(`/api/${table}?limit=${limit}&order=${orderColumn}`)
              .then(response => {
                let filtered = applyFilters(response['data'] as ApiRecord[]);
                if (limit) filtered = filtered.slice(0, limit);
                const sorted = [...filtered];
                if (options.ascending === false) {
                  sorted.sort((a, b) => ((a[orderColumn] as string) > (b[orderColumn] as string) ? 1 : -1));
                } else {
                  sorted.sort((a, b) => ((a[orderColumn] as string) < (b[orderColumn] as string) ? 1 : -1));
                }
                return { data: sorted, error: null } satisfies QueryResult;
              })
              .catch((err: unknown) => ({ data: [], error: { message: err instanceof Error ? err.message : 'Request failed' } })),

          single: () =>
            apiRequest(`/api/${table}?order=${orderColumn}`)
              .then(response => {
                const filtered = applyFilters(response['data'] as ApiRecord[]);
                const sorted = [...filtered];
                if (options.ascending === false) {
                  sorted.sort((a, b) => ((a[orderColumn] as string) > (b[orderColumn] as string) ? 1 : -1));
                } else {
                  sorted.sort((a, b) => ((a[orderColumn] as string) < (b[orderColumn] as string) ? 1 : -1));
                }
                const result = sorted[0] ?? null;
                return { data: result, error: result ? null : { message: 'Not found' } } satisfies SingleQueryResult;
              })
              .catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : 'Request failed' } })),
        }),

        limit: (limit) =>
          apiRequest(`/api/${table}?limit=${limit}`)
            .then(response => {
              let filtered = applyFilters(response['data'] as ApiRecord[]);
              if (limit) filtered = filtered.slice(0, limit);
              return { data: filtered, error: null } satisfies QueryResult;
            })
            .catch((err: unknown) => ({ data: [], error: { message: err instanceof Error ? err.message : 'Request failed' } })),

        single: () =>
          apiRequest(`/api/${table}`)
            .then(response => {
              const filtered = applyFilters(response['data'] as ApiRecord[]);
              const result = filtered[0] ?? null;
              return { data: result, error: result ? null : { message: 'Not found' } } satisfies SingleQueryResult;
            })
            .catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : 'Request failed' } })),

        then: (resolve, reject) => {
          void apiRequest(`/api/${table}`)
            .then(response => {
              const filtered = applyFilters(response['data'] as ApiRecord[]);
              resolve({ data: filtered, error: null });
            })
            .catch((err: unknown) => {
              reject({ data: [], error: { message: err instanceof Error ? err.message : 'Request failed' } });
            });
          return createQueryBuilder(filters);
        },
      };

      return builder;
    };

    return {
      select: (_columns = '*') => createQueryBuilder(),

      insert: (item: ApiRecord | ApiRecord[]) =>
        apiRequest(`/api/${table}`, {
          method: 'POST',
          body: JSON.stringify(item),
        })
          .then(response => ({ data: [response['data'] as ApiRecord], error: null }))
          .catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : 'Request failed' } })),

      update: (updates: ApiRecord) => ({
        eq: (column: string, value: unknown) =>
          apiRequest(`/api/${table}`)
            .then(response => {
              const item = (response['data'] as ApiRecord[]).find((i) => i[column] === value);
              if (!item) {
                return Promise.resolve({ data: [] as ApiRecord[], error: { message: 'Not found' } });
              }
              return apiRequest(`/api/${table}/${item['id'] as string}`, {
                method: 'PUT',
                body: JSON.stringify(updates),
              });
            })
            .then(response => ({ data: [response['data'] as ApiRecord], error: null }))
            .catch((err: unknown) => ({ data: [] as ApiRecord[], error: { message: err instanceof Error ? err.message : 'Request failed' } })),
      }),

      delete: () => ({
        eq: (column: string, value: unknown) =>
          apiRequest(`/api/${table}`)
            .then(response => {
              const item = (response['data'] as ApiRecord[]).find((i) => i[column] === value);
              if (!item) {
                return Promise.resolve({ data: null, error: { message: 'Not found' } });
              }
              return apiRequest(`/api/${table}/${item['id'] as string}`, {
                method: 'DELETE',
              });
            })
            .then(() => ({ data: null, error: null }))
            .catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : 'Request failed' } })),
      }),
    };
  },

  rpc: () => Promise.resolve({ data: [], error: null }),
};

export const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser?.access_token ?? 'api-token'}`,
  };
};
