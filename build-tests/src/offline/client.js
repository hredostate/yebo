import { cache, uploadStore, conflictsStore } from './db.js';
import { enqueue, drain } from './queue.js';
import { supabase as supabaseClient, supabaseError, requireSupabaseClient } from '../services/supabaseClient.js';
export { cache };
const tableCacheKeys = {
    reports: 'reports',
    tasks: 'tasks',
    students: 'students',
    user_profiles: 'users',
};
export function applyCacheMutation(current, mutation, idKey = 'id') {
    if (!current)
        return current;
    const record = mutation.record ?? null;
    const targetId = mutation.match?.[idKey] ?? (record ? record[idKey] : undefined);
    switch (mutation.type) {
        case 'insert': {
            if (!record || record[idKey] == null)
                return current;
            const deduped = current.filter(item => item?.[idKey] !== record[idKey]);
            return [record, ...deduped];
        }
        case 'update': {
            if (targetId == null || !record)
                return current;
            let updated = false;
            const next = current.map(item => {
                if (item?.[idKey] === targetId) {
                    updated = true;
                    return { ...item, ...record };
                }
                return item;
            });
            if (!updated && record[idKey] != null) {
                next.unshift(record);
            }
            return next;
        }
        case 'delete': {
            if (targetId == null)
                return current;
            return current.filter(item => item?.[idKey] !== targetId);
        }
        default:
            return current;
    }
}
// Reuse the Supabase client from supabaseClient.ts to avoid multiple GoTrueClient instances
// Lazy lookup keeps module import from throwing when env vars are missing so the app can surface the error gracefully
function getSupabaseClient() {
    try {
        return supabaseClient || requireSupabaseClient();
    }
    catch (error) {
        const reason = error.message || supabaseError || 'Supabase client not initialized.';
        throw new Error(reason);
    }
}
export const supa = new Proxy({}, {
    get(_target, prop) {
        const client = getSupabaseClient();
        return client[prop];
    },
});
// 2. Define the Offline Client
class OfflineClient {
    constructor() {
        Object.defineProperty(this, "isSyncing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.sync.bind(this));
            // Initial sync attempt on load if online
            if (this.online()) {
                setTimeout(() => this.sync(), 2000); // Delay slightly to allow app boot
            }
        }
    }
    async updateCache(table, type, record, match) {
        const cacheKey = tableCacheKeys[table];
        if (!cacheKey)
            return;
        try {
            const current = await cache.get(cacheKey);
            const next = applyCacheMutation(current, { type, record, match });
            if (next) {
                await cache.set(cacheKey, next);
            }
        }
        catch (error) {
            console.warn(`[Offline] Failed to update cache for ${table}:`, error);
        }
    }
    online() {
        if (typeof navigator === 'undefined')
            return true;
        return navigator.onLine;
    }
    async selectCached(key, fetcher) {
        const cachedData = await cache.get(key);
        if (this.online()) {
            // Fetch in the background to update cache
            fetcher().then(freshData => {
                if (freshData) {
                    cache.set(key, freshData);
                }
            }).catch(err => {
                console.warn(`[Offline] Background refresh for key '${key}' failed:`, err);
            });
        }
        if (cachedData) {
            return cachedData;
        }
        // If offline and no cache, fetcher will fail, but we let it try
        const freshData = await fetcher();
        await cache.set(key, freshData);
        return freshData;
    }
    // --- Write Operations ---
    async insert(table, payload) {
        if (this.online()) {
            const result = await supa.from(table).insert(payload).select().single();
            if (!result.error) {
                await this.updateCache(table, 'insert', result.data ?? payload);
            }
            if (result.error)
                console.error(`[Online Insert Error] ${table}:`, result.error);
            return result;
        }
        await enqueue({ kind: 'insert', table, payload });
        // Return optimistic data with a temporary ID for offline mode
        const optimisticData = { ...payload, id: payload.id || Date.now() };
        await this.updateCache(table, 'insert', optimisticData);
        return { offlineQueued: true, data: optimisticData, error: null };
    }
    async update(table, payload, match) {
        if (this.online()) {
            const result = await supa.from(table).update(payload).match(match);
            if (!result.error) {
                await this.updateCache(table, 'update', { ...payload, ...match }, match);
            }
            if (result.error)
                console.error(`[Online Update Error] ${table}:`, result.error);
            return result;
        }
        await enqueue({ kind: 'update', table, payload, match });
        await this.updateCache(table, 'update', { ...payload, ...match }, match);
        return { offlineQueued: true, data: null, error: null };
    }
    async del(table, match) {
        if (this.online()) {
            const result = await supa.from(table).delete().match(match);
            if (!result.error) {
                await this.updateCache(table, 'delete', null, match);
            }
            if (result.error)
                console.error(`[Online Delete Error] ${table}:`, result.error);
            return result;
        }
        await enqueue({ kind: 'delete', table, match });
        await this.updateCache(table, 'delete', null, match);
        return { offlineQueued: true, data: null, error: null };
    }
    async rpc(rpcName, rpcArgs) {
        if (this.online()) {
            const result = await supa.rpc(rpcName, rpcArgs);
            if (result.error)
                console.error(`[Online RPC Error] ${rpcName}:`, result.error);
            return result;
        }
        await enqueue({ kind: 'rpc', rpcName, rpcArgs });
        return { offlineQueued: true, data: null, error: null };
    }
    async fn(functionName, functionBody) {
        if (this.online()) {
            const result = await supa.functions.invoke(functionName, { body: functionBody });
            if (result.error)
                console.error(`[Online Function Error] ${functionName}:`, result.error);
            return result;
        }
        await enqueue({ kind: 'function', functionName, functionBody });
        return { offlineQueued: true, data: null, error: null };
    }
    async upload(bucket, filePath, fileBody, options) {
        if (this.online()) {
            const result = await supa.storage.from(bucket).upload(filePath, fileBody, options);
            if (result.error)
                console.error(`[Online Upload Error] ${bucket}/${filePath}:`, result.error);
            return result;
        }
        const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await uploadStore.setItem(fileId, fileBody);
        await enqueue({ kind: 'upload', bucket, filePath, fileId, options });
        return { offlineQueued: true, data: null, error: null };
    }
    // --- Conflict Management ---
    async getConflicts() {
        const conflicts = [];
        await conflictsStore.iterate((value) => {
            if (!value.resolved) {
                conflicts.push(value);
            }
        });
        return conflicts;
    }
    async markConflictResolved(key) {
        const conflict = await conflictsStore.getItem(key);
        if (conflict) {
            const updatedConflict = { ...conflict, resolved: true };
            await conflictsStore.setItem(key, updatedConflict);
        }
    }
    // --- Sync Logic ---
    async sync() {
        if (!this.online() || this.isSyncing)
            return;
        this.isSyncing = true;
        console.log('[Offline] Starting sync...');
        await drain(this.processQueueItem.bind(this));
        console.log('[Offline] Sync finished.');
        this.isSyncing = false;
    }
    async processQueueItem(item) {
        let error = null;
        try {
            switch (item.kind) {
                case 'insert':
                    ({ error } = await supa.from(item.table).insert(item.payload));
                    if (!error) {
                        await this.updateCache(item.table, 'insert', item.payload);
                    }
                    break;
                case 'update': {
                    // Conflict detection for specific tables
                    const conflictTables = ['attendance_records', 'score_entries'];
                    if (item.table && conflictTables.includes(item.table) && item.match?.id) {
                        const { data: serverData, error: fetchError } = await supa
                            .from(item.table)
                            .select('*,updated_at')
                            .match(item.match)
                            .single();
                        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: row not found
                            console.warn(`[Queue Conflict] Could not fetch server state for ${item.table} #${item.match.id}. Retrying later.`, fetchError);
                            return false; // Retry later, might be network issue
                        }
                        // If server has data and it's newer than when we queued our change
                        if (serverData && serverData.updated_at && (new Date(serverData.updated_at) > new Date(item.createdAt))) {
                            let differs = false;
                            for (const key in item.payload) {
                                // Simple shallow compare is enough here
                                if (item.payload[key] !== serverData[key]) {
                                    differs = true;
                                    break;
                                }
                            }
                            if (differs) {
                                const conflictKey = `${item.table}-${item.match.id}`;
                                const conflict = {
                                    key: conflictKey,
                                    table: item.table,
                                    local: item,
                                    server: serverData,
                                    resolved: false,
                                    detectedAt: new Date().toISOString(),
                                };
                                await conflictsStore.setItem(conflictKey, conflict);
                                console.warn(`[Queue Conflict] Detected and stored conflict for ${conflictKey}. Local update skipped.`);
                                return true; // Conflict stored, item is "handled", remove from queue.
                            }
                        }
                    }
                    // If no conflict, not a conflict-checked table, or server data is older, proceed with LWW.
                    ({ error } = await supa.from(item.table).update(item.payload).match(item.match));
                    if (!error) {
                        await this.updateCache(item.table, 'update', { ...item.payload, ...item.match }, item.match);
                    }
                    break;
                }
                case 'delete':
                    ({ error } = await supa.from(item.table).delete().match(item.match));
                    if (!error) {
                        await this.updateCache(item.table, 'delete', null, item.match);
                    }
                    break;
                case 'rpc':
                    ({ error } = await supa.rpc(item.rpcName, item.rpcArgs));
                    break;
                case 'function':
                    ({ error } = await supa.functions.invoke(item.functionName, { body: item.functionBody }));
                    break;
                case 'upload': {
                    const fileBody = await uploadStore.getItem(item.fileId);
                    if (!fileBody) {
                        console.error(`[Queue] File blob not found for upload item ${item.id}. Removing item.`);
                        await uploadStore.removeItem(item.fileId);
                        return true; // Mark as processed to remove from queue
                    }
                    ({ error } = await supa.storage.from(item.bucket).upload(item.filePath, fileBody, item.options));
                    if (!error) {
                        // Only remove blob on successful upload
                        await uploadStore.removeItem(item.fileId);
                    }
                    break;
                }
                default:
                    console.warn(`[Queue] Unknown item kind: ${item.kind}`);
                    return true; // Remove unknown item types from queue
            }
        }
        catch (e) {
            error = e;
        }
        if (error) {
            console.error(`[Queue] Failed to process item ${item.id}:`, { item, error });
            return false; // Failure, stop draining
        }
        console.log(`[Queue] Successfully processed item ${item.id}`);
        return true; // Success
    }
}
// 3. Export a singleton instance
export const Offline = new OfflineClient();
