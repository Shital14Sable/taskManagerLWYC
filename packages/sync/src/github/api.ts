import { Octokit } from 'octokit';
import type { ExportData, TombstoneData } from '@trackmind/storage';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  dataPath?: string;
}

/**
 * Multi-file data structure for scalable sync
 * Splits data into separate files to prevent single file from growing too large
 */
export interface MultiFileData {
  // Core data - frequently accessed, typically small
  core: {
    version: string;
    exportedAt: string;
    tasks: ExportData['tasks'];
    projects: ExportData['projects'];
    goals: ExportData['goals'];
    lists: ExportData['lists'];
    preferences: ExportData['preferences'];
    stats: ExportData['stats'];
  };
  // Schedules - date-bounded, can grow but old ones can be archived
  schedules: {
    version: string;
    exportedAt: string;
    schedules: ExportData['schedules'];
  };
  // Notes - can grow large with content
  notes: {
    version: string;
    exportedAt: string;
    notes: ExportData['notes'];
  };
  // Instances - habit and list tracking data
  instances: {
    version: string;
    exportedAt: string;
    listInstances: ExportData['listInstances'];
    habitInstances: ExportData['habitInstances'];
  };
  // Journal entries and mood check-ins - can grow large with mood tracking and prompts
  journal: {
    version: string;
    exportedAt: string;
    journalEntries: ExportData['journalEntries'];
    moodCheckIns: ExportData['moodCheckIns'];
  };
  // Tombstones - deletion records for cross-device sync
  tombstones: TombstoneData;
}

export interface FileContent {
  content: string;
  sha: string;
  encoding: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface SyncMetadata {
  lastSyncSha: string;
  lastSyncTime: string;
  deviceId: string;
}

const DEFAULT_BRANCH = 'main';
const DEFAULT_DATA_PATH = ''; // Store at repo root

// Browser-compatible base64 encoding (handles UTF-8)
function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Browser-compatible base64 decoding (handles UTF-8)
function decodeBase64(base64: string): string {
  return decodeURIComponent(escape(atob(base64)));
}

// Helper to build file path (handles empty dataPath)
function buildPath(dataPath: string, filePath: string): string {
  return dataPath ? `${dataPath}/${filePath}` : filePath;
}

/**
 * GitHub API service for data synchronization
 */
export class GitHubAPI {
  private octokit: Octokit;
  private config: Required<GitHubConfig>;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.config = {
      ...config,
      branch: config.branch ?? DEFAULT_BRANCH,
      dataPath: config.dataPath ?? DEFAULT_DATA_PATH,
    };
  }

