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
  MoodCheckIn,
  UserPreferences,
  UserStats,
} from '@trackmind/core';

/**
 * A pending change to be synced
 */
export interface PendingChange {
  id: string;
  type: EntityType;
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Entity types that can be synced
 */
export type EntityType = 'task' | 'project' | 'schedule' | 'goal' | 'note' | 'list' | 'list_instance' | 'habit_instance' | 'journal' | 'mood_checkin' | 'preferences' | 'stats';

/**
 * A tombstone record for deleted entities
 * Used to propagate deletions across devices
 */
export interface Tombstone {
  id: string;
  entityType: EntityType;
  entityId: string;
  deletedAt: string;
}

/**
 * Tombstones grouped by entity type for sync
 */
export interface TombstoneData {
  tombstones: Tombstone[];
  cleanedUpBefore?: string; // ISO date - tombstones older than this have been cleaned up
}

/**
 * Export data structure for backup/sync
 */
export interface ExportData {
  version: string;
  exportedAt: string;
  tasks: Task[];
  projects: Project[];
  schedules: Schedule[];
  goals: Goal[];
  notes: Note[];
  lists: TaskList[];
  listInstances: ListInstance[];
  habitInstances: HabitInstance[];
  journalEntries?: JournalEntry[]; // Optional for backwards compatibility with old sync data
  moodCheckIns?: MoodCheckIn[]; // Optional for backwards compatibility
  preferences: UserPreferences;
  stats: UserStats;
  tombstones?: TombstoneData; // Deletion records for cross-device sync
}

/**
 * Abstract storage interface that can be implemented by:
 * - IndexedDB (web)
 * - SQLite (mobile via Capacitor)
 * - Memory (testing)
 */
export interface StorageAdapter {
  // Initialization
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Tasks
  getTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksByStatus(status: string): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  saveTasks(tasks: Task[]): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Schedules
  getSchedule(date: string): Promise<Schedule | null>;
  getSchedules(startDate: string, endDate: string): Promise<Schedule[]>;
  saveSchedule(schedule: Schedule): Promise<void>;
  saveSchedules(schedules: Schedule[]): Promise<void>;
  deleteSchedule(date: string): Promise<void>;

  // Goals
  getGoals(): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | null>;
  saveGoal(goal: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  // Notes
  getNotes(): Promise<Note[]>;
  getNote(id: string): Promise<Note | null>;
  getNotesByFolder(folder: string): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;

  // Lists
  getLists(): Promise<TaskList[]>;
  getList(id: string): Promise<TaskList | null>;
  saveList(list: TaskList): Promise<void>;
  deleteList(id: string): Promise<void>;

  // List Instances
  getListInstances(): Promise<ListInstance[]>;
  getListInstance(id: string): Promise<ListInstance | null>;
  saveListInstance(instance: ListInstance): Promise<void>;
  deleteListInstance(id: string): Promise<void>;

  // Habit Instances
  getHabitInstance(taskId: string, date: string): Promise<HabitInstance | null>;
  getHabitInstances(date: string): Promise<HabitInstance[]>;
  getHabitInstancesByHabit(habitId: string, startDate?: string, endDate?: string): Promise<HabitInstance[]>;
  saveHabitInstance(instance: HabitInstance): Promise<void>;
  deleteHabitInstance(habitId: string, date: string): Promise<void>;

  // Journal Entries
  getJournalEntries(): Promise<JournalEntry[]>;
  getJournalEntry(id: string): Promise<JournalEntry | null>;
  getJournalEntriesByDate(date: string): Promise<JournalEntry[]>;
  getJournalEntriesByDateRange(startDate: string, endDate: string): Promise<JournalEntry[]>;
  saveJournalEntry(entry: JournalEntry): Promise<void>;
  deleteJournalEntry(id: string): Promise<void>;

  // Mood Check-ins
  getMoodCheckIns(): Promise<MoodCheckIn[]>;
  getMoodCheckIn(id: string): Promise<MoodCheckIn | null>;
  getMoodCheckInsByDate(date: string): Promise<MoodCheckIn[]>;
  getMoodCheckInsByDateRange(startDate: string, endDate: string): Promise<MoodCheckIn[]>;
  saveMoodCheckIn(moodCheckIn: MoodCheckIn): Promise<void>;
  deleteMoodCheckIn(id: string): Promise<void>;

  // Preferences
  getPreferences(): Promise<UserPreferences>;
  savePreferences(preferences: UserPreferences): Promise<void>;

  // Stats (Gamification)
  getStats(): Promise<UserStats>;
  saveStats(stats: UserStats): Promise<void>;

  // Sync Metadata
  getLastSyncTime(): Promise<Date | null>;
  setLastSyncTime(time: Date): Promise<void>;
  getPendingChanges(): Promise<PendingChange[]>;
  addPendingChange(change: PendingChange): Promise<void>;
  clearPendingChanges(changeIds: string[]): Promise<void>;

  // Tombstone Management (for deletion sync)
  getTombstones(): Promise<Tombstone[]>;
  addTombstone(tombstone: Tombstone): Promise<void>;
  importTombstones(tombstones: Tombstone[]): Promise<void>;
  cleanupTombstones(olderThanDays: number): Promise<number>; // Returns count of cleaned tombstones

  // Bulk Operations
  exportAll(): Promise<ExportData>;
  importAll(data: ExportData): Promise<void>;
  clearAll(): Promise<void>;
}
