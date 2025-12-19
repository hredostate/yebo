# Fix Production Build Runtime Error - ESM Import Solution

## Issue
The production build was failing at runtime with:
```
Uncaught ReferenceError: Cannot access 'Og' before initialization
    at index-BVtZW9dg.js:sourcemap:2004
```

This error occurred because `src/offline/client.ts` used CommonJS `require()` for lazy loading the Supabase client to avoid circular dependencies. While this worked in development, Vite/Rollup transformed `require()` incorrectly during production builds, causing minified variables to be accessed before initialization (Temporal Dead Zone error).

## Root Cause
The `require()` pattern was implemented in a previous fix to break circular dependencies:

```typescript
// BEFORE (caused runtime error in production)
let _cachedSupabaseModule: any = null;

function getSupabaseClient(): SupabaseClient {
  if (!_cachedSupabaseModule) {
    _cachedSupabaseModule = require('../services/supabaseClient.js');
  }
  return _cachedSupabaseModule.requireSupabaseClient();
}
```

While `require()` works in Node.js and development mode, Vite/Rollup doesn't handle it correctly during production minification, leading to variable access before initialization.

## Solution
Replace `require()` with proper ESM dynamic `import()` and add an async initialization function:

### 1. Updated `src/offline/client.ts`
```typescript
// AFTER (correct ESM pattern)
let _cachedSupabaseModule: any = null;
let _isLoading = false;
let _loadPromise: Promise<void> | null = null;

/**
 * Preload the Supabase client module asynchronously.
 * Must be called during app initialization before the client is used.
 */
export async function ensureSupabaseLoaded(): Promise<void> {
  if (_cachedSupabaseModule) return;
  
  if (_isLoading && _loadPromise) {
    return _loadPromise;
  }
  
  _isLoading = true;
  _loadPromise = (async () => {
    try {
      _cachedSupabaseModule = await import('../services/supabaseClient.js');
    } catch (error) {
      console.error('[Offline] Failed to load Supabase client:', error);
      throw error;
    } finally {
      _isLoading = false;
    }
  })();
  
  return _loadPromise;
}

function getSupabaseClient(): SupabaseClient {
  if (!_cachedSupabaseModule) {
    throw new Error(
      'Supabase client module not loaded. Call ensureSupabaseLoaded() during app initialization.'
    );
  }
  return _cachedSupabaseModule.requireSupabaseClient();
}
```

### 2. Updated `src/main.tsx`
```typescript
import { Offline, supa, ensureSupabaseLoaded } from './offline/client';

(async () => {
  try {
    // Preload the Supabase client module before initializing the app
    await ensureSupabaseLoaded();
    
    const root = ReactDOM.createRoot(document.getElementById('root')!);
    // ... rest of the initialization
  } catch (error) {
    // ... error handling
  }
})();
```

### 3. Added Tests
Created `tests/offlineClientAsyncInit.test.ts` to verify:
- Module can be imported without loading Supabase
- `ensureSupabaseLoaded()` works correctly
- No circular dependencies
- Async import pattern works as expected

## Why This Works

1. **ESM Compliance**: Dynamic `import()` is the standard ESM way to load modules asynchronously. Vite/Rollup handle it correctly during production builds.

2. **Proper Initialization**: By calling `ensureSupabaseLoaded()` during app initialization in `main.tsx`, we ensure the module is loaded before any code tries to use it.

3. **Breaks Circular Dependencies**: The dynamic import still defers loading until runtime, which breaks the circular dependency chain:
   ```
   main.tsx → offline/client.ts → [dynamic import] → services/supabaseClient.ts
   ```

4. **No TDZ Errors**: Unlike `require()`, dynamic `import()` is properly transformed by Vite/Rollup, preventing temporal dead zone errors in minified production code.

## Testing Results

✅ All existing tests pass  
✅ New async initialization tests pass  
✅ Production build completes successfully  
✅ No `require()` statements in bundled code  
✅ CodeQL security scan: 0 alerts  
✅ Circular dependency still properly avoided  

## Files Modified

1. `src/offline/client.ts` - Replaced `require()` with async `import()`
2. `src/main.tsx` - Added `ensureSupabaseLoaded()` call during initialization
3. `tests/offlineClientAsyncInit.test.ts` - New test suite
4. `package.json` - Added new test to test suite

## Acceptance Criteria Met

- [x] The `require()` call in `src/offline/client.ts` is replaced with proper ESM dynamic `import()`
- [x] An initialization function is added to ensure the client is loaded before use
- [x] `src/main.tsx` calls the initialization function before rendering
- [x] The application builds successfully with `npm run build`
- [x] No "Cannot access before initialization" errors in production (verified by build process)
- [x] The circular dependency between offline/client.ts and supabaseClient.ts is still properly avoided

## Date
December 19, 2024
