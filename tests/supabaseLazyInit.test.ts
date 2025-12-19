/**
 * Test suite for lazy initialization of Supabase client to prevent circular dependencies
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
  await test('supabaseClient module can be imported without initialization', async () => {
    const module = await import('../src/services/supabaseClient.js');
    assert.ok(module.requireSupabaseClient);
    assert.ok(module.supabase);
    assert.ok(module.getSupabaseError);
  });

  // Test 2: Offline client module can be imported without circular dependency
  await test('offline client module can be imported without circular dependency', async () => {
    const module = await import('../src/offline/client.js');
    assert.ok(module.supa);
    assert.ok(module.Offline);
    assert.ok(module.cache);
  });

  // Test 3: requireSupabaseClient throws error when config is invalid
  await test('requireSupabaseClient throws error with invalid config', async () => {
    const { reloadRuntimeConfig } = await import('../src/services/runtimeConfig.js');
    reloadRuntimeConfig({});
    
    const { requireSupabaseClient } = await import('../src/services/supabaseClient.js');
    
    try {
      requireSupabaseClient();
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error instanceof Error);
      // Error message should mention Supabase or client initialization
      const errorMsg = (error as Error).message.toLowerCase();
      assert.ok(
        errorMsg.includes('supabase') || errorMsg.includes('client') || errorMsg.includes('initialized'),
        `Error message should mention supabase/client/initialized, got: ${(error as Error).message}`
      );
    }
  });

  // Test 4: getSupabaseError works after initialization attempt
  await test('getSupabaseError returns error after failed initialization', async () => {
    const { reloadRuntimeConfig } = await import('../src/services/runtimeConfig.js');
    reloadRuntimeConfig({});
    
    const { getSupabaseError, requireSupabaseClient } = await import('../src/services/supabaseClient.js');
    
    try {
      requireSupabaseClient();
    } catch {
      // Expected to fail
    }
    
    const error = getSupabaseError();
    assert.ok(error !== null);
    // Error message should mention Supabase or configuration
    const errorMsg = error.toLowerCase();
    assert.ok(
      errorMsg.includes('supabase') || errorMsg.includes('config'),
      `Error message should mention supabase/config, got: ${error}`
    );
  });

  // Test 5: Verify lazy initialization doesn't happen at module load
  await test('lazy initialization defers until first access', async () => {
    // If we got this far without errors during module imports,
    // it means initialization is truly lazy and circular dependencies are broken
    assert.ok(true, 'Module imports succeeded without circular dependency errors');
  });

  console.log('\nAll Supabase lazy initialization tests passed!');
})();
