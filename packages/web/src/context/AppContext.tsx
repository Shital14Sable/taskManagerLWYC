import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { StorageAdapter, ExportData } from '@trackmind/storage';
import { createStorage } from '@trackmind/storage';
import {
  SyncEngine,
  GitHubAuth,
  GoogleAuth,
  GoogleDriveAPI,
  parseCallbackParams,
  parseGoogleCallbackParams,
  type SyncStatus,
  type SyncResult,
  type AuthState,
  type GoogleAuthState,
  type UnifiedAuthState,
} from '@trackmind/sync';
import type {
  Task,
  Project,
  Schedule,
  Goal,
  Note,
  TaskList,
  ListInstance,
  HabitInstance,
  JournalEntry,
  UserPreferences,
  UserStats,
} from '@trackmind/core';
import { createDefaultPreferences, createDefaultStats, toISODateString } from '@trackmind/core';
import { trackAuth, trackSessionStart, trackFeatureUse, setUserId } from '@/lib/analytics';

// Auth provider type
export type AuthProvider = 'github' | 'google' | null;

interface AppContextValue {
  // Storage
  storage: StorageAdapter | null;
  isInitialized: boolean;
  initError: string | null;

  // Auth
  authProvider: AuthProvider;
  authState: UnifiedAuthState | null;
  isGitHubAvailable: boolean;
  isGoogleAvailable: boolean;
  loginWithGitHub: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;

  // Sync
  syncEngine: SyncEngine | null;
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncWarning: string | null;
  dismissSyncWarning: () => void;
  sync: () => Promise<SyncResult | null>;
  forcePush: () => Promise<SyncResult | null>;
  forcePull: () => Promise<SyncResult | null>;

  // Data - Explicit Folders (separate for notes and journals)
  noteFolders: string[];
  addNoteFolder: (path: string) => void;
  deleteNoteFolder: (path: string) => void;
  journalFolders: string[];
  addJournalFolder: (path: string) => void;
  deleteJournalFolder: (path: string) => void;

  // Data - Tasks
  tasks: Task[];
  loadTasks: () => Promise<void>;
  saveTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Data - Projects
  projects: Project[];
  loadProjects: () => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Data - Schedules
  schedules: Map<string, Schedule>;
  loadSchedule: (date: string) => Promise<Schedule | null>;
  loadSchedules: (startDate: string, endDate: string) => Promise<void>;
  saveSchedule: (schedule: Schedule) => Promise<void>;
  saveSchedules: (schedules: Schedule[]) => Promise<void>;

