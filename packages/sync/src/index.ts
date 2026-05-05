// GitHub API
export {
  GitHubAPI,
  type GitHubConfig,
  type FileContent,
  type CommitInfo,
  type SyncMetadata,
} from './github/api';

// GitHub Auth
export {
  GitHubAuth,
  type OAuthConfig,
  type AuthState,
  type GitHubUser,
  type TokenResponse,
  parseCallbackParams,
  isOAuthCallback,
} from './github/auth';

// Google API
export {
  GoogleDriveAPI,
  type GoogleDriveConfig,
  type DriveFile,
  type SyncMetadata as GoogleSyncMetadata,
} from './google/api';

// Google Auth
export {
  GoogleAuth,
  type GoogleOAuthConfig,
  type GoogleAuthState,
  type GoogleUser,
  type GoogleTokenResponse,
  parseGoogleCallbackParams,
} from './google/auth';

// Provider Interface
export {
  type CloudStorageProvider,
  type SyncMetadataBase,
  type GitHubSyncMetadata,
  type GoogleDriveSyncMetadata,
  type UnifiedUser,
  type UnifiedAuthState,
} from './providers/interface';

// Sync Engine
export {
  SyncEngine,
  type SyncStatus,
  type SyncResult,
  type ConflictInfo,
  type ConflictResolutionStrategy,
  type SyncOptions,
  type SyncEngineConfig,
} from './engine/sync-engine';
