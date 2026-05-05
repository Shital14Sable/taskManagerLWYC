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
import type { StorageAdapter, PendingChange, ExportData, Tombstone } from '../interface';

/**
 * SQLite storage implementation for Capacitor mobile apps.
 *
 * TODO: Implement when adding mobile support
 *
 * Dependencies to add:
 * - @capacitor-community/sqlite
 *
 * This adapter will use SQL queries instead of Dexie's API,
 * but implement the same StorageAdapter interface.
 */
export class SQLiteStorage implements StorageAdapter {
  async initialize(): Promise<void> {
    throw new Error('SQLite storage not yet implemented. Use IndexedDB for web.');
  }

  async close(): Promise<void> {
    throw new Error('SQLite storage not yet implemented.');
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    throw new Error('Not implemented');
  }

  async getTask(_id: string): Promise<Task | null> {
    throw new Error('Not implemented');
  }

  async getTasksByProject(_projectId: string): Promise<Task[]> {
    throw new Error('Not implemented');
  }

  async getTasksByStatus(_status: string): Promise<Task[]> {
    throw new Error('Not implemented');
  }

  async saveTask(_task: Task): Promise<void> {
    throw new Error('Not implemented');
  }

  async saveTasks(_tasks: Task[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteTask(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    throw new Error('Not implemented');
  }

  async getProject(_id: string): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async saveProject(_project: Project): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteProject(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Schedules
  async getSchedule(_date: string): Promise<Schedule | null> {
    throw new Error('Not implemented');
  }

  async getSchedules(_startDate: string, _endDate: string): Promise<Schedule[]> {
    throw new Error('Not implemented');
  }

  async saveSchedule(_schedule: Schedule): Promise<void> {
    throw new Error('Not implemented');
  }

  async saveSchedules(_schedules: Schedule[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteSchedule(_date: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    throw new Error('Not implemented');
  }

  async getGoal(_id: string): Promise<Goal | null> {
    throw new Error('Not implemented');
  }

  async saveGoal(_goal: Goal): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteGoal(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Notes
  async getNotes(): Promise<Note[]> {
    throw new Error('Not implemented');
  }

  async getNote(_id: string): Promise<Note | null> {
    throw new Error('Not implemented');
  }

  async getNotesByFolder(_folder: string): Promise<Note[]> {
    throw new Error('Not implemented');
  }

  async saveNote(_note: Note): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteNote(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Lists
  async getLists(): Promise<TaskList[]> {
    throw new Error('Not implemented');
  }

  async getList(_id: string): Promise<TaskList | null> {
    throw new Error('Not implemented');
  }

  async saveList(_list: TaskList): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteList(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // List Instances
  async getListInstances(): Promise<ListInstance[]> {
    throw new Error('Not implemented');
  }

  async getListInstance(_id: string): Promise<ListInstance | null> {
    throw new Error('Not implemented');
  }

  async saveListInstance(_instance: ListInstance): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteListInstance(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Habit Instances
  async getHabitInstance(_taskId: string, _date: string): Promise<HabitInstance | null> {
    throw new Error('Not implemented');
  }

  async getHabitInstances(_date: string): Promise<HabitInstance[]> {
    throw new Error('Not implemented');
  }

  async getHabitInstancesByHabit(_habitId: string, _startDate?: string, _endDate?: string): Promise<HabitInstance[]> {
    throw new Error('Not implemented');
  }

  async saveHabitInstance(_instance: HabitInstance): Promise<void> {
    throw new Error('Not implemented');
  }

  // Journal Entries
  async getJournalEntries(): Promise<JournalEntry[]> {
    throw new Error('Not implemented');
  }

  async getJournalEntry(_id: string): Promise<JournalEntry | null> {
    throw new Error('Not implemented');
  }

  async getJournalEntriesByDate(_date: string): Promise<JournalEntry[]> {
    throw new Error('Not implemented');
  }

  async getJournalEntriesByDateRange(_startDate: string, _endDate: string): Promise<JournalEntry[]> {
    throw new Error('Not implemented');
  }

  async saveJournalEntry(_entry: JournalEntry): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteJournalEntry(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Mood Check-ins
  async getMoodCheckIns(): Promise<MoodCheckIn[]> {
    throw new Error('Not implemented');
  }

  async getMoodCheckIn(_id: string): Promise<MoodCheckIn | null> {
    throw new Error('Not implemented');
  }

  async getMoodCheckInsByDate(_date: string): Promise<MoodCheckIn[]> {
    throw new Error('Not implemented');
  }

  async getMoodCheckInsByDateRange(_startDate: string, _endDate: string): Promise<MoodCheckIn[]> {
    throw new Error('Not implemented');
  }

  async saveMoodCheckIn(_moodCheckIn: MoodCheckIn): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteMoodCheckIn(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  // Preferences
  async getPreferences(): Promise<UserPreferences> {
    throw new Error('Not implemented');
  }

  async savePreferences(_preferences: UserPreferences): Promise<void> {
    throw new Error('Not implemented');
  }

  // Stats
  async getStats(): Promise<UserStats> {
    throw new Error('Not implemented');
  }

  async saveStats(_stats: UserStats): Promise<void> {
    throw new Error('Not implemented');
  }

  // Sync Metadata
  async getLastSyncTime(): Promise<Date | null> {
    throw new Error('Not implemented');
  }

  async setLastSyncTime(_time: Date): Promise<void> {
    throw new Error('Not implemented');
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    throw new Error('Not implemented');
  }

  async addPendingChange(_change: PendingChange): Promise<void> {
    throw new Error('Not implemented');
  }

  async clearPendingChanges(_changeIds: string[]): Promise<void> {
    throw new Error('Not implemented');
  }

  // Tombstone Management
  async getTombstones(): Promise<Tombstone[]> {
    throw new Error('Not implemented');
  }

  async addTombstone(_tombstone: Tombstone): Promise<void> {
    throw new Error('Not implemented');
  }

  async importTombstones(_tombstones: Tombstone[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async cleanupTombstones(_olderThanDays: number): Promise<number> {
    throw new Error('Not implemented');
  }

  // Bulk Operations
  async exportAll(): Promise<ExportData> {
    throw new Error('Not implemented');
  }

  async importAll(_data: ExportData): Promise<void> {
    throw new Error('Not implemented');
  }

  async clearAll(): Promise<void> {
    throw new Error('Not implemented');
  }
}
