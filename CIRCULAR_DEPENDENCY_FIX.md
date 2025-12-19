# Circular Dependency Fix - Student Goals Feature

## Issue
After merging PR #136 (Student Academic Goals feature), the production build started failing with:
```
Uncaught ReferenceError: Cannot access 'wN' before initialization
```

## Root Cause
The `goalAnalysisService.ts` imported `supabase` synchronously at module level, creating a circular dependency during Vite's bundling process. This caused a Temporal Dead Zone (TDZ) error in the minified production code.

## Solution
Changed to lazy client initialization:
```typescript
// Before
import { supabase } from './supabaseClient';

// After  
import { requireSupabaseClient } from './supabaseClient';

export async function generateGoalAnalysis(...) {
    const supabase = requireSupabaseClient(); // Lazy init
    // ... rest of function
}
```

## Lessons Learned

### When to Use Lazy Initialization
Use `requireSupabaseClient()` instead of importing `supabase` directly when:
1. Creating new service modules that might be imported early in the dependency tree
2. Experiencing circular dependency warnings in development
3. Getting TDZ errors in production builds
4. The service is imported by components that are loaded at app initialization

### Best Practice for Services
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

### Why This Matters
- **Module Evaluation Order**: JavaScript evaluates all imports at module load time
- **Circular Dependencies**: When modules import each other, initialization order becomes unpredictable
- **Production Bundling**: Vite/Rollup may reorder modules during bundling, exposing hidden circular dependencies
- **TDZ Errors**: Accessing a `const` or `let` before initialization throws a ReferenceError

## Files Fixed
- `src/services/goalAnalysisService.ts`

## Related Files (Already Using Correct Pattern)
The following services already use lazy initialization:
- `src/offline/client.ts` - uses `requireSupabaseClient()`

## Related Files (Using Direct Import - Working Fine)
These services use direct import but don't cause issues (imported later in the chain):
- `src/services/campusAnalytics.ts`
- `src/services/kudiSmsService.ts`
- `src/services/smsService.ts`

Note: If circular dependency issues arise with these in the future, apply the same fix.

## Testing
1. ✅ Production build: `npm run build` succeeds
2. ✅ TypeScript compilation passes
3. ⏳ Manual browser testing needed

## Prevention
When creating new services:
1. Prefer `requireSupabaseClient()` over direct `supabase` import
2. Watch for circular dependency warnings in development
3. Test production builds before merging
4. Consider using the `vite-plugin-circular-dependency` plugin warnings
