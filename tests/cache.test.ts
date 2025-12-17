import assert from 'assert';
import localforage from 'localforage';

// Mock the cache module behavior
const cacheStore = localforage.createInstance({
  name: 'test-sg360-app-cache',
  storeName: 'test-data',
  description: 'Test cache for application data',
});

const cache = {
  set: <T>(key: string, value: T): Promise<T> => {
    return cacheStore.setItem(key, value);
  },
  get: <T>(key: string): Promise<T | null> => {
    return cacheStore.getItem(key);
  },
  remove: (key: string): Promise<void> => {
    return cacheStore.removeItem(key);
  },
  clear: (): Promise<void> => {
    return cacheStore.clear();
  },
};

// Test cache.set and cache.get
async function testSetAndGet() {
  await cache.set('test-key', 'test-value');
  const value = await cache.get('test-key');
  assert.strictEqual(value, 'test-value', 'Cache should store and retrieve values');
}

// Test cache.remove
async function testRemove() {
  await cache.set('remove-key', 'remove-value');
  await cache.remove('remove-key');
  const value = await cache.get('remove-key');
  assert.strictEqual(value, null, 'Cache should remove items');
}

// Test cache.clear
async function testClear() {
  // Add multiple items
  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3');
  
  // Verify items exist
  const before1 = await cache.get('key1');
  const before2 = await cache.get('key2');
  assert.strictEqual(before1, 'value1', 'Items should exist before clear');
  assert.strictEqual(before2, 'value2', 'Items should exist before clear');
  
  // Clear the cache
  await cache.clear();
  
  // Verify all items are gone
  const after1 = await cache.get('key1');
  const after2 = await cache.get('key2');
  const after3 = await cache.get('key3');
  assert.strictEqual(after1, null, 'Items should be cleared');
  assert.strictEqual(after2, null, 'Items should be cleared');
  assert.strictEqual(after3, null, 'Items should be cleared');
}

// Run all tests
async function runTests() {
  try {
    await testSetAndGet();
    console.log('✓ testSetAndGet passed');
    
    await testRemove();
    console.log('✓ testRemove passed');
    
    await testClear();
    console.log('✓ testClear passed');
    
    console.log('cache tests passed');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
