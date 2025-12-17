
import { queueStore } from './db.js';

export type QueuedItemKind = 'insert' | 'update' | 'delete' | 'rpc' | 'function' | 'upload';

export interface QueuedItem {
  id: string;
  kind: QueuedItemKind;
  table?: string;
  payload?: any;
  match?: any;
  rpcName?: string;
  rpcArgs?: any;
  functionName?: string;
  functionBody?: any;
  createdAt: string; // ISO string for sorting
  // Upload-specific fields
  bucket?: string;
  filePath?: string;
  fileId?: string; // Links to Blob in uploadStore
  options?: any;
}

/**
 * Generates a unique, sortable ID.
 */
const generateId = (): string => `${new Date().getTime()}-${Math.random().toString(36).slice(2)}`;

/**
 * Adds a new operation to the write queue.
 * @param item The operation details, without id or createdAt.
 * @returns The full queued item with id and timestamp.
 */
export async function enqueue(item: Omit<QueuedItem, 'id' | 'createdAt'>): Promise<QueuedItem> {
  const queuedItem: QueuedItem = {
    ...item,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await queueStore.setItem(queuedItem.id, queuedItem);
  return queuedItem;
}

/**
 * Retrieves all items currently in the queue.
 * @returns An array of all queued items.
 */
export async function list(): Promise<QueuedItem[]> {
  const items: QueuedItem[] = [];
  await queueStore.iterate((value: QueuedItem) => {
    items.push(value);
  });
  // Ensure chronological order for processing
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Removes a specific item from the queue by its ID.
 * @param id The ID of the item to remove.
 */
export async function remove(id: string): Promise<void> {
  await queueStore.removeItem(id);
}

/**
 * Processes all items in the queue sequentially. If an item fails to process,
 * the drain stops, leaving the failed item and subsequent items in the queue for the next attempt.
 * @param processor A function that takes a QueuedItem and returns a Promise<boolean> indicating success.
 */
export async function drain(processor: (item: QueuedItem) => Promise<boolean>): Promise<void> {
  const itemsToProcess = await list();

  for (const item of itemsToProcess) {
    try {
      const success = await processor(item);
      if (success) {
        await remove(item.id);
      } else {
        // Processor failed, stop draining to maintain order
        console.warn(`[Queue] Processor failed for item ${item.id}. Halting drain.`);
        break; 
      }
    } catch (error) {
      console.error(`[Queue] Error during drain for item ${item.id}:`, error);
      // Exception means failure, stop draining
      break;
    }
  }
}

/**
 * Gets the number of items currently in the queue.
 * @returns The count of items in the queue.
 */
export async function count(): Promise<number> {
    return queueStore.length();
}
