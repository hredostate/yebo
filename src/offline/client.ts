
import { SupabaseClient } from '@supabase/supabase-js';
import { cache, uploadStore, conflictsStore } from './db.js';
import { enqueue, drain, QueuedItem } from './queue.js';

export { cache };

type CacheMutationKind = 'insert' | 'update' | 'delete';

const tableCacheKeys: Record<string, string> = {
  reports: 'reports',
  tasks: 'tasks',
  students: 'students',
  user_profiles: 'users',
};

export function applyCacheMutation<T extends Record<string, any>>(
  current: T[] | null,
  mutation: { type: CacheMutationKind; record?: T | null; match?: Record<string, any> },
  idKey: string = 'id',
): T[] | null {
  if (!current) return current;

  const record = mutation.record ?? null;
  const targetId = mutation.match?.[idKey] ?? (record ? record[idKey] : undefined);

  switch (mutation.type) {
    case 'insert': {
      if (!record || record[idKey] == null) return current;
      const deduped = current.filter(item => item?.[idKey] !== record[idKey]);
      return [record, ...deduped];
    }
    case 'update': {
      if (targetId == null || !record) return current;
      let updated = false;
      const next = current.map(item => {
        if (item?.[idKey] === targetId) {
          updated = true;
          return { ...item, ...record } as T;
        }
        return item;
      });

      if (!updated && record[idKey] != null) {
        next.unshift(record as T);
      }
      return next;
    }
    case 'delete': {
      if (targetId == null) return current;
      return current.filter(item => item?.[idKey] !== targetId);
    }
    default:
      return current;
  }
}

// Lazy getter to avoid circular dependency at module load
// Import is deferred until first call
// Using dynamic import() for proper ESM handling in production builds
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
      // Dynamic import for lazy loading (Vite/Rollup handles this correctly)
      // This breaks the circular dependency by deferring the import until first use
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

// Lazy proxy that defers Supabase access until actually used
export const supa: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    // Bind methods to the client instance
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export interface Conflict {
  key: string; // e.g., 'attendance_records-123'
  table: string;
  local: QueuedItem;
  server: any;
  resolved: boolean;
  detectedAt: string;
}

