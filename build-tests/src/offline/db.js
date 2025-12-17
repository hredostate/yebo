import localforage from 'localforage';
/**
 * Main data cache for read operations (cache-first strategy).
 */
const cacheStore = localforage.createInstance({
    name: 'sg360-app-cache',
    storeName: 'data',
    description: 'Cache for application data like reports, users, etc.',
});
export const cache = {
    /**
     * Sets a value in the cache.
     * @param key The key to store the data under.
     * @param value The data to store. Can be any type storable by IndexedDB.
     */
    set: (key, value) => {
        return cacheStore.setItem(key, value);
    },
    /**
     * Retrieves a value from the cache.
     * @param key The key of the item to retrieve.
     * @returns The cached data, or null if not found.
     */
    get: (key) => {
        return cacheStore.getItem(key);
    },
    /**
     * Removes an item from the cache.
     * @param key The key of the item to remove.
     */
    remove: (key) => {
        return cacheStore.removeItem(key);
    },
};
/**
 * IndexedDB store for the durable write queue (operations metadata).
 */
export const queueStore = localforage.createInstance({
    name: 'sg360-sync-queue',
    storeName: 'write_operations',
    description: 'Queue for pending inserts, updates, deletes, and function calls.',
});
/**
 * IndexedDB store for pending file uploads (Blob data).
 */
export const uploadStore = localforage.createInstance({
    name: 'sg360-sync-queue',
    storeName: 'file_uploads',
    description: 'Storage for file blobs awaiting upload.',
});
/**
 * IndexedDB store for sync conflicts.
 */
export const conflictsStore = localforage.createInstance({
    name: 'sg360-conflicts',
    storeName: 'conflicts',
    description: 'Storage for sync conflicts that require resolution.',
});