  /**
   * Get the authenticated user's information
   */
  async getUser(): Promise<{ login: string; name: string | null; avatar_url: string }> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return {
      login: data.login,
      name: data.name,
      avatar_url: data.avatar_url,
    };
  }

  /**
   * Check if repository exists and is accessible
   */
  async checkRepository(): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create the repository if it doesn't exist
   */
  async createRepository(isPrivate = true): Promise<void> {
    const user = await this.getUser();

    if (this.config.owner === user.login) {
      // Create user repository
      await this.octokit.rest.repos.createForAuthenticatedUser({
        name: this.config.repo,
        private: isPrivate,
        description: 'TrackMind data storage',
        auto_init: true,
      });
    } else {
      // Create org repository (requires org permissions)
      await this.octokit.rest.repos.createInOrg({
        org: this.config.owner,
        name: this.config.repo,
        private: isPrivate,
        description: 'TrackMind data storage',
        auto_init: true,
      });
    }
  }

  /**
   * Get file content from repository
   */
  async getFile(path: string): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: buildPath(this.config.dataPath, path),
        ref: this.config.branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return {
        content: data.content,
        sha: data.sha,
        encoding: data.encoding,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file in the repository
   */
  async putFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string; commitSha: string }> {
    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path: buildPath(this.config.dataPath, path),
      message,
      content: encodeBase64(content),
      sha,
      branch: this.config.branch,
    });

    return {
      sha: data.content?.sha ?? '',
      commitSha: data.commit.sha ?? '',
    };
  }

  /**
   * Delete a file from the repository
   */
  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    await this.octokit.rest.repos.deleteFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path: buildPath(this.config.dataPath, path),
      message,
      sha,
      branch: this.config.branch,
    });
  }

  /**
   * Get all files in the data directory
   */
  async listFiles(): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: this.config.dataPath || '.',
        ref: this.config.branch,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .filter((item) => item.type === 'file')
        .map((item) => item.name);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get recent commits for the data directory
   */
  async getRecentCommits(limit = 10): Promise<CommitInfo[]> {
    const { data } = await this.octokit.rest.repos.listCommits({
      owner: this.config.owner,
      repo: this.config.repo,
      sha: this.config.branch,
      path: this.config.dataPath || undefined, // undefined = all commits
      per_page: limit,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name ?? 'Unknown',
      date: commit.commit.author?.date ?? '',
    }));
  }

  /**
   * Save complete export data to repository
   */
  async saveExportData(data: ExportData, message?: string): Promise<string> {
    const content = JSON.stringify(data, null, 2);
    const path = 'data.json';

    // Check if file exists to get SHA
    const existing = await this.getFile(path);

    const result = await this.putFile(
      path,
      content,
      message ?? `Sync: ${new Date().toISOString()}`,
      existing?.sha
    );

    return result.commitSha;
  }

  /**
   * Load export data from repository
   */
  async loadExportData(): Promise<ExportData | null> {
    const file = await this.getFile('data.json');

    if (!file) {
      return null;
    }

    const content = decodeBase64(file.content);
    return JSON.parse(content) as ExportData;
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const file = await this.getFile('sync-metadata.json');

    if (!file) {
      return null;
    }

    const content = decodeBase64(file.content);
    return JSON.parse(content) as SyncMetadata;
  }

  /**
   * Save sync metadata
   */
  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const existing = await this.getFile('sync-metadata.json');

    await this.putFile(
      'sync-metadata.json',
      JSON.stringify(metadata, null, 2),
      'Update sync metadata',
      existing?.sha
    );
  }

  /**
   * Check for remote changes since last sync
   */
  async hasRemoteChanges(lastSyncSha: string): Promise<boolean> {
    const commits = await this.getRecentCommits(1);

    if (commits.length === 0) {
      return false;
    }

    return commits[0].sha !== lastSyncSha;
  }

  /**
   * Get the latest commit SHA for the data directory
   */
  async getLatestCommitSha(): Promise<string | null> {
    const commits = await this.getRecentCommits(1);
    return commits.length > 0 ? commits[0].sha : null;
  }

  // ============================================
  // Multi-file sync methods for scalable storage
  // ============================================

  /**
   * Check if repository uses multi-file format
   */
  async isMultiFileFormat(): Promise<boolean> {
    const coreFile = await this.getFile('core.json');
    return coreFile !== null;
  }

  /**
   * Convert ExportData to MultiFileData structure
   */
  private exportToMultiFile(data: ExportData): MultiFileData {
    const now = new Date().toISOString();
    return {
      core: {
        version: data.version,
        exportedAt: now,
        tasks: data.tasks,
        projects: data.projects,
        goals: data.goals,
        lists: data.lists,
        preferences: data.preferences,
        stats: data.stats,
      },
      schedules: {
        version: data.version,
        exportedAt: now,
        schedules: data.schedules,
      },
      notes: {
        version: data.version,
        exportedAt: now,
        notes: data.notes,
      },
      instances: {
        version: data.version,
        exportedAt: now,
        listInstances: data.listInstances,
        habitInstances: data.habitInstances,
      },
      journal: {
        version: data.version,
        exportedAt: now,
        journalEntries: data.journalEntries || [],
        moodCheckIns: data.moodCheckIns || [],
      },
      tombstones: data.tombstones || { tombstones: [] },
    };
  }

  /**
   * Convert MultiFileData back to ExportData
   */
  private multiFileToExport(multi: MultiFileData): ExportData {
    return {
      version: multi.core.version,
      exportedAt: multi.core.exportedAt,
      tasks: multi.core.tasks,
      projects: multi.core.projects,
      goals: multi.core.goals,
      lists: multi.core.lists,
      preferences: multi.core.preferences,
      stats: multi.core.stats,
      schedules: multi.schedules.schedules,
      notes: multi.notes.notes,
      listInstances: multi.instances.listInstances,
      habitInstances: multi.instances.habitInstances,
      journalEntries: multi.journal?.journalEntries || [],
      moodCheckIns: multi.journal?.moodCheckIns || [],
      tombstones: multi.tombstones,
    };
  }

  /**
   * Save export data using multi-file format
   * Splits data into separate files to prevent single file from growing too large
   */
  async saveExportDataMultiFile(data: ExportData, message?: string): Promise<string> {
    const multi = this.exportToMultiFile(data);
    const commitMessage = message ?? `Sync: ${new Date().toISOString()}`;

    // Get existing file SHAs in parallel
    const [coreFile, schedulesFile, notesFile, instancesFile, journalFile, tombstonesFile] = await Promise.all([
      this.getFile('core.json'),
      this.getFile('schedules.json'),
      this.getFile('notes.json'),
      this.getFile('instances.json'),
      this.getFile('journal.json'),
      this.getFile('tombstones.json'),
    ]);

    // Save all files (we need to do this sequentially to avoid commit conflicts)
    // Each putFile creates a commit, so we'll batch the message
    await this.putFile(
      'core.json',
      JSON.stringify(multi.core, null, 2),
      `${commitMessage} - core`,
      coreFile?.sha
    );

    await this.putFile(
      'schedules.json',
      JSON.stringify(multi.schedules, null, 2),
      `${commitMessage} - schedules`,
      schedulesFile?.sha
    );

    await this.putFile(
      'notes.json',
      JSON.stringify(multi.notes, null, 2),
      `${commitMessage} - notes`,
      notesFile?.sha
    );

    await this.putFile(
      'instances.json',
      JSON.stringify(multi.instances, null, 2),
      `${commitMessage} - instances`,
      instancesFile?.sha
    );

    await this.putFile(
      'journal.json',
      JSON.stringify(multi.journal, null, 2),
      `${commitMessage} - journal`,
      journalFile?.sha
    );

    const result = await this.putFile(
      'tombstones.json',
      JSON.stringify(multi.tombstones, null, 2),
      `${commitMessage} - tombstones`,
      tombstonesFile?.sha
    );

    return result.commitSha;
  }

  /**
   * Load export data from multi-file format
   */
  async loadExportDataMultiFile(): Promise<ExportData | null> {
    // Load all files in parallel
    const [coreFile, schedulesFile, notesFile, instancesFile, journalFile, tombstonesFile] = await Promise.all([
      this.getFile('core.json'),
      this.getFile('schedules.json'),
      this.getFile('notes.json'),
      this.getFile('instances.json'),
      this.getFile('journal.json'),
      this.getFile('tombstones.json'),
    ]);

    // If core doesn't exist, no multi-file data
    if (!coreFile) {
      return null;
    }

    const multi: MultiFileData = {
      core: JSON.parse(decodeBase64(coreFile.content)),
      schedules: schedulesFile
        ? JSON.parse(decodeBase64(schedulesFile.content))
        : { version: '1.0.0', exportedAt: '', schedules: [] },
      notes: notesFile
        ? JSON.parse(decodeBase64(notesFile.content))
        : { version: '1.0.0', exportedAt: '', notes: [] },
      instances: instancesFile
        ? JSON.parse(decodeBase64(instancesFile.content))
        : { version: '1.0.0', exportedAt: '', listInstances: [], habitInstances: [] },
      journal: journalFile
        ? JSON.parse(decodeBase64(journalFile.content))
        : { version: '1.0.0', exportedAt: '', journalEntries: [], moodCheckIns: [] },
      tombstones: tombstonesFile
        ? JSON.parse(decodeBase64(tombstonesFile.content))
        : { tombstones: [] },
    };

    return this.multiFileToExport(multi);
  }

  /**
   * Migrate from single-file (data.json) to multi-file format
   * This preserves the old data.json as a backup
   */
  async migrateToMultiFile(): Promise<boolean> {
    // Load existing single-file data
    const singleFileData = await this.loadExportData();
    if (!singleFileData) {
      console.log('[GitHubAPI] No single-file data to migrate');
      return false;
    }

    // Save in multi-file format
    await this.saveExportDataMultiFile(singleFileData, 'Migrate to multi-file format');

    // Rename old data.json to data.json.backup (optional - keep for safety)
    // We'll leave data.json in place for now as a backup

    console.log('[GitHubAPI] Successfully migrated to multi-file format');
    return true;
  }

  /**
   * Smart load - tries multi-file first, falls back to single-file
   */
  async loadExportDataSmart(): Promise<ExportData | null> {
    // Check for multi-file format first
    const isMultiFile = await this.isMultiFileFormat();

    if (isMultiFile) {
      return this.loadExportDataMultiFile();
    }

    // Fall back to single-file format
    return this.loadExportData();
  }

  /**
   * Smart save - uses multi-file format, auto-migrates if needed
   */
  async saveExportDataSmart(data: ExportData, message?: string): Promise<string> {
    // Check current format
    const isMultiFile = await this.isMultiFileFormat();

    if (!isMultiFile) {
      // Check if single-file exists (needs migration)
      const singleFile = await this.getFile('data.json');
      if (singleFile) {
        console.log('[GitHubAPI] Migrating from single-file to multi-file format');
      }
    }

    // Always save in multi-file format going forward
    return this.saveExportDataMultiFile(data, message);
  }
}
