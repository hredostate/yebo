import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './runtimeConfig.js';

const { url: supabaseUrl, anonKey: supabaseAnonKey, error: configError } = getSupabaseConfig();

let supabase: SupabaseClient | null = null;
let supabaseError: string | null = null;

function initializeSupabase() {
  if (supabase || supabaseError) return;

  if (configError) {
    supabaseError = configError;
    return;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e: any) {
    supabaseError = `Failed to initialize Supabase client: ${e.message}`;
  }
}

initializeSupabase();

export function requireSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;
  throw new Error(supabaseError || 'Supabase client not initialized.');
}

export { supabase, supabaseError };
