import type { StorageAdapter, PendingChange, ExportData, Tombstone, EntityType as StorageEntityType } from '@trackmind/storage';
import type { Task, Project, Schedule, Goal, Note, TaskList, ListInstance, HabitInstance, JournalEntry } from '@trackmind/core';
import { GitHubAPI, type GitHubConfig, type SyncMetadata } from '../github/api';

// Tombstone cleanup: remove tombstones older than this many days
const TOMBSTONE_RETENTION_DAYS = 30;

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'conflict'
  | 'offline';

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  message: string;
  conflicts?: ConflictInfo[];
  syncedAt?: Date;
  changesPushed?: number;
  changesPulled?: number;
}

export interface ConflictInfo {
  entityType: string;
  entityId: string;
  localVersion: unknown;
  remoteVersion: unknown;
  resolvedWith?: 'local' | 'remote';
}

export type ConflictResolutionStrategy = 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual';

export interface SyncOptions {
  conflictStrategy?: ConflictResolutionStrategy;
  forceDirection?: 'push' | 'pull';
  dryRun?: boolean;
}

export interface SyncEngineConfig extends GitHubConfig {
  deviceId: string;
  autoSync?: boolean;
  syncIntervalMs?: number;
}

type EntityType = 'task' | 'project' | 'schedule' | 'goal' | 'note' | 'list' | 'list_instance' | 'habit_instance' | 'journal' | 'mood_checkin';

interface EntityWithTimestamp {
  id?: string;
  date?: string;
  updated_at?: string;
}

/**
 * Sync engine for coordinating data between local storage and GitHub
 */
// Minimum time between syncs to avoid redundant API calls (in milliseconds)
const MIN_SYNC_INTERVAL_MS = 90 * 1000; // 90 seconds

export class SyncEngine {
  private storage: StorageAdapter;
  private github: GitHubAPI;
  private config: SyncEngineConfig;
  private status: SyncStatus = 'idle';
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private lastSuccessfulSyncTime: number = 0; // Timestamp of last successful sync

  constructor(storage: StorageAdapter, config: SyncEngineConfig) {
    this.storage = storage;
    this.config = {
      ...config,
      autoSync: config.autoSync ?? false,
      syncIntervalMs: config.syncIntervalMs ?? 2 * 60 * 1000, // 2 minutes default
    };
    this.github = new GitHubAPI(config);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach((cb) => cb(status));
  }

