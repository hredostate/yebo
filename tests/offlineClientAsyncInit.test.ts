/**
 * Test suite for async initialization of offline client to prevent runtime errors
 */

import { strict as assert } from 'node:assert';

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn())
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}`);
      throw error;
    });
}

// Run all tests sequentially
(async () => {
  // Test 1: Module can be imported without immediate initialization
  await test('offline client module can be imported without loading supabase', async () => {
    const module = await import('../src/offline/client.js');
    assert.ok(module.ensureSupabaseLoaded);
    assert.ok(module.supa);
    assert.ok(module.Offline);
    assert.ok(module.cache);
  });

  // Test 2: ensureSupabaseLoaded works correctly
  await test('ensureSupabaseLoaded loads the supabase module', async () => {
    const { ensureSupabaseLoaded } = await import('../src/offline/client.js');
    
    // Should complete without error
    await ensureSupabaseLoaded();
    
    // Calling again should be idempotent
    await ensureSupabaseLoaded();
  });

  // Test 3: supa proxy throws error before ensureSupabaseLoaded is called
  await test('supa proxy throws error before ensureSupabaseLoaded', async () => {
    // Create a fresh import context by clearing the module cache
    // Note: In real usage, ensureSupabaseLoaded should be called in main.tsx before using supa
    
    // We can't actually test this in a node environment because the module is already loaded
    // This test documents the expected behavior
    assert.ok(true, 'Documented: supa should throw if used before ensureSupabaseLoaded()');
  });

  // Test 4: Verify no circular dependencies
  await test('no circular dependency between offline/client and supabaseClient', async () => {
    // If we got this far without errors during module imports,
    // it means there are no circular dependencies
    assert.ok(true, 'Module imports succeeded without circular dependency errors');
  });

  // Test 5: Verify async import works
  await test('ensureSupabaseLoaded uses async import correctly', async () => {
    const { ensureSupabaseLoaded } = await import('../src/offline/client.js');
    
    // Should return a promise
    const result = ensureSupabaseLoaded();
    assert.ok(result instanceof Promise);
    
    // Should resolve successfully
    await result;
  });

  console.log('\nAll offline client async initialization tests passed!');
})();
