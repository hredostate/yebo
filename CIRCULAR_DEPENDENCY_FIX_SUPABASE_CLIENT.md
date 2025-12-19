# Circular Dependency Fix - Supabase Client Initialization

## Issue
The production build failed with a runtime error:
```
Uncaught ReferenceError: Cannot access 'Cg' before initialization
```

This was a circular dependency issue where minified variable `Cg` was referenced before initialization due to circular imports between modules.

## Root Cause

### Circular Dependency Chain
```
main.tsx
  → imports from './offline/client'
    → src/offline/client.ts imports from '../services/supabaseClient.js'
      → src/services/supabaseClient.ts imports from './runtimeConfig.js'
        → src/services/runtimeConfig.ts uses import.meta.env
```

### Critical Issue
In `src/services/supabaseClient.ts` line 36, there was a top-level side effect:
```typescript
initializeSupabase(); // This runs at module load time!
```

This caused immediate execution during module parsing, before all dependencies were resolved, leading to the circular dependency error during Vite's minification process.

## Solution

### 1. Fixed `src/services/supabaseClient.ts`

**Key Changes:**
- Removed the top-level `initializeSupabase()` call
- Implemented lazy initialization that only runs on first access
- Used a Proxy pattern for backward compatibility
- Maintained synchronous API to avoid breaking existing code

**Before:**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './runtimeConfig.js';

const { url: supabaseUrl, anonKey: supabaseAnonKey, error: configError } = getSupabaseConfig();

let supabase: SupabaseClient | null = null;
let supabaseError: string | null = null;

function initializeSupabase() {
  // ... initialization logic
}

initializeSupabase(); // ❌ PROBLEM: Runs at module load time!

export { supabase, supabaseError };
```

**After:**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './runtimeConfig.js';

let _supabaseClient: SupabaseClient | null = null;
let _supabaseError: string | null = null;
let _initialized = false;

function initializeSupabase() {
  if (_initialized) return;
  _initialized = true;

  const { url, anonKey, error: configError } = getSupabaseConfig();
  // ... initialization logic
}

// ✅ DO NOT call initializeSupabase() here!
// It will be called lazily on first access.

export function requireSupabaseClient(): SupabaseClient {
  initializeSupabase(); // ✅ Lazy initialization
  if (_supabaseClient) return _supabaseClient;
  throw new Error(_supabaseError || 'Supabase client not initialized.');
}

// Lazy proxy for backward compatibility
const supabaseProxy = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    initializeSupabase(); // ✅ Lazy initialization
    if (!_supabaseClient) {
      throw new Error(_supabaseError || 'Supabase client not initialized.');
    }
    const value = (_supabaseClient as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_supabaseClient);
    }
    return value;
  },
});

export const supabase = supabaseProxy;
```

### 2. Fixed `src/offline/client.ts`

**Key Changes:**
- Removed static import of `supabaseClient` module at the top
- Implemented lazy loading using `require()` inside a function
- Cached the module to avoid repeated requires

**Before:**
```typescript
import { supabase as supabaseClient, supabaseError, requireSupabaseClient } from '../services/supabaseClient.js';

function getSupabaseClient(): SupabaseClient {
  try {
    return supabaseClient || requireSupabaseClient();
  } catch (error) {
    const reason = (error as Error).message || supabaseError || 'Supabase client not initialized.';
    throw new Error(reason);
  }
}
```

**After:**
```typescript
// ❌ REMOVED: Static import that caused circular dependency
// import { supabase as supabaseClient, supabaseError, requireSupabaseClient } from '../services/supabaseClient.js';

let _cachedSupabaseModule: any = null;

function getSupabaseClient(): SupabaseClient {
  if (!_cachedSupabaseModule) {
    // ✅ Dynamic require for lazy loading (Vite handles this in the browser)
    _cachedSupabaseModule = require('../services/supabaseClient.js');
  }
  return _cachedSupabaseModule.requireSupabaseClient();
}
```

## Why This Works

1. **No Top-Level Side Effects**: By removing the `initializeSupabase()` call at module load time, we prevent any code from running during module parsing.

2. **Lazy Evaluation**: The `getSupabaseConfig()` is only called when `initializeSupabase()` is invoked, which only happens on first access to the Supabase client.

3. **Deferred Import**: In `offline/client.ts`, using `require()` inside a function defers the module import until the function is called, breaking the circular dependency chain.

4. **Backward Compatibility**: The Proxy pattern ensures existing code using `supabase.from(...)` continues to work without changes.

## Testing

### Verification Steps
1. ✅ `npm run build` - Production build completes without errors
2. ✅ `npm run test` - All existing tests pass
3. ✅ New lazy initialization tests pass
4. ✅ TypeScript compilation successful
5. ✅ CodeQL security scan passed (0 alerts)
6. ✅ No circular dependency errors detected

### Test Coverage
Created `tests/supabaseLazyInit.test.ts` with comprehensive tests:
- Module imports without circular dependency errors
- Error handling with invalid configuration
- Lazy initialization behavior
- getSupabaseError() function

## Best Practices Moving Forward

### When to Use Lazy Initialization
Use `requireSupabaseClient()` instead of importing `supabase` directly when:
1. Creating new service modules that might be imported early in the dependency tree
2. Experiencing circular dependency warnings in development
3. Getting TDZ (Temporal Dead Zone) errors in production builds
4. The service is imported by components loaded at app initialization

### Pattern for Services
```typescript
// ✅ GOOD - Lazy initialization
import { requireSupabaseClient } from './supabaseClient';

export async function myServiceFunction() {
  const supabase = requireSupabaseClient();
  // use supabase
}

// ❌ AVOID - Direct import (can cause circular dependencies)
import { supabase } from './supabaseClient';

export async function myServiceFunction() {
  // use supabase directly
}
```

## Related Documentation
- See `CIRCULAR_DEPENDENCY_FIX.md` for similar fix in `goalAnalysisService.ts`
- This pattern should be applied to any new services that import Supabase client

## Files Modified
1. `src/services/supabaseClient.ts` - Lazy initialization implementation
2. `src/offline/client.ts` - Lazy require() for breaking circular dependency
3. `tests/supabaseLazyInit.test.ts` - Test suite for lazy initialization

## Date
December 19, 2025
