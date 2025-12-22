# Supabase Client Usage Guide

## Overview

This guide explains the correct pattern for using the Supabase client in the Yebo codebase. Following these patterns prevents "supabase is not defined" errors and circular dependency issues.

## Why This Pattern Is Required

The Supabase client uses **lazy initialization** to avoid circular dependencies at module load time. This means:

1. The client is not initialized when modules are imported
2. Initialization happens only when the client is first accessed
3. Each function must explicitly call `requireSupabaseClient()` to get the client instance
4. The client is not a global variable - it must be obtained within each function scope

## Background

For detailed background on why this pattern was implemented, see:
- [`CIRCULAR_DEPENDENCY_FIX_SUPABASE_CLIENT.md`](./CIRCULAR_DEPENDENCY_FIX_SUPABASE_CLIENT.md) - Explains the circular dependency issue and the lazy initialization solution

## Correct Usage Pattern

### ✅ Pattern A: Basic Function Usage

Every function that uses the Supabase client must:
1. Import `requireSupabaseClient` from the appropriate relative path
2. Call `const supabase = requireSupabaseClient();` at the start of the function

```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

export const loadStudents = async () => {
  // ✅ CORRECT: Call requireSupabaseClient() at the function start
  const supabase = requireSupabaseClient();
  
  const { data, error } = await supabase
    .from('students')
    .select('*');
  
  if (error) throw error;
  return data;
};
```

### ✅ Pattern B: React Component with Multiple Handlers

Each handler function should call `requireSupabaseClient()` independently:

```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

const MyComponent = () => {
  const handleLoad = async () => {
    // ✅ CORRECT: Each handler gets its own client reference
    const supabase = requireSupabaseClient();
    const { data } = await supabase.from('students').select('*');
    // ... use data
  };

  const handleSave = async (studentData: any) => {
    // ✅ CORRECT: This handler also calls requireSupabaseClient()
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('students').insert(studentData);
    // ... handle error
  };

  return (
    <div>
      <button onClick={handleLoad}>Load</button>
      <button onClick={handleSave}>Save</button>
    </div>
  );
};
```

### ✅ Pattern C: React Query / TanStack Query Hooks

Query functions must call `requireSupabaseClient()` within the queryFn:

```typescript
import { useQuery } from '@tanstack/react-query';
import { requireSupabaseClient } from '../../services/supabaseClient';

export const useStudents = () => {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      // ✅ CORRECT: Call within the query function
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('students')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
};
```

### ✅ Pattern D: Service Functions

Service modules should export functions that call `requireSupabaseClient()`:

```typescript
// src/services/studentService.ts
import { requireSupabaseClient } from './supabaseClient';
import type { Student } from '../types';

export async function getStudent(id: number): Promise<Student> {
  // ✅ CORRECT: Get client at function start
  const supabase = requireSupabaseClient();
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateStudent(id: number, updates: Partial<Student>): Promise<void> {
  // ✅ CORRECT: Each function calls requireSupabaseClient()
  const supabase = requireSupabaseClient();
  
  const { error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
}
```

### ✅ Pattern E: Nested Functions and Callbacks

Nested functions that use Supabase should also call `requireSupabaseClient()`:

```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

const processStudents = async () => {
  const supabase = requireSupabaseClient();
  const { data: students } = await supabase.from('students').select('*');
  
  // ✅ CORRECT: Nested async function has its own requireSupabaseClient() call
  const updateStudent = async (student: Student) => {
    const supabase = requireSupabaseClient();
    await supabase.from('students').update(student).eq('id', student.id);
  };
  
  // Process each student
  for (const student of students) {
    await updateStudent(student);
  }
};
```

## Incorrect Usage Patterns (What to Avoid)

### ❌ Pattern X: Missing Import

```typescript
// ❌ WRONG: No import of requireSupabaseClient
const loadData = async () => {
  // This will fail: supabase is not defined
  const { data } = await supabase.from('table').select('*');
};
```

**Fix:** Import and call `requireSupabaseClient()`:
```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

const loadData = async () => {
  const supabase = requireSupabaseClient();
  const { data } = await supabase.from('table').select('*');
};
```

### ❌ Pattern Y: Direct Import of supabase

```typescript
// ❌ WRONG: Importing supabase directly (old pattern)
import { supabase } from '../services/supabaseClient';

const loadData = async () => {
  const { data } = await supabase.from('table').select('*');
};
```

**Fix:** Use `requireSupabaseClient()` instead:
```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

const loadData = async () => {
  const supabase = requireSupabaseClient();
  const { data } = await supabase.from('table').select('*');
};
```

### ❌ Pattern Z: Missing requireSupabaseClient() Call in Nested Function

