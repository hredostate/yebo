/**
 * Separate entry point for supabaseClient used by offline module.
 * This allows proper code-splitting by avoiding mixed static/dynamic imports.
 */
export { supabase } from './supabaseClient.js';
