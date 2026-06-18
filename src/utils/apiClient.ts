// API client for backend database
// This mimics Supabase client functionality using the backend API

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const generateId = () => Math.random().toString(36).substring(2, 15);

// Mock auth functionality
let currentUser: any = null;
let authStateChangeCallbacks: Array<(event: string, session: any) => void> = [];

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

export const apiClient = {
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
          user: response.data,
          access_token: 'api-token-' + generateId(),
          refresh_token: 'api-refresh-' + generateId(),
        };

        // Notify callbacks
        authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));

        return { data: { user: response.data }, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },

    signUp: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await apiRequest('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        currentUser = {
          user: response.data,
          access_token: 'api-token-' + generateId(),
          refresh_token: 'api-refresh-' + generateId(),
        };

        authStateChangeCallbacks.forEach(cb => cb('SIGNED_IN', currentUser));

        return { data: { user: response.data }, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
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
    // Helper to create chainable query builder
    const createQueryBuilder = (filters: Array<{column: string, value: any}> = []) => {
      const applyFilters = (data: any[]) => {
        if (filters.length === 0) return data;
        return data.filter((item: any) => {
          return filters.every(({ column, value }) => item[column] === value);
        });
      };

      const builder: any = {
        eq: (column: string, value: any) => {
          return createQueryBuilder([...filters, { column, value }]);
        },
        order: (orderColumn: string, options: any) => {
          return {
            limit: (limit: number) => {
              return apiRequest(`/api/${table}?limit=${limit}&order=${orderColumn}`)
                .then(response => {
                  let filtered = applyFilters(response.data);
                  if (limit) filtered = filtered.slice(0, limit);

                  const sorted = [...filtered];
                  if (options.ascending === false) {
                    sorted.sort((a, b) => a[orderColumn] > b[orderColumn] ? 1 : -1);
                  } else {
                    sorted.sort((a, b) => a[orderColumn] < b[orderColumn] ? 1 : -1);
                  }

                  return { data: sorted, error: null };
                })
                .catch(error => ({ data: [], error: { message: error.message } }));
            },
            single: () => {
              return apiRequest(`/api/${table}?order=${orderColumn}`)
                .then(response => {
                  const filtered = applyFilters(response.data);

                  const sorted = [...filtered];
                  if (options.ascending === false) {
                    sorted.sort((a, b) => a[orderColumn] > b[orderColumn] ? 1 : -1);
                  } else {
                    sorted.sort((a, b) => a[orderColumn] < b[orderColumn] ? 1 : -1);
                  }

                  const result = sorted[0] || null;
                  return { data: result, error: result ? null : { message: 'Not found' } };
                })
                .catch(error => ({ data: null, error: { message: error.message } }));
            },
          };
        },
        limit: (limit: number) => {
          return apiRequest(`/api/${table}?limit=${limit}`)
            .then(response => {
              let filtered = applyFilters(response.data);
              if (limit) filtered = filtered.slice(0, limit);
              return { data: filtered, error: null };
            })
            .catch(error => ({ data: [], error: { message: error.message } }));
        },
        single: () => {
          return apiRequest(`/api/${table}`)
            .then(response => {
              const filtered = applyFilters(response.data);
              const result = filtered[0] || null;
              return { data: result, error: result ? null : { message: 'Not found' } };
            })
            .catch(error => ({ data: null, error: { message: error.message } }));
        },
      };

      // Make the builder thenable so it executes when awaited
      builder.then = (resolve: any, reject: any) => {
        apiRequest(`/api/${table}`)
          .then(response => {
            const filtered = applyFilters(response.data);
            resolve({ data: filtered, error: null });
          })
          .catch(error => {
            reject({ data: [], error: { message: error.message } });
          });
        return builder;
      };

      return builder;
    };

    return {
      select: (columns = '*') => {
        return createQueryBuilder();
      },

      insert: (item: any) => {
        return apiRequest(`/api/${table}`, {
          method: 'POST',
          body: JSON.stringify(item),
        })
          .then(response => ({ data: [response.data], error: null }))
          .catch(error => ({ data: null, error: { message: error.message } }));
      },

      update: (updates: any) => {
        return {
          eq: (column: string, value: any) => {
            // First get the item by filter, then update it
            return apiRequest(`/api/${table}`)
              .then(response => {
                const item = response.data.find((i: any) => i[column] === value);
                if (!item) {
                  return { data: [], error: { message: 'Not found' } };
                }
                return apiRequest(`/api/${table}/${item.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(updates),
                });
              })
              .then(response => ({ data: [response.data], error: null }))
              .catch(error => ({ data: [], error: { message: error.message } }));
          },
        };
      },

      delete: () => {
        return {
          eq: (column: string, value: any) => {
            return apiRequest(`/api/${table}`)
              .then(response => {
                const item = response.data.find((i: any) => i[column] === value);
                if (!item) {
                  return { data: null, error: { message: 'Not found' } };
                }
                return apiRequest(`/api/${table}/${item.id}`, {
                  method: 'DELETE',
                });
              })
              .then(() => ({ data: null, error: null }))
              .catch(error => ({ data: null, error: { message: error.message } }));
          },
        };
      },
    };
  },

  rpc: () => Promise.resolve({ data: [], error: null }),
};

export const getAuthHeaders = async () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser?.access_token || 'api-token'}`,
  };
};
