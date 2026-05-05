import type { ExportData } from '@trackmind/storage';

/**
 * Abstract interface for cloud storage providers
 * Both GitHub and Google Drive implement this interface
 */
export interface CloudStorageProvider {
  /**
   * Provider identifier
   */
  readonly providerType: 'github' | 'google';

  /**
   * Save complete export data to cloud storage
   * @returns A reference ID (commit sha for GitHub, file id for Google Drive)
   */
  saveExportData(data: ExportData, message?: string): Promise<string>;

  /**
   * Load export data from cloud storage
   * @returns The export data or null if not found
   */
  loadExportData(): Promise<ExportData | null>;

  /**
   * Get sync metadata
   */
  getSyncMetadata(): Promise<SyncMetadataBase | null>;

  /**
   * Save sync metadata
   */
  saveSyncMetadata(metadata: SyncMetadataBase): Promise<void>;

  /**
   * Check for remote changes since last sync
   */
  hasRemoteChanges(lastSyncRef: string): Promise<boolean>;

  /**
   * Create a backup if needed (weekly for Google Drive, optional for GitHub)
   */
  createBackupIfNeeded?(data: ExportData): Promise<boolean>;
}

/**
 * Base sync metadata structure
 */
export interface SyncMetadataBase {
  lastSyncTime: string;
  deviceId: string;
  // GitHub uses lastSyncSha, Google uses fileId
  lastSyncRef?: string;
}

/**
 * GitHub-specific sync metadata
 */
export interface GitHubSyncMetadata extends SyncMetadataBase {
  lastSyncSha: string;
}

/**
 * Google Drive-specific sync metadata
 */
export interface GoogleDriveSyncMetadata extends SyncMetadataBase {
  fileId: string;
  backupFileId?: string;
  lastBackupTime?: string;
}

/**
 * Unified user info structure
 */
export interface UnifiedUser {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  provider: 'github' | 'google';
}

/**
 * Unified auth state structure
 */
export interface UnifiedAuthState {
  isAuthenticated: boolean;
  provider: 'github' | 'google' | null;
  user: UnifiedUser | null;
  expiresAt: Date | null;
}
