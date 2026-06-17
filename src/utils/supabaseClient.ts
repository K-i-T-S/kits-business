import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { localStorageClient, localApi, getAuthHeaders as localGetAuthHeaders } from './localStorageClient';
import { apiClient, getAuthHeaders as apiGetAuthHeaders } from './apiClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiUrl = import.meta.env.VITE_API_URL;
const useLocalMode = import.meta.env.VITE_USE_LOCAL_MODE === 'true';
const useApiMode = !!apiUrl;

if (!useLocalMode && !useApiMode && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, set VITE_USE_LOCAL_MODE=true, or set VITE_API_URL for local development.');
}

export const supabase = (
  useLocalMode ? localStorageClient : (useApiMode ? apiClient : createSupabaseClient(supabaseUrl, supabaseAnonKey))
) as unknown as SupabaseClient;

const API_URL = useLocalMode ? '/api/local' : (useApiMode ? apiUrl : new URL('/functions/v1/make-server-210e7672', supabaseUrl).toString());

// Helper to get auth headers
export const getAuthHeaders = async () => {
  if (useLocalMode) {
    return localGetAuthHeaders();
  }
  if (useApiMode) {
    return apiGetAuthHeaders();
  }
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
    if (useLocalMode) {
      return localApi.get(endpoint);
    }
    if (useApiMode) {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: await getAuthHeaders(),
      });
      return handleResponse(response);
    }
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
    if (useLocalMode) {
      return localApi.post(endpoint, data);
    }
    if (useApiMode) {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    }
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async put(endpoint: string, data: any) {
    if (useLocalMode) {
      return localApi.put(endpoint, data);
    }
    if (useApiMode) {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    }
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async delete(endpoint: string) {
    if (useLocalMode) {
      return localApi.delete(endpoint);
    }
    if (useApiMode) {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      return handleResponse(response);
    }
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(response);
  },
};

