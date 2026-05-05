import { useApp } from '@/context/AppContext';
import type { SyncResult, SyncStatus } from '@trackmind/sync';

export function useSync() {
  const {
    syncEngine,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    sync,
    forcePush,
    forcePull,
    authState,
    login,
    logout,
  } = useApp();

  const isConnected = authState?.isAuthenticated ?? false;
  const isSyncing = syncStatus === 'syncing';
  const hasError = syncStatus === 'error';
  const hasConflict = syncStatus === 'conflict';
  const isOffline = syncStatus === 'offline' || !navigator.onLine;

  return {
    // Auth
    isConnected,
    user: authState?.user ?? null,
    login,
    logout,

    // Sync state
    syncEngine,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    isSyncing,
    hasError,
    hasConflict,
    isOffline,

    // Sync actions
    sync: async (): Promise<SyncResult | null> => {
      if (!syncEngine) return null;
      return sync();
    },
    forcePush: async (): Promise<SyncResult | null> => {
      if (!syncEngine) return null;
      return forcePush();
    },
    forcePull: async (): Promise<SyncResult | null> => {
      if (!syncEngine) return null;
      return forcePull();
    },

    // Helpers
    formatLastSync: (): string => {
      if (!lastSyncTime) return 'Never';
      const now = new Date();
      const diff = now.getTime() - lastSyncTime.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return lastSyncTime.toLocaleDateString();
    },
  };
}
