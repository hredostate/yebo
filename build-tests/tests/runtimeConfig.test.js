import { strict as assert } from 'node:assert';
import { reloadRuntimeConfig } from '../src/services/runtimeConfig.js';
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (error) {
        console.error(`✗ ${name}`);
        throw error;
    }
}
test('flags missing Supabase env with actionable error', () => {
    const config = reloadRuntimeConfig({});
    assert.ok(config.supabase.error && config.supabase.error.includes('Supabase URL'));
    assert.strictEqual(config.supabase.url, '');
    assert.strictEqual(config.supabase.anonKey, '');
});
test('detects placeholder Supabase URL', () => {
    const config = reloadRuntimeConfig({
        VITE_SUPABASE_URL: 'https://mcmdtifvvbtolrscktdk.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
    });
    assert.ok(config.supabase.error && config.supabase.error.includes('placeholder'));
});
test('parses runtime flags from string values', () => {
    const config = reloadRuntimeConfig({ VITE_ENABLE_SESSION_IP_LOOKUP: 'true' });
    assert.strictEqual(config.flags.enableSessionIpLookup, true);
});
test('reads Groq config defaults', () => {
    const config = reloadRuntimeConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
        VITE_GROQ_API_KEY: 'test-api-key',
        VITE_GROQ_MODEL: 'llama-3.1-70b-versatile',
    });
    assert.strictEqual(config.groq.apiKey, 'test-api-key');
    assert.strictEqual(config.groq.model, 'llama-3.1-70b-versatile');
    assert.ok(!config.groq.error);
});
// Reset to default cached configuration for any subsequent imports
reloadRuntimeConfig(import.meta?.env ?? {});
console.log('All runtime config tests passed.');
