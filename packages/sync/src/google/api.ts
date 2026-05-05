import type { ExportData } from '@trackmind/storage';

export interface GoogleDriveConfig {
  token: string;
  refreshToken?: () => Promise<string>;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

export interface SyncMetadata {
  lastSyncTime: string;
  deviceId: string;
  fileId: string;
  backupFileId?: string;
  lastBackupTime?: string;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const APP_DATA_FOLDER = 'appDataFolder'; // Special folder only this app can access
const DATA_FILENAME = 'trackmind-data.json';
const BACKUP_FILENAME = 'trackmind-backup.json';
const METADATA_FILENAME = 'trackmind-sync-metadata.json';

// Backup every 7 days
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Google Drive API service for data synchronization
 *
 * Uses the appDataFolder which is a special hidden folder that:
 * - Only this app can access
 * - User cannot see in their Drive UI
 * - Provides privacy isolation
 */
export class GoogleDriveAPI {
  private config: GoogleDriveConfig;
  private cachedFileIds: { data?: string; metadata?: string; backup?: string } = {};

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  /**
   * Get current token, refreshing if needed
   */
  private async getToken(): Promise<string> {
    // If we have a refresh function and might need refresh, use it
    if (this.config.refreshToken) {
      try {
        return await this.config.refreshToken();
      } catch {
        // Fall back to current token
      }
    }
    return this.config.token;
  }

  /**
   * Make an authenticated request to the Drive API
   */
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Drive API error (${response.status}): ${error}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text);
  }

  /**
   * Find a file by name in appDataFolder
   */
  private async findFile(name: string): Promise<DriveFile | null> {
    const query = `name='${name}' and '${APP_DATA_FOLDER}' in parents and trashed=false`;
    const result = await this.request<{ files: DriveFile[] }>(
      `${DRIVE_API_BASE}/files?spaces=${APP_DATA_FOLDER}&q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)`
    );

    return result.files?.[0] || null;
  }

  /**
   * Get file content by ID
   */
  private async getFileContent(fileId: string): Promise<string> {
    const token = await this.getToken();
    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get file content: ${response.status}`);
    }

    return response.text();
  }

  /**
   * Create a new file in appDataFolder
   */
  private async createFile(name: string, content: string, mimeType = 'application/json'): Promise<string> {
    const metadata = {
      name,
      parents: [APP_DATA_FOLDER],
      mimeType,
    };

    const token = await this.getToken();

    // Use multipart upload
    const boundary = '-------trackmind_boundary';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create file: ${error}`);
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Update an existing file's content
   */
  private async updateFile(fileId: string, content: string, mimeType = 'application/json'): Promise<void> {
    const token = await this.getToken();

    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
        },
        body: content,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Save complete export data to Drive
   */
  async saveExportData(data: ExportData, _message?: string): Promise<string> {
    const content = JSON.stringify(data, null, 2);

    // Find existing file or create new one
    let file = this.cachedFileIds.data
      ? { id: this.cachedFileIds.data }
      : await this.findFile(DATA_FILENAME);

    if (file) {
      await this.updateFile(file.id, content);
      this.cachedFileIds.data = file.id;
      return file.id;
    } else {
      const fileId = await this.createFile(DATA_FILENAME, content);
      this.cachedFileIds.data = fileId;
      return fileId;
    }
  }

