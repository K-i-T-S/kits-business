import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

const API_URL = new URL('/functions/v1/make-server-210e7672', supabaseUrl).toString();

// Helper to get auth headers
export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
    'apikey': supabaseAnonKey,
  };
};

async function handleResponse(response: Response) {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const error = await response.json();
      message = error.error || message;
    } catch {
      // ignore body parsing errors
    }
    throw new Error(message);
  }
  return response.json();
}

// API helper functions
export const api = {
  async get(endpoint: string) {
    // Add cache-busting parameter with version for better control
    const cacheVersion = 'v1.0';
    const url = `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}_cb=${cacheVersion}-${Date.now()}`;
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      headers,
      cache: 'no-store', // Explicitly prevent caching
    });
    return handleResponse(response);
  },

  async post(endpoint: string, data: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async put(endpoint: string, data: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async delete(endpoint: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(response);
  },
};

