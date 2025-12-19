import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './runtimeConfig.js';

// Lazy initialization to avoid circular dependency at module load time
let _supabaseClient: SupabaseClient | null = null;
let _supabaseError: string | null = null;
let _initialized = false;

function initializeSupabase() {
  if (_initialized) return;
  _initialized = true;

  const { url, anonKey, error: configError } = getSupabaseConfig();
  
  if (configError) {
    _supabaseError = configError;
    return;
  }

  try {
    _supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });
  } catch (e: any) {
    _supabaseError = `Failed to initialize Supabase client: ${e.message}`;
  }
}

// DO NOT call initializeSupabase() at module load time!
// It will be called lazily on first access.

export function requireSupabaseClient(): SupabaseClient {
  initializeSupabase();
  if (_supabaseClient) return _supabaseClient;
  throw new Error(_supabaseError || 'Supabase client not initialized.');
}

// Lazy proxy for backward compatibility
// This allows existing code using `supabase.from(...)` to work
const supabaseProxy = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    initializeSupabase();
    if (!_supabaseClient) {
      throw new Error(_supabaseError || 'Supabase client not initialized.');
    }
    const value = (_supabaseClient as any)[prop];
    // Bind functions to the client
    if (typeof value === 'function') {
      return value.bind(_supabaseClient);
    }
    return value;
  },
});

// Export the proxy as `supabase` for backward compatibility
export const supabase = supabaseProxy;

// Export error as a getter function to avoid module-load-time evaluation
export function getSupabaseError(): string | null {
  initializeSupabase();
  return _supabaseError;
}

// For backward compatibility with existing code that uses `supabaseError`
export const supabaseError: string | null = null; // Will be null initially, use getSupabaseError() for actual value
