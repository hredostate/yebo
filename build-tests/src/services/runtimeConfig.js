let cachedConfig = null;
function parseBooleanFlag(value, defaultValue) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'off'].includes(normalized))
            return false;
    }
    return defaultValue;
}
function validateSupabaseEnv(env) {
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            url: supabaseUrl || '',
            anonKey: supabaseAnonKey || '',
            error: "Supabase URL and Anon Key must be provided. Please create a '.env' file in the project root and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Refer to README.md for details.",
        };
    }
    if (supabaseUrl.includes('mcmdtifvvbtolrscktdk')) {
        return {
            url: supabaseUrl,
            anonKey: supabaseAnonKey,
            error: 'A placeholder Supabase URL was detected. Please update your environment variables with your actual Supabase Project URL. Refer to the project\'s README.md for setup instructions.',
        };
    }
    return { url: supabaseUrl, anonKey: supabaseAnonKey };
}
function validateGroqEnv(env) {
    const apiKey = env.VITE_GROQ_API_KEY;
    const model = env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';
    if (!apiKey) {
        return {
            apiKey: '',
            model,
            error: 'Groq API key not configured. Set VITE_GROQ_API_KEY to enable AI helpers or provide a key in the app settings.',
        };
    }
    return { apiKey, model };
}
function resolveEnv(overrides) {
    if (overrides)
        return overrides;
    // eslint-disable-next-line no-unsafe-optional-chaining
    return import.meta?.env ?? {};
}
function buildRuntimeConfig(envOverrides) {
    const env = resolveEnv(envOverrides);
    return {
        supabase: validateSupabaseEnv(env),
        groq: validateGroqEnv(env),
        flags: {
            enableSessionIpLookup: parseBooleanFlag(env.VITE_ENABLE_SESSION_IP_LOOKUP, false),
        },
    };
}
export function getRuntimeConfig() {
    if (!cachedConfig) {
        cachedConfig = buildRuntimeConfig();
    }
    return cachedConfig;
}
export function getRuntimeFlags() {
    return getRuntimeConfig().flags;
}
export function getSupabaseConfig() {
    return getRuntimeConfig().supabase;
}
export function getGroqConfig() {
    return getRuntimeConfig().groq;
}
export function reloadRuntimeConfig(envOverrides) {
    cachedConfig = buildRuntimeConfig(envOverrides);
    return cachedConfig;
}