  /**
   * Load export data from Drive
   */
  async loadExportData(): Promise<ExportData | null> {
    try {
      const file = this.cachedFileIds.data
        ? { id: this.cachedFileIds.data }
        : await this.findFile(DATA_FILENAME);

      if (!file) {
        return null;
      }

      this.cachedFileIds.data = file.id;
      const content = await this.getFileContent(file.id);
      return JSON.parse(content) as ExportData;
    } catch (error) {
      console.error('Failed to load export data:', error);
      return null;
    }
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    try {
      const file = this.cachedFileIds.metadata
        ? { id: this.cachedFileIds.metadata }
        : await this.findFile(METADATA_FILENAME);

      if (!file) {
        return null;
      }

      this.cachedFileIds.metadata = file.id;
      const content = await this.getFileContent(file.id);
      return JSON.parse(content) as SyncMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Save sync metadata
   */
  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const content = JSON.stringify(metadata, null, 2);

    let file = this.cachedFileIds.metadata
      ? { id: this.cachedFileIds.metadata }
      : await this.findFile(METADATA_FILENAME);

    if (file) {
      await this.updateFile(file.id, content);
    } else {
      const fileId = await this.createFile(METADATA_FILENAME, content);
      this.cachedFileIds.metadata = fileId;
    }
  }

  /**
   * Create or update weekly backup
   */
  async createBackupIfNeeded(data: ExportData): Promise<boolean> {
    const metadata = await this.getSyncMetadata();

    // Check if backup is needed (weekly)
    if (metadata?.lastBackupTime) {
      const lastBackup = new Date(metadata.lastBackupTime).getTime();
      const now = Date.now();
      if (now - lastBackup < BACKUP_INTERVAL_MS) {
        return false; // Backup not needed yet
      }
    }

    // Create or update backup
    const content = JSON.stringify(data, null, 2);

    let backupFile = this.cachedFileIds.backup
      ? { id: this.cachedFileIds.backup }
      : await this.findFile(BACKUP_FILENAME);

    if (backupFile) {
      await this.updateFile(backupFile.id, content);
    } else {
      const fileId = await this.createFile(BACKUP_FILENAME, content);
      this.cachedFileIds.backup = fileId;
      backupFile = { id: fileId };
    }

    // Update metadata with backup info
    const newMetadata: SyncMetadata = {
      ...(metadata || { lastSyncTime: new Date().toISOString(), deviceId: 'unknown', fileId: '' }),
      backupFileId: backupFile.id,
      lastBackupTime: new Date().toISOString(),
    };

    await this.saveSyncMetadata(newMetadata);

    console.log('Weekly backup created:', new Date().toISOString());
    return true;
  }

  /**
   * Load backup data (for recovery)
   */
  async loadBackupData(): Promise<ExportData | null> {
    try {
      const file = this.cachedFileIds.backup
        ? { id: this.cachedFileIds.backup }
        : await this.findFile(BACKUP_FILENAME);

      if (!file) {
        return null;
      }

      this.cachedFileIds.backup = file.id;
      const content = await this.getFileContent(file.id);
      return JSON.parse(content) as ExportData;
    } catch {
      return null;
    }
  }

  /**
   * Check for remote changes since last sync
   */
  async hasRemoteChanges(lastSyncTime: string): Promise<boolean> {
    const file = await this.findFile(DATA_FILENAME);
    if (!file) {
      return false;
    }

    const lastSync = new Date(lastSyncTime).getTime();
    const fileModified = new Date(file.modifiedTime).getTime();

    return fileModified > lastSync;
  }

  /**
   * Get the latest modified time for the data file
   */
  async getLatestModifiedTime(): Promise<string | null> {
    const file = await this.findFile(DATA_FILENAME);
    return file?.modifiedTime || null;
  }

  /**
   * List all TrackMind files in appDataFolder (for debugging)
   */
  async listFiles(): Promise<DriveFile[]> {
    const result = await this.request<{ files: DriveFile[] }>(
      `${DRIVE_API_BASE}/files?spaces=${APP_DATA_FOLDER}&fields=files(id,name,mimeType,modifiedTime,size)`
    );
    return result.files || [];
  }

  /**
   * Delete a file by ID (for cleanup)
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request(
      `${DRIVE_API_BASE}/files/${fileId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Clear all app data (for testing/reset)
   */
  async clearAllData(): Promise<void> {
    const files = await this.listFiles();
    for (const file of files) {
      await this.deleteFile(file.id);
    }
    this.cachedFileIds = {};
  }
}
