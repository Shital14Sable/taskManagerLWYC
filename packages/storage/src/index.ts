export type { StorageAdapter, PendingChange, ExportData, Tombstone, TombstoneData, EntityType } from './interface';
export { IndexedDBStorage } from './adapters/indexeddb';
export { MemoryStorage } from './adapters/memory';
export { SQLiteStorage } from './adapters/sqlite';

import type { StorageAdapter } from './interface';
import { IndexedDBStorage } from './adapters/indexeddb';
import { MemoryStorage } from './adapters/memory';
import { SQLiteStorage } from './adapters/sqlite';

/**
 * Factory function to get appropriate storage
 */
export function createStorage(
  type: 'indexeddb' | 'sqlite' | 'memory' = 'indexeddb'
): StorageAdapter {
  switch (type) {
    case 'indexeddb':
      return new IndexedDBStorage();
    case 'memory':
      return new MemoryStorage();
    case 'sqlite':
      return new SQLiteStorage();
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}
