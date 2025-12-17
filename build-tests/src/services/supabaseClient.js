import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './runtimeConfig.js';
const { url: supabaseUrl, anonKey: supabaseAnonKey, error: configError } = getSupabaseConfig();
let supabase = null;
let supabaseError = null;
function initializeSupabase() {
    if (supabase || supabaseError)
        return;
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
            global: {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            },
        });
    }
    catch (e) {
        supabaseError = `Failed to initialize Supabase client: ${e.message}`;
    }
}
initializeSupabase();
export function requireSupabaseClient() {
    if (supabase)
        return supabase;
    throw new Error(supabaseError || 'Supabase client not initialized.');
}
export { supabase, supabaseError };
