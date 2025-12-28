// Mock Supabase client for testing
export const supabase = {
  auth: {
    onAuthStateChange: (callback: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    getSession: () => Promise.resolve({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: { name: 'Test User' },
          },
        },
      },
    }),
    signInWithPassword: () => Promise.resolve({ data: { user: {} }, error: null }),
    signUp: () => Promise.resolve({ data: { user: {} }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    insert: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    delete: () => Promise.resolve({ data: [], error: null }),
  }),
  rpc: () => Promise.resolve({ data: [], error: null }),
};