  /**
   * Start automatic syncing
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      // Skip if a sync happened recently (within MIN_SYNC_INTERVAL_MS)
      // This prevents redundant syncs when debounced/visibility syncs already fired
      const timeSinceLastSync = Date.now() - this.lastSuccessfulSyncTime;
      if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
        console.log(`[SyncEngine] Skipping interval sync - last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`);
        return;
      }
      this.sync().catch(console.error);
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop automatic syncing
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Sync if enough time has passed since last sync
   * Used by visibility change and debounced sync triggers
   * Returns true if sync was triggered, false if skipped
   */
  async syncIfNeeded(): Promise<boolean> {
    const timeSinceLastSync = Date.now() - this.lastSuccessfulSyncTime;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
      console.log(`[SyncEngine] Skipping sync - last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`);
      return false;
    }
    await this.sync();
    return true;
  }

  /**
   * Get time since last successful sync in milliseconds
   */
  getTimeSinceLastSync(): number {
    return Date.now() - this.lastSuccessfulSyncTime;
  }

  /**
   * Initialize sync - ensure repository exists and is set up
   */
  async initialize(): Promise<void> {
    const repoExists = await this.github.checkRepository();

    if (!repoExists) {
      await this.github.createRepository(true);
    }
  }

  /**
   * Perform full sync
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.status === 'syncing') {
      return {
        success: false,
        status: 'syncing',
        message: 'Sync already in progress',
      };
    }

    const conflictStrategy = options.conflictStrategy ?? 'newest-wins';

    try {
      this.setStatus('syncing');

      // Check network
      if (!navigator.onLine) {
        this.setStatus('offline');
        return {
          success: false,
          status: 'offline',
          message: 'No network connection',
        };
      }

      // Get local data and pending changes
      console.log('[SyncEngine] Getting local data...');
      const localData = await this.storage.exportAll();
      const pendingChanges = await this.storage.getPendingChanges();
      const lastSyncTime = await this.storage.getLastSyncTime();
      console.log('[SyncEngine] Local data:', { tasks: localData.tasks?.length, pending: pendingChanges.length });

      // Get remote data (smart load: multi-file first, then single-file fallback)
      console.log('[SyncEngine] Getting remote data...');
      const remoteData = await this.github.loadExportDataSmart();
      const syncMetadata = await this.github.getSyncMetadata();
      console.log('[SyncEngine] Remote data:', remoteData ? 'exists' : 'null', 'metadata:', syncMetadata ? 'exists' : 'null');

      let result: SyncResult;

      if (options.forceDirection === 'push') {
        // Force push local to remote
        console.log('[SyncEngine] Force push requested');
        result = await this.forcePush(localData, pendingChanges);
      } else if (options.forceDirection === 'pull') {
        // Force pull remote to local
        console.log('[SyncEngine] Force pull requested');
        result = await this.forcePull(remoteData);
      } else if (!remoteData) {
        // No remote data - initial push
        console.log('[SyncEngine] No remote data, doing initial push');
        result = await this.initialPush(localData);
      } else if (pendingChanges.length === 0 && !syncMetadata) {
        // No local changes and no sync history - pull remote
        console.log('[SyncEngine] No local changes and no sync history, pulling remote');
        result = await this.forcePull(remoteData);
      } else {
        // Normal sync - merge changes
        console.log('[SyncEngine] Merge sync');
        result = await this.mergeSync(
          localData,
          remoteData,
          pendingChanges,
          lastSyncTime,
          conflictStrategy,
          options.dryRun ?? false
        );
      }
      console.log('[SyncEngine] Result:', result);

      if (result.success) {
        await this.storage.setLastSyncTime(new Date());
        this.lastSuccessfulSyncTime = Date.now(); // Track for skip-if-recent logic
        this.setStatus('idle');
      } else if (result.conflicts && result.conflicts.length > 0) {
        this.setStatus('conflict');
      } else {
        this.setStatus('error');
      }

      return result;
    } catch (error) {
      console.error('[SyncEngine] Sync error:', error);
      this.setStatus('error');
      return {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error during sync',
      };
    }
  }

  /**
   * Force push local data to remote
   */
  private async forcePush(
    localData: ExportData,
    pendingChanges: PendingChange[]
  ): Promise<SyncResult> {
    const commitSha = await this.github.saveExportDataSmart(localData, 'Force push from device');

    await this.github.saveSyncMetadata({
      lastSyncSha: commitSha,
      lastSyncTime: new Date().toISOString(),
      deviceId: this.config.deviceId,
    });

    // Clear pending changes
    await this.storage.clearPendingChanges(pendingChanges.map((c) => c.id));

    return {
      success: true,
      status: 'idle',
      message: 'Force pushed local data to remote',
      syncedAt: new Date(),
      changesPushed: pendingChanges.length,
      changesPulled: 0,
    };
  }

  /**
   * Force pull remote data to local
   */
  private async forcePull(remoteData: ExportData | null): Promise<SyncResult> {
    if (!remoteData) {
      return {
        success: false,
        status: 'error',
        message: 'No remote data to pull',
      };
    }

    await this.storage.importAll(remoteData);

    const latestSha = await this.github.getLatestCommitSha();
    if (latestSha) {
      await this.github.saveSyncMetadata({
        lastSyncSha: latestSha,
        lastSyncTime: new Date().toISOString(),
        deviceId: this.config.deviceId,
      });
    }

    // Clear any pending changes since we've overwritten local
    const pendingChanges = await this.storage.getPendingChanges();
    await this.storage.clearPendingChanges(pendingChanges.map((c) => c.id));

    return {
      success: true,
      status: 'idle',
      message: 'Force pulled remote data to local',
      syncedAt: new Date(),
      changesPushed: 0,
      changesPulled: 1,
    };
  }

  /**
   * Initial push when remote is empty
   */
  private async initialPush(localData: ExportData): Promise<SyncResult> {
    const commitSha = await this.github.saveExportDataSmart(localData, 'Initial sync');

    await this.github.saveSyncMetadata({
      lastSyncSha: commitSha,
      lastSyncTime: new Date().toISOString(),
      deviceId: this.config.deviceId,
    });

    // Clear pending changes
    const pendingChanges = await this.storage.getPendingChanges();
    await this.storage.clearPendingChanges(pendingChanges.map((c) => c.id));

    return {
      success: true,
      status: 'idle',
      message: 'Initial data pushed to remote',
      syncedAt: new Date(),
      changesPushed: 1,
      changesPulled: 0,
    };
  }

  /**
   * Merge sync - handle both local and remote changes
   */
  private async mergeSync(
    localData: ExportData,
    remoteData: ExportData,
    pendingChanges: PendingChange[],
    _lastSyncTime: Date | null,
    conflictStrategy: ConflictResolutionStrategy,
    dryRun: boolean
  ): Promise<SyncResult> {
    const conflicts: ConflictInfo[] = [];
    const mergedData = { ...localData };
    let changesPulled = 0;

    // Build sets of locally deleted entity IDs from pending changes
    const locallyDeletedIds = new Map<EntityType, Set<string>>();
    for (const change of pendingChanges) {
      if (change.operation === 'delete') {
        const entityType = change.type as EntityType;
        if (!locallyDeletedIds.has(entityType)) {
          locallyDeletedIds.set(entityType, new Set());
        }
        locallyDeletedIds.get(entityType)!.add(change.entityId);
      }
    }

    // Build set of remotely deleted IDs from remote tombstones
    const remotelyDeletedIds = new Map<EntityType, Set<string>>();
    const remoteTombstones = remoteData.tombstones?.tombstones || [];
    for (const tombstone of remoteTombstones) {
      const entityType = tombstone.entityType as EntityType;
      if (!remotelyDeletedIds.has(entityType)) {
        remotelyDeletedIds.set(entityType, new Set());
      }
      remotelyDeletedIds.get(entityType)!.add(tombstone.entityId);
    }

    // Merge each entity type
    mergedData.tasks = this.mergeEntities(
      localData.tasks,
      remoteData.tasks,
      pendingChanges.filter((c) => c.type === 'task'),
      conflictStrategy,
      'task',
      conflicts,
      'id',
      locallyDeletedIds.get('task') || new Set(),
      remotelyDeletedIds.get('task') || new Set()
    );
    changesPulled += this.countNewFromRemote(localData.tasks, remoteData.tasks);

    mergedData.projects = this.mergeEntities(
      localData.projects,
      remoteData.projects,
      pendingChanges.filter((c) => c.type === 'project'),
      conflictStrategy,
      'project',
      conflicts,
      'id',
      locallyDeletedIds.get('project') || new Set(),
      remotelyDeletedIds.get('project') || new Set()
    );
    changesPulled += this.countNewFromRemote(localData.projects, remoteData.projects);

    mergedData.schedules = this.mergeEntities(
      localData.schedules,
      remoteData.schedules,
      pendingChanges.filter((c) => c.type === 'schedule'),
      conflictStrategy,
      'schedule',
      conflicts,
      'date',
      locallyDeletedIds.get('schedule') || new Set(),
      remotelyDeletedIds.get('schedule') || new Set()
    );
    changesPulled += this.countNewFromRemote(localData.schedules, remoteData.schedules, 'date');

    mergedData.goals = this.mergeEntities(
      localData.goals,
      remoteData.goals,
      pendingChanges.filter((c) => c.type === 'goal'),
      conflictStrategy,
      'goal',
      conflicts,
      'id',
      locallyDeletedIds.get('goal') || new Set(),
      remotelyDeletedIds.get('goal') || new Set()
    );
    changesPulled += this.countNewFromRemote(localData.goals, remoteData.goals);

    mergedData.notes = this.mergeEntities(
      localData.notes as EntityWithTimestamp[],
      remoteData.notes as EntityWithTimestamp[],
      pendingChanges.filter((c) => c.type === 'note'),
      conflictStrategy,
      'note',
      conflicts,
      'id',
      locallyDeletedIds.get('note') || new Set(),
      remotelyDeletedIds.get('note') || new Set()
    ) as typeof localData.notes;
    changesPulled += this.countNewFromRemote(localData.notes as EntityWithTimestamp[], remoteData.notes as EntityWithTimestamp[]);

    mergedData.lists = this.mergeEntities(
      localData.lists,
      remoteData.lists,
      pendingChanges.filter((c) => c.type === 'list'),
      conflictStrategy,
      'list',
      conflicts,
      'id',
      locallyDeletedIds.get('list') || new Set(),
      remotelyDeletedIds.get('list') || new Set()
    );
    changesPulled += this.countNewFromRemote(localData.lists, remoteData.lists);

    mergedData.listInstances = this.mergeEntities(
      localData.listInstances,
      remoteData.listInstances,
      pendingChanges.filter((c) => c.type === 'list_instance'),
      conflictStrategy,
      'list_instance',
      conflicts,
      'id',
      locallyDeletedIds.get('list_instance') || new Set(),
      remotelyDeletedIds.get('list_instance') || new Set()
    ) as typeof localData.listInstances;
    changesPulled += this.countNewFromRemote(localData.listInstances, remoteData.listInstances);

    // HabitInstance uses composite key (habit_id:date), not 'id' field
    // Pre-process to add synthetic id, merge, then strip it
    const localHabitsWithId = (localData.habitInstances || []).map(hi => ({
      ...hi,
      id: `${hi.habit_id}:${hi.date}`,
    }));
    const remoteHabitsWithId = (remoteData.habitInstances || []).map(hi => ({
      ...hi,
      id: `${hi.habit_id}:${hi.date}`,
    }));
    const mergedHabitsWithId = this.mergeEntities(
      localHabitsWithId,
      remoteHabitsWithId,
      pendingChanges.filter((c) => c.type === 'habit_instance'),
      conflictStrategy,
      'habit_instance',
      conflicts,
      'id',
      locallyDeletedIds.get('habit_instance') || new Set(),
      remotelyDeletedIds.get('habit_instance') || new Set()
    );
    // Strip the synthetic id field
    mergedData.habitInstances = mergedHabitsWithId.map(({ id, ...rest }) => rest) as typeof localData.habitInstances;
    changesPulled += this.countNewFromRemote(localHabitsWithId, remoteHabitsWithId);

    mergedData.journalEntries = this.mergeEntities(
      localData.journalEntries || [],
      remoteData.journalEntries || [],
      pendingChanges.filter((c) => c.type === 'journal'),
      conflictStrategy,
      'journal',
      conflicts,
      'id',
      locallyDeletedIds.get('journal') || new Set(),
      remotelyDeletedIds.get('journal') || new Set()
    ) as typeof localData.journalEntries;
    changesPulled += this.countNewFromRemote(localData.journalEntries || [], remoteData.journalEntries || []);

    // Merge mood check-ins
    mergedData.moodCheckIns = this.mergeEntities(
      localData.moodCheckIns || [],
      remoteData.moodCheckIns || [],
      pendingChanges.filter((c) => c.type === 'mood_checkin'),
      conflictStrategy,
      'mood_checkin',
      conflicts,
      'id',
      locallyDeletedIds.get('mood_checkin') || new Set(),
      remotelyDeletedIds.get('mood_checkin') || new Set()
    ) as typeof localData.moodCheckIns;
    changesPulled += this.countNewFromRemote(localData.moodCheckIns || [], remoteData.moodCheckIns || []);

    // Merge tombstones from local and remote
    const localTombstones = localData.tombstones?.tombstones || [];
    const mergedTombstones = this.mergeTombstones(localTombstones, remoteTombstones);
    mergedData.tombstones = {
      tombstones: mergedTombstones,
      cleanedUpBefore: localData.tombstones?.cleanedUpBefore,
    };

    // Handle manual conflicts
    if (conflictStrategy === 'manual' && conflicts.length > 0) {
      return {
        success: false,
        status: 'conflict',
        message: `${conflicts.length} conflict(s) require manual resolution`,
        conflicts,
      };
    }

    if (dryRun) {
      return {
        success: true,
        status: 'idle',
        message: `Dry run: would sync ${pendingChanges.length} changes and pull ${changesPulled} changes`,
        conflicts,
        changesPushed: pendingChanges.length,
        changesPulled,
      };
    }

    // Apply merged data locally
    await this.storage.importAll(mergedData);

    // Cleanup old tombstones (both locally and in merged data)
    const cleanedCount = await this.storage.cleanupTombstones(TOMBSTONE_RETENTION_DAYS);
    if (cleanedCount > 0) {
      console.log(`[SyncEngine] Cleaned up ${cleanedCount} old tombstones`);
      // Re-export to get cleaned tombstones for remote
      const cleanedData = await this.storage.exportAll();
      mergedData.tombstones = cleanedData.tombstones;
    }

    // Push merged data to remote
    const commitSha = await this.github.saveExportDataSmart(mergedData, `Sync from ${this.config.deviceId}`);

    await this.github.saveSyncMetadata({
      lastSyncSha: commitSha,
      lastSyncTime: new Date().toISOString(),
      deviceId: this.config.deviceId,
    });

    // Clear pending changes
    await this.storage.clearPendingChanges(pendingChanges.map((c) => c.id));

    return {
      success: true,
      status: 'idle',
      message: conflicts.length > 0
        ? `Synced with ${conflicts.length} auto-resolved conflict(s)`
        : 'Sync completed successfully',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      syncedAt: new Date(),
      changesPushed: pendingChanges.length,
      changesPulled,
    };
  }

  /**
   * Merge tombstones from local and remote, removing duplicates
   */
  private mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
    const merged = new Map<string, Tombstone>();

    // Add all local tombstones
    for (const t of local) {
      const key = `${t.entityType}:${t.entityId}`;
      merged.set(key, t);
    }

    // Add remote tombstones (keep the newer one if duplicate)
    for (const t of remote) {
      const key = `${t.entityType}:${t.entityId}`;
      const existing = merged.get(key);
      if (!existing || t.deletedAt > existing.deletedAt) {
        merged.set(key, t);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Merge a list of entities with conflict resolution
   *
   * Key deletion handling:
   * - locallyDeletedIds: IDs that were deleted locally (pending delete operations)
   * - remotelyDeletedIds: IDs that were deleted remotely (from remote tombstones)
   *
   * Rules:
   * 1. If locally deleted → don't include in result (even if remote has it)
   * 2. If remotely deleted → don't include in result (even if local has it)
   * 3. Deletions always win over updates (delete is a terminal operation)
   */
  private mergeEntities<T extends EntityWithTimestamp>(
    local: T[],
    remote: T[],
    changes: PendingChange[],
    strategy: ConflictResolutionStrategy,
    entityType: EntityType,
    conflicts: ConflictInfo[],
    idField: 'id' | 'date' = 'id',
    locallyDeletedIds: Set<string> = new Set(),
    remotelyDeletedIds: Set<string> = new Set()
  ): T[] {
    const localMap = new Map<string, T>();
    const remoteMap = new Map<string, T>();
    const changedIds = new Set(
      changes.filter(c => c.operation !== 'delete').map((c) => c.entityId)
    );

    local.forEach((item) => {
      const key = idField === 'id' ? item.id : item.date;
      if (key) localMap.set(key, item);
    });

    remote.forEach((item) => {
      const key = idField === 'id' ? item.id : item.date;
      if (key) remoteMap.set(key, item);
    });

    const result = new Map<string, T>();

    // Process all local items
    for (const [id, localItem] of localMap) {
      // Skip if locally deleted (delete wins)
      if (locallyDeletedIds.has(id)) {
        continue;
      }

      // Skip if remotely deleted (delete wins)
      if (remotelyDeletedIds.has(id)) {
        continue;
      }

      const remoteItem = remoteMap.get(id);

      if (!remoteItem) {
        // Only in local - this is a new local item, keep it
        // (Remote doesn't have it and it's not in remote tombstones)
        result.set(id, localItem);
      } else if (changedIds.has(id)) {
        // Conflict - local was changed (not deleted) and remote exists
        const resolved = this.resolveConflict(localItem, remoteItem, strategy);
        conflicts.push({
          entityType,
          entityId: id,
          localVersion: localItem,
          remoteVersion: remoteItem,
          resolvedWith: resolved === localItem ? 'local' : 'remote',
        });
        result.set(id, resolved);
      } else {
        // No local changes - use remote version
        result.set(id, remoteItem);
      }
    }

    // Add remote-only items (not locally deleted)
    for (const [id, remoteItem] of remoteMap) {
      // Skip if already processed from local
      if (localMap.has(id)) {
        continue;
      }

      // Skip if locally deleted (local delete wins)
      if (locallyDeletedIds.has(id)) {
        continue;
      }

      // Skip if remotely deleted (shouldn't happen but be safe)
      if (remotelyDeletedIds.has(id)) {
        continue;
      }

      // This is a new remote item, add it
      result.set(id, remoteItem);
    }

    return Array.from(result.values());
  }

  /**
   * Resolve a conflict between local and remote versions
   */
  private resolveConflict<T extends EntityWithTimestamp>(
    local: T,
    remote: T,
    strategy: ConflictResolutionStrategy
  ): T {
    switch (strategy) {
      case 'local-wins':
        return local;
      case 'remote-wins':
        return remote;
      case 'newest-wins': {
        const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
        const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
        return localTime >= remoteTime ? local : remote;
      }
      case 'manual':
        // Return local for now - caller will handle
        return local;
      default:
        return local;
    }
  }

  /**
   * Count items that exist in remote but not in local
   */
  private countNewFromRemote<T extends EntityWithTimestamp>(
    local: T[],
    remote: T[],
    idField: 'id' | 'date' = 'id'
  ): number {
    const localIds = new Set(
      local.map((item) => (idField === 'id' ? item.id : item.date))
    );
    return remote.filter(
      (item) => !localIds.has(idField === 'id' ? item.id : item.date)
    ).length;
  }

  /**
   * Check if there are pending changes to sync
   */
  async hasPendingChanges(): Promise<boolean> {
    const changes = await this.storage.getPendingChanges();
    return changes.length > 0;
  }

  /**
   * Get count of pending changes
   */
  async getPendingChangeCount(): Promise<number> {
    const changes = await this.storage.getPendingChanges();
    return changes.length;
  }

  /**
   * Check for remote changes without syncing
   */
  async checkForRemoteChanges(): Promise<boolean> {
    const syncMetadata = await this.github.getSyncMetadata();
    if (!syncMetadata) {
      // No previous sync - check if remote has data
      const remoteData = await this.github.loadExportData();
      return remoteData !== null;
    }

    return this.github.hasRemoteChanges(syncMetadata.lastSyncSha);
  }
}