  // Data - Goals
  goals: Goal[];
  loadGoals: () => Promise<void>;
  saveGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Data - Notes
  notes: Note[];
  loadNotes: () => Promise<void>;
  saveNote: (note: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Data - Lists
  lists: TaskList[];
  loadLists: () => Promise<void>;
  saveList: (list: TaskList) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // Data - List Instances
  listInstances: ListInstance[];
  loadListInstances: () => Promise<void>;
  saveListInstance: (instance: ListInstance) => Promise<void>;
  deleteListInstance: (id: string) => Promise<void>;

  // Data - Habit Instances
  getHabitInstance: (taskId: string, date: string) => Promise<HabitInstance | null>;
  getHabitInstances: (date: string) => Promise<HabitInstance[]>;
  getHabitInstancesByHabit: (habitId: string, startDate?: string, endDate?: string) => Promise<HabitInstance[]>;
  saveHabitInstance: (instance: HabitInstance) => Promise<void>;

  // Data - Journal Entries
  journalEntries: JournalEntry[];
  loadJournalEntries: () => Promise<void>;
  saveJournalEntry: (entry: JournalEntry) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  getJournalEntriesByDate: (date: string) => Promise<JournalEntry[]>;
  getJournalEntriesByDateRange: (startDate: string, endDate: string) => Promise<JournalEntry[]>;

  // Data - Preferences & Stats
  preferences: UserPreferences;
  loadPreferences: () => Promise<void>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  stats: UserStats;
  loadStats: () => Promise<void>;
  saveStats: (stats: UserStats) => Promise<void>;

  // Utility
  refreshAll: () => Promise<void>;

  // Import/Export
  exportData: () => Promise<ExportData | null>;
  importData: (data: ExportData) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function generateDeviceId(): string {
  const existing = localStorage.getItem('trackmind_device_id');
  if (existing) return existing;

  const id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('trackmind_device_id', id);
  return id;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Core state
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Auth state - support both providers
  const [githubAuth, setGithubAuth] = useState<GitHubAuth | null>(null);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuth | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider>(null);
  const [authState, setAuthState] = useState<UnifiedAuthState | null>(null);

  // Sync state
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const [googleDriveApi, setGoogleDriveApi] = useState<GoogleDriveAPI | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  // Debounced sync timer ref (30 seconds after last change)
  const debouncedSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [schedules, setSchedules] = useState<Map<string, Schedule>>(new Map());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [listInstances, setListInstances] = useState<ListInstance[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(createDefaultPreferences());
  const [stats, setStats] = useState<UserStats>(createDefaultStats());

  // Note folders (persisted to localStorage)
  const [noteFolders, setNoteFolders] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('trackmind_note_folders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Journal folders (persisted to localStorage)
  const [journalFolders, setJournalFolders] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('trackmind_journal_folders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist note folders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('trackmind_note_folders', JSON.stringify(noteFolders));
  }, [noteFolders]);

  // Persist journal folders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('trackmind_journal_folders', JSON.stringify(journalFolders));
  }, [journalFolders]);

  const addNoteFolder = useCallback((path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) return;
    setNoteFolders(prev => {
      if (prev.includes(normalizedPath)) return prev;
      return [...prev, normalizedPath].sort();
    });
  }, []);

  const deleteNoteFolder = useCallback((path: string) => {
    setNoteFolders(prev => prev.filter(f => f !== path && !f.startsWith(path + '/')));
  }, []);