// 2. Define the Offline Client
class OfflineClient {
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.sync.bind(this));
      // Initial sync attempt on load if online
      if (this.online()) {
        setTimeout(() => this.sync(), 2000); // Delay slightly to allow app boot
      }
    }
  }

  private async updateCache(table: string, type: CacheMutationKind, record?: any, match?: Record<string, any>) {
    const cacheKey = tableCacheKeys[table];
    if (!cacheKey) return;

    try {
      const current = await cache.get<any[]>(cacheKey);
      const next = applyCacheMutation(current, { type, record, match });
      if (next) {
        await cache.set(cacheKey, next);
      }
    } catch (error) {
      console.warn(`[Offline] Failed to update cache for ${table}:`, error);
    }
  }

  online(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  async selectCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cachedData = await cache.get<T>(key);

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

  async insert(table: string, payload: any) {
    if (this.online()) {
      const result = await supa.from(table).insert(payload).select().single();
      if (!result.error) {
        await this.updateCache(table, 'insert', result.data ?? payload);
      }
      if (result.error) console.error(`[Online Insert Error] ${table}:`, result.error);
      return result;
    }
    await enqueue({ kind: 'insert', table, payload });
    // Return optimistic data with a temporary ID for offline mode
    const optimisticData = { ...payload, id: payload.id || Date.now() };
    await this.updateCache(table, 'insert', optimisticData);
    return { offlineQueued: true, data: optimisticData, error: null };
  }

  async update(table: string, payload: any, match: any) {
    if (this.online()) {
      const result = await supa.from(table).update(payload).match(match);
      if (!result.error) {
        await this.updateCache(table, 'update', { ...payload, ...match }, match);
      }
      if (result.error) console.error(`[Online Update Error] ${table}:`, result.error);
      return result;
    }
    await enqueue({ kind: 'update', table, payload, match });
    await this.updateCache(table, 'update', { ...payload, ...match }, match);
    return { offlineQueued: true, data: null, error: null };
  }

  async del(table: string, match: any) {
    if (this.online()) {
      const result = await supa.from(table).delete().match(match);
      if (!result.error) {
        await this.updateCache(table, 'delete', null, match);
      }
      if (result.error) console.error(`[Online Delete Error] ${table}:`, result.error);
      return result;
    }
    await enqueue({ kind: 'delete', table, match });
    await this.updateCache(table, 'delete', null, match);
    return { offlineQueued: true, data: null, error: null };
  }

  async rpc(rpcName: string, rpcArgs: any) {
    if (this.online()) {
      const result = await supa.rpc(rpcName, rpcArgs);
      if (result.error) console.error(`[Online RPC Error] ${rpcName}:`, result.error);
      return result;
    }
    await enqueue({ kind: 'rpc', rpcName, rpcArgs });
    return { offlineQueued: true, data: null, error: null };
  }

  async fn(functionName: string, functionBody: any) {
    if (this.online()) {
      const result = await supa.functions.invoke(functionName, { body: functionBody });
      if (result.error) console.error(`[Online Function Error] ${functionName}:`, result.error);
      return result;
    }
    await enqueue({ kind: 'function', functionName, functionBody });
    return { offlineQueued: true, data: null, error: null };
  }
  
  async upload(bucket: string, filePath: string, fileBody: Blob, options?: any) {
    if (this.online()) {
        const result = await supa.storage.from(bucket).upload(filePath, fileBody, options);
        if (result.error) console.error(`[Online Upload Error] ${bucket}/${filePath}:`, result.error);
        return result;
    }
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await uploadStore.setItem(fileId, fileBody);
    await enqueue({ kind: 'upload', bucket, filePath, fileId, options });
    return { offlineQueued: true, data: null, error: null };
  }

  // --- Conflict Management ---

  async getConflicts(): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    await conflictsStore.iterate((value: Conflict) => {
      if (!value.resolved) {
        conflicts.push(value);
      }
    });
    return conflicts;
  }

  async markConflictResolved(key: string): Promise<void> {
    const conflict = await conflictsStore.getItem<Conflict>(key);
    if (conflict) {
      const updatedConflict = { ...conflict, resolved: true };
      await conflictsStore.setItem(key, updatedConflict);
    }
  }

  // --- Sync Logic ---

  async sync() {
    if (!this.online() || this.isSyncing) return;

    this.isSyncing = true;
    console.log('[Offline] Starting sync...');

    await drain(this.processQueueItem.bind(this));

    console.log('[Offline] Sync finished.');
    this.isSyncing = false;
  }

  private async processQueueItem(item: QueuedItem): Promise<boolean> {
    let error: any = null;

    try {
      switch (item.kind) {
        case 'insert':
          ({ error } = await supa.from(item.table!).insert(item.payload));
          if (!error) {
            await this.updateCache(item.table!, 'insert', item.payload as any);
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
                const conflict: Conflict = {
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
          ({ error } = await supa.from(item.table!).update(item.payload).match(item.match));
          if (!error) {
            await this.updateCache(
              item.table!,
              'update',
              { ...(item.payload as any), ...(item.match as any) },
              item.match as any,
            );
          }
          break;
        }
        case 'delete':
          ({ error } = await supa.from(item.table!).delete().match(item.match));
          if (!error) {
            await this.updateCache(item.table!, 'delete', null, item.match as any);
          }
          break;
        case 'rpc':
          ({ error } = await supa.rpc(item.rpcName!, item.rpcArgs));
          break;
        case 'function':
          ({ error } = await supa.functions.invoke(item.functionName!, { body: item.functionBody }));
          break;
        case 'upload': {
          const fileBody = await uploadStore.getItem<Blob>(item.fileId!);
          if (!fileBody) {
              console.error(`[Queue] File blob not found for upload item ${item.id}. Removing item.`);
              await uploadStore.removeItem(item.fileId!);
              return true; // Mark as processed to remove from queue
          }
          ({ error } = await supa.storage.from(item.bucket!).upload(item.filePath!, fileBody, item.options));
          if (!error) {
              // Only remove blob on successful upload
              await uploadStore.removeItem(item.fileId!);
          }
          break;
        }
        default:
          console.warn(`[Queue] Unknown item kind: ${(item as any).kind}`);
          return true; // Remove unknown item types from queue
      }
    } catch (e) {
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