```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

// ❌ WRONG: Parent has supabase, but nested function tries to use it without its own call
const ParentComponent = () => {
  const handleSave = async () => {
    const supabase = requireSupabaseClient();
    
    // This nested function doesn't have its own requireSupabaseClient() call
    const nestedSave = async () => {
      // ❌ This may error - supabase might not be in scope properly
      await supabase.from('table').insert(data);
    };
  };
};
```

**Fix:** Each function should call `requireSupabaseClient()`:
```typescript
import { requireSupabaseClient } from '../services/supabaseClient';

const ParentComponent = () => {
  const handleSave = async () => {
    const supabase = requireSupabaseClient();
    // ... use supabase
  };
  
  const nestedSave = async () => {
    // ✅ CORRECT: Has its own requireSupabaseClient() call
    const supabase = requireSupabaseClient();
    await supabase.from('table').insert(data);
  };
};
```

## Available Supabase Operations

Once you have the client instance via `requireSupabaseClient()`, you can use all standard Supabase operations:

### Database Operations
```typescript
const supabase = requireSupabaseClient();

// SELECT
const { data } = await supabase.from('students').select('*');

// INSERT
const { error } = await supabase.from('students').insert({ name: 'John' });

// UPDATE
const { error } = await supabase.from('students').update({ name: 'Jane' }).eq('id', 1);

// DELETE
const { error } = await supabase.from('students').delete().eq('id', 1);
```

### RPC (Remote Procedure Calls)
```typescript
const supabase = requireSupabaseClient();

const { data, error } = await supabase.rpc('compute_grade', {
  p_score: 85,
  p_grading_scheme_id: 1
});
```

### Edge Functions
```typescript
const supabase = requireSupabaseClient();

const { data, error } = await supabase.functions.invoke('my-function', {
  body: { key: 'value' }
});
```

### Storage
```typescript
const supabase = requireSupabaseClient();

const { error } = await supabase.storage
  .from('avatars')
  .upload('public/avatar1.png', file);

const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('public/avatar1.png');
```

### Authentication
```typescript
const supabase = requireSupabaseClient();

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

await supabase.auth.signOut();

const { data: { user } } = await supabase.auth.getUser();
```

## Import Path Guidelines

The import path for `requireSupabaseClient` depends on your file's location:

- From `src/components/`: `'../services/supabaseClient'`
- From `src/components/admin/`: `'../../services/supabaseClient'`
- From `src/services/`: `'./supabaseClient'`
- From `src/hooks/`: `'../services/supabaseClient'`
- From `src/hooks/queries/`: `'../../services/supabaseClient'`
- From `src/utils/`: `'../services/supabaseClient'`

## Checklist for New Code

When writing new code that uses Supabase, verify:

- [ ] File imports `requireSupabaseClient` from the correct relative path
- [ ] Every function that uses `supabase` calls `const supabase = requireSupabaseClient();` at its start
- [ ] Nested functions have their own `requireSupabaseClient()` call if they use Supabase
- [ ] Not using direct import of `supabase` from `supabaseClient.ts`
- [ ] Build completes without errors (`npm run build`)

## Troubleshooting

### "supabase is not defined" Error

**Cause:** A function is trying to use `supabase` without calling `requireSupabaseClient()`.

**Solution:** Add `const supabase = requireSupabaseClient();` at the start of the function.

### "Supabase client not initialized" Error

**Cause:** The Supabase configuration is missing or invalid.

**Solution:** Check your `.env` file for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Circular Dependency Warnings

**Cause:** A module is importing Supabase client at the top level in a way that creates a circular import chain.

**Solution:** Ensure you're using lazy initialization via `requireSupabaseClient()` instead of direct imports.

## Testing

When writing tests that use Supabase:

1. Mock the `requireSupabaseClient` function
2. Return a mock Supabase client with the methods you need
3. Test your business logic independently of Supabase

Example:
```typescript
import { vi } from 'vitest';

// Mock the module
vi.mock('../services/supabaseClient', () => ({
  requireSupabaseClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));
```

## Summary

**Golden Rule:** Every function that uses the Supabase client must call `const supabase = requireSupabaseClient();` at its start.

This pattern:
- ✅ Prevents circular dependencies
- ✅ Ensures the client is properly initialized
- ✅ Makes code more testable
- ✅ Avoids "supabase is not defined" runtime errors
- ✅ Works correctly with lazy initialization

## Additional Resources

- [CIRCULAR_DEPENDENCY_FIX_SUPABASE_CLIENT.md](./CIRCULAR_DEPENDENCY_FIX_SUPABASE_CLIENT.md) - Technical background on the circular dependency fix
- [Supabase JavaScript Client Documentation](https://supabase.com/docs/reference/javascript/introduction)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

## Questions or Issues?

If you encounter issues with Supabase client usage:
1. Verify you're following the patterns in this guide
2. Check the circular dependency documentation
3. Run `npm run check:circular` to detect circular dependencies
4. Ensure your build completes: `npm run build`