  const addJournalFolder = useCallback((path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) return;
    setJournalFolders(prev => {
      if (prev.includes(normalizedPath)) return prev;
      return [...prev, normalizedPath].sort();
    });
  }, []);

  const deleteJournalFolder = useCallback((path: string) => {
    setJournalFolders(prev => prev.filter(f => f !== path && !f.startsWith(path + '/')));
  }, []);

  // Helper to create unified auth state
  const createUnifiedAuthState = (
    provider: 'github' | 'google',
    githubState?: AuthState | null,
    googleState?: GoogleAuthState | null
  ): UnifiedAuthState | null => {
    if (provider === 'github' && githubState?.isAuthenticated && githubState.user) {
      return {
        isAuthenticated: true,
        provider: 'github',
        user: {
          id: githubState.user.login,
          displayName: githubState.user.name,
          email: githubState.user.email,
          avatarUrl: githubState.user.avatarUrl,
          provider: 'github',
        },
        expiresAt: githubState.expiresAt,
      };
    }
    if (provider === 'google' && googleState?.isAuthenticated && googleState.user) {
      return {
        isAuthenticated: true,
        provider: 'google',
        user: {
          id: googleState.user.id,
          displayName: googleState.user.name,
          email: googleState.user.email,
          avatarUrl: googleState.user.avatarUrl,
          provider: 'google',
        },
        expiresAt: googleState.expiresAt,
      };
    }
    return null;
  };

  // Helper to setup GitHub sync engine
  const setupGitHubSync = async (storageInstance: StorageAdapter, token: string, login: string) => {
    console.log('[Sync] Setting up GitHub sync for user:', login);
    const engine = new SyncEngine(storageInstance, {
      token,
      owner: login,
      repo: 'trackmind-data',
      deviceId: generateDeviceId(),
    });
    setSyncEngine(engine);
    engine.onStatusChange((status) => {
      console.log('[Sync] Status changed:', status);
      setSyncStatus(status);
    });

    // Initialize the engine - this creates the repo if it doesn't exist
    try {
      console.log('[Sync] Initializing sync engine (will create repo if needed)...');
      await engine.initialize();
      console.log('[Sync] Sync engine initialized successfully');

      // Start auto-sync (every 5 minutes)
      engine.startAutoSync();
      console.log('[Sync] Auto-sync enabled (5 minute interval)');
    } catch (error) {
      console.error('[Sync] Failed to initialize sync engine:', error);
      // Show warning to user (non-blocking)
      const errorMessage = error instanceof Error ? error.message : 'Failed to set up sync';
      // Check if it's a credentials error
      if (errorMessage.toLowerCase().includes('bad credentials') || errorMessage.includes('401')) {
        setSyncWarning('Your GitHub session may have expired. Try signing out and signing back in.');
      } else {
        setSyncWarning(`Sync setup issue: ${errorMessage}. You can still use the app offline.`);
      }
    }
  };

  // Helper to setup Google Drive sync
  const setupGoogleDriveSync = (googleAuthInstance: GoogleAuth) => {
    const token = googleAuthInstance.getToken();
    if (!token) return;

    const driveApi = new GoogleDriveAPI({
      token,
      refreshToken: async () => {
        if (googleAuthInstance.needsRefresh()) {
          await googleAuthInstance.refreshAccessToken();
        }
        return googleAuthInstance.getToken() || token;
      },
    });
    setGoogleDriveApi(driveApi);
  };

  // Initialize storage and auth
  useEffect(() => {
    async function init() {
      try {
        const storageInstance = createStorage('indexeddb');
        await storageInstance.initialize();
        setStorage(storageInstance);

        // Initialize both auth providers if configured
        let githubAuthInstance: GitHubAuth | null = null;
        let googleAuthInstance: GoogleAuth | null = null;

        // Try GitHub auth
        try {
          const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
          if (githubClientId) {
            githubAuthInstance = GitHubAuth.createFromEnv();
            setGithubAuth(githubAuthInstance);
          }
        } catch (e) {
          console.warn('GitHub auth not configured:', e);
        }

        // Try Google auth
        try {
          const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          if (googleClientId) {
            googleAuthInstance = GoogleAuth.createFromEnv();
            setGoogleAuth(googleAuthInstance);
          }
        } catch (e) {
          console.warn('Google auth not configured:', e);
        }

        // Check for OAuth callbacks
        const url = window.location.href;

        // Check for Google callback first (has scope in URL)
        const googleParams = parseGoogleCallbackParams(url);
        if (googleParams && googleAuthInstance) {
          try {
            await googleAuthInstance.handleCallback(googleParams.code, googleParams.state);
            window.history.replaceState({}, '', window.location.pathname);

            // Set up Google Drive sync
            const googleUserState = googleAuthInstance.getAuthState();
            setAuthProvider('google');
            setAuthState(createUnifiedAuthState('google', null, googleUserState));
            setupGoogleDriveSync(googleAuthInstance);
            if (googleUserState.user?.id) {
              setUserId(googleUserState.user.id);
            }
            trackAuth('google');
          } catch (callbackError) {
            console.error('Google OAuth callback failed:', callbackError);
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
        // Check for GitHub callback
        else {
          const githubParams = parseCallbackParams(url);
          if (githubParams && githubAuthInstance) {
            console.log('[Auth] GitHub callback detected, processing...');
            try {
              await githubAuthInstance.handleCallback(githubParams.code, githubParams.state);
              console.log('[Auth] GitHub callback handled successfully');
              window.history.replaceState({}, '', window.location.pathname);

              // Set up GitHub sync
              const ghState = githubAuthInstance.getAuthState();
              console.log('[Auth] GitHub auth state:', ghState.isAuthenticated, ghState.user?.login);
              if (ghState.user) {
                setAuthProvider('github');
                setAuthState(createUnifiedAuthState('github', ghState, null));
                console.log('[Auth] Setting up GitHub sync...');
                await setupGitHubSync(storageInstance, ghState.token!, ghState.user.login);
                console.log('[Auth] GitHub sync setup complete');
                setUserId(ghState.user.login);
                trackAuth('github');
              }
            } catch (callbackError) {
              console.error('[Auth] GitHub OAuth callback failed:', callbackError);
              window.history.replaceState({}, '', window.location.pathname);
              // Show error to user
              const errorMessage = callbackError instanceof Error ? callbackError.message : 'Authentication failed';
              alert(`GitHub sign-in failed: ${errorMessage}\n\nPlease try again.`);
            }
          }
        }

        // If no callback, check for existing auth from storage
        if (!googleParams && !parseCallbackParams(url)) {
          console.log('[Auth] No callback params, checking stored auth...');
          console.log('[Auth] Google auth available:', !!googleAuthInstance, 'authenticated:', googleAuthInstance?.isAuthenticated());
          console.log('[Auth] GitHub auth available:', !!githubAuthInstance, 'authenticated:', githubAuthInstance?.isAuthenticated());

          // Check Google first
          if (googleAuthInstance?.isAuthenticated()) {
            console.log('[Auth] Restoring Google auth from storage');
            const googleUserState = googleAuthInstance.getAuthState();
            setAuthProvider('google');
            setAuthState(createUnifiedAuthState('google', null, googleUserState));
            setupGoogleDriveSync(googleAuthInstance);
            if (googleUserState.user?.id) {
              setUserId(googleUserState.user.id);
            }
            trackSessionStart('google');
          }
          // Then check GitHub
          else if (githubAuthInstance?.isAuthenticated()) {
            const ghState = githubAuthInstance.getAuthState();
            console.log('[Auth] Restoring GitHub auth from storage, user:', ghState.user?.login);
            if (ghState.user && ghState.token) {
              setAuthProvider('github');
              setAuthState(createUnifiedAuthState('github', ghState, null));
              await setupGitHubSync(storageInstance, ghState.token, ghState.user.login);
              console.log('[Auth] GitHub auth restored successfully');
              setUserId(ghState.user.login);
              trackSessionStart('github');
            }
          } else {
            console.log('[Auth] No stored auth found');
          }
        }

        // Load initial data
        const [
          loadedTasks,
          loadedProjects,
          loadedGoals,
          loadedNotes,
          loadedLists,
          loadedInstances,
          loadedJournalEntries,
          loadedPrefs,
          loadedStats,
          loadedLastSync,
        ] = await Promise.all([
          storageInstance.getTasks(),
          storageInstance.getProjects(),
          storageInstance.getGoals(),
          storageInstance.getNotes(),
          storageInstance.getLists(),
          storageInstance.getListInstances(),
          storageInstance.getJournalEntries(),
          storageInstance.getPreferences(),
          storageInstance.getStats(),
          storageInstance.getLastSyncTime(),
        ]);

        setTasks(loadedTasks);
        setProjects(loadedProjects);
        setGoals(loadedGoals);
        setNotes(loadedNotes);
        setLists(loadedLists);
        setListInstances(loadedInstances);
        setJournalEntries(loadedJournalEntries);
        setPreferences(loadedPrefs);
        setStats(loadedStats);
        setLastSyncTime(loadedLastSync);

        // Update pending changes count
        const changes = await storageInstance.getPendingChanges();
        setPendingChanges(changes.length);

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize storage:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    init();
  }, []);

  // Visibility change listener - sync when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // User returned to this tab - sync if needed
        if (authProvider === 'github' && syncEngine) {
          console.log('[Sync] Tab became visible - checking if sync needed');
          try {
            await syncEngine.syncIfNeeded();
          } catch (error) {
            console.error('[Sync] Visibility sync failed:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authProvider, syncEngine]);

  // Cleanup debounced sync timer on unmount
  useEffect(() => {
    return () => {
      if (debouncedSyncTimerRef.current) {
        clearTimeout(debouncedSyncTimerRef.current);
      }
    };
  }, []);

  // Auth handlers
  const loginWithGitHub = useCallback(() => {
    if (!githubAuth) {
      alert('GitHub sign-in is not configured. Please contact the administrator or use Google sign-in.');
      return;
    }
    githubAuth.startOAuthFlow();
  }, [githubAuth]);

  const loginWithGoogle = useCallback(async () => {
    if (!googleAuth) {
      alert('Google sign-in is not configured. Please contact the administrator or use GitHub sign-in.');
      return;
    }
    await googleAuth.startOAuthFlow();
  }, [googleAuth]);

  const logout = useCallback(() => {
    // Logout from current provider
    if (authProvider === 'github') {
      githubAuth?.logout();
    } else if (authProvider === 'google') {
      googleAuth?.logout();
    }
    setAuthState(null);
    setAuthProvider(null);
    setSyncEngine(null);
    setGoogleDriveApi(null);
    setSyncStatus('idle');
  }, [authProvider, githubAuth, googleAuth]);

  // Debounced sync - triggers 30 seconds after last change
  // This batches multiple rapid changes into a single sync
  const triggerDebouncedSync = useCallback(() => {
    // Only trigger for GitHub sync (has syncIfNeeded method)
    if (authProvider !== 'github' || !syncEngine) {
      return;
    }

    // Clear any existing timer
    if (debouncedSyncTimerRef.current) {
      clearTimeout(debouncedSyncTimerRef.current);
    }

    // Set new timer for 30 seconds
    debouncedSyncTimerRef.current = setTimeout(async () => {
      console.log('[Sync] Debounced sync triggered after 30s of inactivity');
      try {
        await syncEngine.syncIfNeeded();
      } catch (error) {
        console.error('[Sync] Debounced sync failed:', error);
      }
    }, 30 * 1000); // 30 seconds
  }, [authProvider, syncEngine]);

  // Sync handlers - supports both GitHub (via SyncEngine) and Google Drive (direct API)
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!storage) return null;

    // GitHub sync uses SyncEngine
    if (authProvider === 'github' && syncEngine) {
      const result = await syncEngine.sync();
      if (result.success) {
        setLastSyncTime(new Date());
        setPendingChanges(0);
        await refreshAll();
        trackFeatureUse('sync_manual');
      }
      return result;
    }

    // Google Drive sync uses direct API
    if (authProvider === 'google' && googleDriveApi) {
      try {
        setSyncStatus('syncing');
        const localData = await storage.exportAll();

        // Try to load remote data first
        const remoteData = await googleDriveApi.loadExportData();

        if (!remoteData) {
          // No remote data - initial push
          await googleDriveApi.saveExportData(localData, 'Initial sync');
        } else {
          // For now, do a simple sync - local wins, but merge in any new remote items
          // In a production app, you'd want proper conflict resolution
          await googleDriveApi.saveExportData(localData, 'Sync from device');
        }

        // Create weekly backup if needed
        await googleDriveApi.createBackupIfNeeded(localData);

        // Update metadata
        await googleDriveApi.saveSyncMetadata({
          lastSyncTime: new Date().toISOString(),
          deviceId: generateDeviceId(),
          fileId: '', // Will be populated by the API
        });

        setLastSyncTime(new Date());
        setPendingChanges(0);
        setSyncStatus('idle');
        trackFeatureUse('sync_manual');

        return {
          success: true,
          status: 'idle',
          message: 'Synced to Google Drive',
          syncedAt: new Date(),
        };
      } catch (error) {
        console.error('Google Drive sync failed:', error);
        setSyncStatus('error');
        return {
          success: false,
          status: 'error',
          message: error instanceof Error ? error.message : 'Sync failed',
        };
      }
    }

    return null;
  }, [authProvider, syncEngine, googleDriveApi, storage]);

  const forcePush = useCallback(async (): Promise<SyncResult | null> => {
    if (authProvider === 'github' && syncEngine) {
      return syncEngine.sync({ forceDirection: 'push' });
    }
    // For Google Drive, sync is already a push
    return sync();
  }, [authProvider, syncEngine, sync]);

  const forcePull = useCallback(async (): Promise<SyncResult | null> => {
    if (!storage) return null;

    if (authProvider === 'github' && syncEngine) {
      const result = await syncEngine.sync({ forceDirection: 'pull' });
      if (result.success) {
        await refreshAll();
      }
      return result;
    }

    if (authProvider === 'google' && googleDriveApi) {
      try {
        setSyncStatus('syncing');
        const remoteData = await googleDriveApi.loadExportData();

        if (!remoteData) {
          setSyncStatus('error');
          return {
            success: false,
            status: 'error',
            message: 'No remote data to pull',
          };
        }

        await storage.importAll(remoteData);
        await refreshAll();
        setLastSyncTime(new Date());
        setSyncStatus('idle');

        return {
          success: true,
          status: 'idle',
          message: 'Pulled from Google Drive',
          syncedAt: new Date(),
        };
      } catch (error) {
        console.error('Google Drive pull failed:', error);
        setSyncStatus('error');
        return {
          success: false,
          status: 'error',
          message: error instanceof Error ? error.message : 'Pull failed',
        };
      }
    }

    return null;
  }, [authProvider, syncEngine, googleDriveApi, storage]);

  // Task handlers
  const loadTasks = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getTasks();
    setTasks(loaded);
  }, [storage]);

  const saveTask = useCallback(async (task: Task) => {
    if (!storage) return;

    // Check if this is a new task (for analytics)
    const isNew = !tasks.some(t => t.id === task.id);

    await storage.saveTask(task);
    setTasks(prev => {
      const existing = prev.findIndex(t => t.id === task.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = task;
        return updated;
      }
      return [...prev, task];
    });
    const changes = await storage.getPendingChanges();
    setPendingChanges(changes.length);
    triggerDebouncedSync();

    // Track analytics for new tasks only (not habits - habits are tracked separately)
    if (isNew && !task.is_habit) {
      trackFeatureUse('task_create');
    }
  }, [storage, tasks, triggerDebouncedSync]);

  const deleteTask = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    const changes = await storage.getPendingChanges();
    setPendingChanges(changes.length);
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Project handlers
  const loadProjects = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getProjects();
    setProjects(loaded);
  }, [storage]);

  const saveProject = useCallback(async (project: Project) => {
    if (!storage) return;
    const isNew = !projects.some(p => p.id === project.id);
    await storage.saveProject(project);
    setProjects(prev => {
      const existing = prev.findIndex(p => p.id === project.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = project;
        return updated;
      }
      return [...prev, project];
    });
    triggerDebouncedSync();
    if (isNew) {
      trackFeatureUse('project_create');
    }
  }, [storage, projects, triggerDebouncedSync]);

  const deleteProject = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Schedule handlers
  const loadSchedule = useCallback(async (date: string): Promise<Schedule | null> => {
    if (!storage) return null;
    const schedule = await storage.getSchedule(date);
    if (schedule) {
      setSchedules(prev => new Map(prev).set(date, schedule));
    }
    return schedule;
  }, [storage]);

  const loadSchedules = useCallback(async (startDate: string, endDate: string) => {
    if (!storage) return;
    const loaded = await storage.getSchedules(startDate, endDate);
    setSchedules(prev => {
      const updated = new Map(prev);
      for (const schedule of loaded) {
        updated.set(schedule.date, schedule);
      }
      return updated;
    });
  }, [storage]);

  const saveSchedule = useCallback(async (schedule: Schedule) => {
    if (!storage) return;
    await storage.saveSchedule(schedule);
    setSchedules(prev => new Map(prev).set(schedule.date, schedule));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  const saveSchedules = useCallback(async (scheduleList: Schedule[]) => {
    if (!storage) return;
    await storage.saveSchedules(scheduleList);
    setSchedules(prev => {
      const updated = new Map(prev);
      for (const schedule of scheduleList) {
        updated.set(schedule.date, schedule);
      }
      return updated;
    });
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Goal handlers
  const loadGoals = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getGoals();
    setGoals(loaded);
  }, [storage]);

  const saveGoal = useCallback(async (goal: Goal) => {
    if (!storage) return;
    const isNew = !goals.some(g => g.id === goal.id);
    await storage.saveGoal(goal);
    setGoals(prev => {
      const existing = prev.findIndex(g => g.id === goal.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = goal;
        return updated;
      }
      return [...prev, goal];
    });
    triggerDebouncedSync();
    if (isNew) {
      trackFeatureUse('goal_create');
    }
  }, [storage, goals, triggerDebouncedSync]);

  const deleteGoal = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteGoal(id);
    setGoals(prev => prev.filter(g => g.id !== id));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Note handlers
  const loadNotes = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getNotes();
    setNotes(loaded);
  }, [storage]);

  const saveNote = useCallback(async (note: Note) => {
    if (!storage) return;
    const isNew = !notes.some(n => n.id === note.id);
    await storage.saveNote(note);
    setNotes(prev => {
      const existing = prev.findIndex(n => n.id === note.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = note;
        return updated;
      }
      return [...prev, note];
    });
    triggerDebouncedSync();
    if (isNew) {
      trackFeatureUse('note_create');
    }
  }, [storage, notes, triggerDebouncedSync]);

  const deleteNote = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // List handlers
  const loadLists = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getLists();
    setLists(loaded);
  }, [storage]);

  const saveList = useCallback(async (list: TaskList) => {
    if (!storage) return;
    const isNew = !lists.some(l => l.id === list.id);
    await storage.saveList(list);
    setLists(prev => {
      const existing = prev.findIndex(l => l.id === list.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = list;
        return updated;
      }
      return [...prev, list];
    });
    triggerDebouncedSync();
    if (isNew) {
      trackFeatureUse('list_create');
    }
  }, [storage, lists, triggerDebouncedSync]);

  const deleteList = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteList(id);
    setLists(prev => prev.filter(l => l.id !== id));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // List Instance handlers
  const loadListInstances = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getListInstances();
    setListInstances(loaded);
  }, [storage]);

  const saveListInstance = useCallback(async (instance: ListInstance) => {
    if (!storage) return;
    await storage.saveListInstance(instance);
    setListInstances(prev => {
      const existing = prev.findIndex(i => i.id === instance.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = instance;
        return updated;
      }
      return [...prev, instance];
    });
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  const deleteListInstance = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteListInstance(id);
    setListInstances(prev => prev.filter(i => i.id !== id));
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Habit Instance handlers
  const getHabitInstance = useCallback(async (taskId: string, date: string): Promise<HabitInstance | null> => {
    if (!storage) return null;
    return storage.getHabitInstance(taskId, date);
  }, [storage]);

  const getHabitInstances = useCallback(async (date: string): Promise<HabitInstance[]> => {
    if (!storage) return [];
    return storage.getHabitInstances(date);
  }, [storage]);

  const getHabitInstancesByHabit = useCallback(async (habitId: string, startDate?: string, endDate?: string): Promise<HabitInstance[]> => {
    if (!storage) return [];
    return storage.getHabitInstancesByHabit(habitId, startDate, endDate);
  }, [storage]);

  const saveHabitInstance = useCallback(async (instance: HabitInstance) => {
    if (!storage) return;
    await storage.saveHabitInstance(instance);
    triggerDebouncedSync();
    // Track habit completion when instance is marked as completed
    if (instance.completed_at) {
      trackFeatureUse('habit_complete');
    }
  }, [storage, triggerDebouncedSync]);

  // Journal Entry handlers
  const loadJournalEntries = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getJournalEntries();
    setJournalEntries(loaded);
  }, [storage]);

  const saveJournalEntry = useCallback(async (entry: JournalEntry) => {
    if (!storage) return;
    const isNew = !journalEntries.some(e => e.id === entry.id);
    await storage.saveJournalEntry(entry);
    setJournalEntries(prev => {
      const existing = prev.findIndex(e => e.id === entry.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [...prev, entry];
    });
    const changes = await storage.getPendingChanges();
    setPendingChanges(changes.length);
    triggerDebouncedSync();
    if (isNew) {
      trackFeatureUse('journal_entry');
    }
  }, [storage, journalEntries, triggerDebouncedSync]);

  const deleteJournalEntry = useCallback(async (id: string) => {
    if (!storage) return;
    await storage.deleteJournalEntry(id);
    setJournalEntries(prev => prev.filter(e => e.id !== id));
    const changes = await storage.getPendingChanges();
    setPendingChanges(changes.length);
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  const getJournalEntriesByDate = useCallback(async (date: string): Promise<JournalEntry[]> => {
    if (!storage) return [];
    return storage.getJournalEntriesByDate(date);
  }, [storage]);

  const getJournalEntriesByDateRange = useCallback(async (startDate: string, endDate: string): Promise<JournalEntry[]> => {
    if (!storage) return [];
    return storage.getJournalEntriesByDateRange(startDate, endDate);
  }, [storage]);

  // Preferences & Stats handlers
  const loadPreferences = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getPreferences();
    setPreferences(loaded);
  }, [storage]);

  const savePreferences = useCallback(async (prefs: UserPreferences) => {
    if (!storage) return;
    await storage.savePreferences(prefs);
    setPreferences(prefs);
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  const loadStats = useCallback(async () => {
    if (!storage) return;
    const loaded = await storage.getStats();
    setStats(loaded);
  }, [storage]);

  const saveStats = useCallback(async (newStats: UserStats) => {
    if (!storage) return;
    await storage.saveStats(newStats);
    setStats(newStats);
    triggerDebouncedSync();
  }, [storage, triggerDebouncedSync]);

  // Refresh all data including recent schedules
  const refreshAll = useCallback(async () => {
    // Calculate date range for schedules: 30 days past to 7 days future
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    await Promise.all([
      loadTasks(),
      loadProjects(),
      loadSchedules(toISODateString(startDate), toISODateString(endDate)),
      loadGoals(),
      loadNotes(),
      loadLists(),
      loadListInstances(),
      loadJournalEntries(),
      loadPreferences(),
      loadStats(),
    ]);
  }, [loadTasks, loadProjects, loadSchedules, loadGoals, loadNotes, loadLists, loadListInstances, loadJournalEntries, loadPreferences, loadStats]);

  // Export all data
  const exportData = useCallback(async (): Promise<ExportData | null> => {
    if (!storage) return null;
    return storage.exportAll();
  }, [storage]);

  // Import data (merges with existing)
  const importData = useCallback(async (data: ExportData) => {
    if (!storage) return;
    await storage.importAll(data);
    await refreshAll();
  }, [storage, refreshAll]);

  // Clear all data
  const clearAllData = useCallback(async () => {
    if (!storage) return;
    await storage.clearAll();
    setTasks([]);
    setProjects([]);
    setSchedules(new Map());
    setGoals([]);
    setNotes([]);
    setLists([]);
    setListInstances([]);
    setJournalEntries([]);
    setPreferences(createDefaultPreferences());
    setStats(createDefaultStats());
    setPendingChanges(0);
  }, [storage]);

  const value: AppContextValue = {
    storage,
    isInitialized,
    initError,
    authProvider,
    authState,
    isGitHubAvailable: !!githubAuth,
    isGoogleAvailable: !!googleAuth,
    loginWithGitHub,
    loginWithGoogle,
    logout,
    syncEngine,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    syncWarning,
    dismissSyncWarning: () => setSyncWarning(null),
    sync,
    forcePush,
    forcePull,
    noteFolders,
    addNoteFolder,
    deleteNoteFolder,
    journalFolders,
    addJournalFolder,
    deleteJournalFolder,
    tasks,
    loadTasks,
    saveTask,
    deleteTask,
    projects,
    loadProjects,
    saveProject,
    deleteProject,
    schedules,
    loadSchedule,
    loadSchedules,
    saveSchedule,
    saveSchedules,
    goals,
    loadGoals,
    saveGoal,
    deleteGoal,
    notes,
    loadNotes,
    saveNote,
    deleteNote,
    lists,
    loadLists,
    saveList,
    deleteList,
    listInstances,
    loadListInstances,
    saveListInstance,
    deleteListInstance,
    getHabitInstance,
    getHabitInstances,
    getHabitInstancesByHabit,
    saveHabitInstance,
    journalEntries,
    loadJournalEntries,
    saveJournalEntry,
    deleteJournalEntry,
    getJournalEntriesByDate,
    getJournalEntriesByDateRange,
    preferences,
    loadPreferences,
    savePreferences,
    stats,
    loadStats,
    saveStats,
    refreshAll,
    exportData,
    importData,
    clearAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
