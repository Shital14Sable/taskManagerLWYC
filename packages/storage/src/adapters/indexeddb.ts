import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
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
import { createDefaultPreferences, createDefaultStats } from '@trackmind/core';
import type { StorageAdapter, PendingChange, ExportData, Tombstone, EntityType } from '../interface';

interface Metadata {
  key: string;
  value: unknown;
}

class TrackMindDatabase extends Dexie {
  tasks!: Table<Task, string>;
  projects!: Table<Project, string>;
  schedules!: Table<Schedule, string>;
  goals!: Table<Goal, string>;
  notes!: Table<Note, string>;
  lists!: Table<TaskList, string>;
  listInstances!: Table<ListInstance, string>;
  habitInstances!: Table<HabitInstance & { _key: string }, string>;
  journalEntries!: Table<JournalEntry, string>;
  moodCheckIns!: Table<MoodCheckIn, string>;
  preferences!: Table<UserPreferences & { _id: string }, string>;
  stats!: Table<UserStats & { _id: string }, string>;
  pendingChanges!: Table<PendingChange, string>;
  tombstones!: Table<Tombstone, string>;
  metadata!: Table<Metadata, string>;

  constructor() {
    super('TrackMindDB');

    // Handle blocked upgrades (e.g., another tab has the DB open with old version)
    this.on('blocked', () => {
      console.warn('[IndexedDB] Database upgrade blocked - waiting for other tabs to close');
      // Don't alert immediately - the versionchange handler in other tabs should handle it
    });

    // When another tab needs to upgrade the database, this tab should reload
    // to get the new code and schema
    this.on('versionchange', () => {
      console.log('[IndexedDB] New version detected in another tab, reloading...');
      this.close();
      // Notify user and reload to get new version
      if (typeof window !== 'undefined') {
        // Small delay to allow the close to complete
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    });

    this.version(1).stores({
      tasks: 'id, project_id, status, deadline, scheduled_for, is_habit, *tags',
      projects: 'id, status, parent_id',
      schedules: 'date',
      goals: 'id, time_horizon, category, status',
      notes: 'id, folder_path, *tags',
      lists: 'id, list_type',
      listInstances: 'id, list_id',
      habitInstances: '_key, habit_id, date',
      preferences: '_id',
      stats: '_id',
      pendingChanges: 'id, type, timestamp',
      metadata: 'key',
    });

    // Version 2: Ensure all tables exist (no schema change, just trigger upgrade for older DBs)
    this.version(2).stores({
      tasks: 'id, project_id, status, deadline, scheduled_for, is_habit, *tags',
      projects: 'id, status, parent_id',
      schedules: 'date',
      goals: 'id, time_horizon, category, status',
      notes: 'id, folder_path, *tags',
      lists: 'id, list_type',
      listInstances: 'id, list_id',
      habitInstances: '_key, habit_id, date',
      preferences: '_id',
      stats: '_id',
      pendingChanges: 'id, type, timestamp',
      metadata: 'key',
    });

    // Version 3: Add tombstones table for deletion sync
    this.version(3).stores({
      tasks: 'id, project_id, status, deadline, scheduled_for, is_habit, *tags',
      projects: 'id, status, parent_id',
      schedules: 'date',
      goals: 'id, time_horizon, category, status',
      notes: 'id, folder_path, *tags',
      lists: 'id, list_type',
      listInstances: 'id, list_id',
      habitInstances: '_key, habit_id, date',
      preferences: '_id',
      stats: '_id',
      pendingChanges: 'id, type, timestamp',
      tombstones: 'id, entityType, entityId, deletedAt',
      metadata: 'key',
    });

    // Version 4: Add journal entries table
    this.version(4).stores({
      tasks: 'id, project_id, status, deadline, scheduled_for, is_habit, *tags',
      projects: 'id, status, parent_id',
      schedules: 'date',
      goals: 'id, time_horizon, category, status',
      notes: 'id, folder_path, *tags',
      lists: 'id, list_type',
      listInstances: 'id, list_id',
      habitInstances: '_key, habit_id, date',
      journalEntries: 'id, date, timeOfDay, *linked_project_ids, *linked_habit_ids, *tags',
      preferences: '_id',
      stats: '_id',
      pendingChanges: 'id, type, timestamp',
      tombstones: 'id, entityType, entityId, deletedAt',
      metadata: 'key',
    });

    // Version 5: Add mood check-ins table
    this.version(5).stores({
      tasks: 'id, project_id, status, deadline, scheduled_for, is_habit, *tags',
      projects: 'id, status, parent_id',
      schedules: 'date',
      goals: 'id, time_horizon, category, status',
      notes: 'id, folder_path, *tags',
      lists: 'id, list_type',
      listInstances: 'id, list_id',
      habitInstances: '_key, habit_id, date',
      journalEntries: 'id, date, timeOfDay, *linked_project_ids, *linked_habit_ids, *tags',
      moodCheckIns: 'id, date, timestamp',
      preferences: '_id',
      stats: '_id',
      pendingChanges: 'id, type, timestamp',
      tombstones: 'id, entityType, entityId, deletedAt',
      metadata: 'key',
    });
  }
}

export class IndexedDBStorage implements StorageAdapter {
  private db: TrackMindDatabase;

  constructor() {
    this.db = new TrackMindDatabase();
  }

  async initialize(): Promise<void> {
    try {
      console.log('[IndexedDB] Opening database...');
      await this.db.open();
      console.log('[IndexedDB] Database opened successfully, version:', this.db.verno);
    } catch (error) {
      console.error('[IndexedDB] Failed to open database:', error);
      throw error;
    }

    // Initialize preferences if not exists
    try {
      const prefs = await this.db.preferences.get('default');
      if (!prefs) {
        await this.db.preferences.put({
          ...createDefaultPreferences(),
          _id: 'default',
        });
      }
    } catch (error) {
      console.warn('[IndexedDB] Failed to initialize preferences:', error);
    }

    // Initialize stats if not exists
    try {
      const stats = await this.db.stats.get('default');
      if (!stats) {
        await this.db.stats.put({
          ...createDefaultStats(),
          _id: 'default',
        });
      }
    } catch (error) {
      console.warn('[IndexedDB] Failed to initialize stats:', error);
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    const tasks = await this.db.tasks.toArray();
    // Normalize tasks to ensure all required fields have values
    // This handles legacy data that may be missing newer fields like is_pinned
    return tasks.map(task => ({
      ...task,
      is_pinned: task.is_pinned ?? false,
      pin_type: task.pin_type ?? 'soft',
      is_paused: task.is_paused ?? false,
      needs_review: task.needs_review ?? false,
    }));
  }

  async getTask(id: string): Promise<Task | null> {
    const task = await this.db.tasks.get(id);
    if (!task) return null;
    // Normalize to ensure all required fields have values
    return {
      ...task,
      is_pinned: task.is_pinned ?? false,
      pin_type: task.pin_type ?? 'soft',
      is_paused: task.is_paused ?? false,
      needs_review: task.needs_review ?? false,
    };
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const tasks = await this.db.tasks.where('project_id').equals(projectId).toArray();
    return tasks.map(task => ({
      ...task,
      is_pinned: task.is_pinned ?? false,
      pin_type: task.pin_type ?? 'soft',
      is_paused: task.is_paused ?? false,
      needs_review: task.needs_review ?? false,
    }));
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    const tasks = await this.db.tasks.where('status').equals(status).toArray();
    return tasks.map(task => ({
      ...task,
      is_pinned: task.is_pinned ?? false,
      pin_type: task.pin_type ?? 'soft',
      is_paused: task.is_paused ?? false,
      needs_review: task.needs_review ?? false,
    }));
  }

  async saveTask(task: Task): Promise<void> {
    const existing = await this.db.tasks.get(task.id);
    await this.db.tasks.put(task);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'task',
      operation: existing ? 'update' : 'create',
      entityId: task.id,
      timestamp: new Date().toISOString(),
      data: task,
    });
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.db.tasks.bulkPut(tasks);
    for (const task of tasks) {
      await this.addPendingChange({
        id: uuidv4(),
        type: 'task',
        operation: 'update',
        entityId: task.id,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.tasks.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'task',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'task',
      entityId: id,
      deletedAt: now,
    });
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return this.db.projects.toArray();
  }

  async getProject(id: string): Promise<Project | null> {
    return (await this.db.projects.get(id)) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    const existing = await this.db.projects.get(project.id);
    await this.db.projects.put(project);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'project',
      operation: existing ? 'update' : 'create',
      entityId: project.id,
      timestamp: new Date().toISOString(),
      data: project,
    });
  }

  async deleteProject(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.projects.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'project',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'project',
      entityId: id,
      deletedAt: now,
    });
  }

  // Schedules
  async getSchedule(date: string): Promise<Schedule | null> {
    return (await this.db.schedules.get(date)) ?? null;
  }

  async getSchedules(startDate: string, endDate: string): Promise<Schedule[]> {
    return this.db.schedules
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async saveSchedule(schedule: Schedule): Promise<void> {
    await this.db.schedules.put(schedule);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'schedule',
      operation: 'update',
      entityId: schedule.date,
      timestamp: new Date().toISOString(),
    });
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    await this.db.schedules.bulkPut(schedules);
    for (const schedule of schedules) {
      await this.addPendingChange({
        id: uuidv4(),
        type: 'schedule',
        operation: 'update',
        entityId: schedule.date,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteSchedule(date: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.schedules.delete(date);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'schedule',
      operation: 'delete',
      entityId: date,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'schedule',
      entityId: date,
      deletedAt: now,
    });
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    return this.db.goals.toArray();
  }

  async getGoal(id: string): Promise<Goal | null> {
    return (await this.db.goals.get(id)) ?? null;
  }

  async saveGoal(goal: Goal): Promise<void> {
    await this.db.goals.put(goal);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'goal',
      operation: 'update',
      entityId: goal.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteGoal(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.goals.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'goal',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'goal',
      entityId: id,
      deletedAt: now,
    });
  }

  // Notes
  async getNotes(): Promise<Note[]> {
    return this.db.notes.toArray();
  }

  async getNote(id: string): Promise<Note | null> {
    return (await this.db.notes.get(id)) ?? null;
  }

  async getNotesByFolder(folder: string): Promise<Note[]> {
    return this.db.notes.where('folder_path').equals(folder).toArray();
  }

  async saveNote(note: Note): Promise<void> {
    await this.db.notes.put(note);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'note',
      operation: 'update',
      entityId: note.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteNote(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.notes.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'note',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'note',
      entityId: id,
      deletedAt: now,
    });
  }

  // Lists
  async getLists(): Promise<TaskList[]> {
    return this.db.lists.toArray();
  }

  async getList(id: string): Promise<TaskList | null> {
    return (await this.db.lists.get(id)) ?? null;
  }

  async saveList(list: TaskList): Promise<void> {
    await this.db.lists.put(list);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'list',
      operation: 'update',
      entityId: list.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteList(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.lists.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'list',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'list',
      entityId: id,
      deletedAt: now,
    });
  }

  // List Instances
  async getListInstances(): Promise<ListInstance[]> {
    return this.db.listInstances.toArray();
  }

  async getListInstance(id: string): Promise<ListInstance | null> {
    return (await this.db.listInstances.get(id)) ?? null;
  }

  async saveListInstance(instance: ListInstance): Promise<void> {
    await this.db.listInstances.put(instance);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'list_instance',
      operation: 'update',
      entityId: instance.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteListInstance(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.listInstances.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'list_instance',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'list_instance',
      entityId: id,
      deletedAt: now,
    });
  }

  // Habit Instances
  async getHabitInstance(taskId: string, date: string): Promise<HabitInstance | null> {
    const key = `${taskId}:${date}`;
    const result = await this.db.habitInstances.get(key);
    if (!result) return null;
    const { _key, ...instance } = result;
    return instance as HabitInstance;
  }

  async getHabitInstances(date: string): Promise<HabitInstance[]> {
    const results = await this.db.habitInstances.where('date').equals(date).toArray();
    return results.map(({ _key, ...instance }) => instance as HabitInstance);
  }

  async getHabitInstancesByHabit(habitId: string, startDate?: string, endDate?: string): Promise<HabitInstance[]> {
    let results = await this.db.habitInstances.where('habit_id').equals(habitId).toArray();

    // Filter by date range if provided
    if (startDate) {
      results = results.filter(r => r.date >= startDate);
    }
    if (endDate) {
      results = results.filter(r => r.date <= endDate);
    }

    return results.map(({ _key, ...instance }) => instance as HabitInstance);
  }

  async saveHabitInstance(instance: HabitInstance): Promise<void> {
    const key = `${instance.habit_id}:${instance.date}`;
    await this.db.habitInstances.put({ ...instance, _key: key });
    // Track habit instance changes for sync
    await this.addPendingChange({
      id: uuidv4(),
      type: 'habit_instance',
      operation: 'update',
      entityId: key,
      timestamp: new Date().toISOString(),
      data: instance,
    });
  }

  async deleteHabitInstance(habitId: string, date: string): Promise<void> {
    const key = `${habitId}:${date}`;
    await this.db.habitInstances.delete(key);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'habit_instance',
      operation: 'delete',
      entityId: key,
      timestamp: new Date().toISOString(),
      data: null,
    });
  }

  // Journal Entries
  async getJournalEntries(): Promise<JournalEntry[]> {
    try {
      return await this.db.journalEntries.toArray();
    } catch (error) {
      // Table might not exist yet during migration from older schema
      console.warn('[IndexedDB] getJournalEntries failed, returning empty array:', error);
      return [];
    }
  }

  async getJournalEntry(id: string): Promise<JournalEntry | null> {
    return (await this.db.journalEntries.get(id)) ?? null;
  }

  async getJournalEntriesByDate(date: string): Promise<JournalEntry[]> {
    return this.db.journalEntries.where('date').equals(date).toArray();
  }

  async getJournalEntriesByDateRange(startDate: string, endDate: string): Promise<JournalEntry[]> {
    return this.db.journalEntries
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async saveJournalEntry(entry: JournalEntry): Promise<void> {
    const existing = await this.db.journalEntries.get(entry.id);
    await this.db.journalEntries.put(entry);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'journal',
      operation: existing ? 'update' : 'create',
      entityId: entry.id,
      timestamp: new Date().toISOString(),
      data: entry,
    });
  }

  async deleteJournalEntry(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.journalEntries.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'journal',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'journal',
      entityId: id,
      deletedAt: now,
    });
  }

  // Mood Check-ins
  async getMoodCheckIns(): Promise<MoodCheckIn[]> {
    try {
      return await this.db.moodCheckIns.toArray();
    } catch (error) {
      // Table might not exist yet during migration from older schema
      console.warn('[IndexedDB] getMoodCheckIns failed, returning empty array:', error);
      return [];
    }
  }

  async getMoodCheckIn(id: string): Promise<MoodCheckIn | null> {
    try {
      return (await this.db.moodCheckIns.get(id)) ?? null;
    } catch (error) {
      console.warn('[IndexedDB] getMoodCheckIn failed:', error);
      return null;
    }
  }

  async getMoodCheckInsByDate(date: string): Promise<MoodCheckIn[]> {
    try {
      return await this.db.moodCheckIns.where('date').equals(date).toArray();
    } catch (error) {
      console.warn('[IndexedDB] getMoodCheckInsByDate failed:', error);
      return [];
    }
  }

  async getMoodCheckInsByDateRange(startDate: string, endDate: string): Promise<MoodCheckIn[]> {
    try {
      return await this.db.moodCheckIns
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
    } catch (error) {
      console.warn('[IndexedDB] getMoodCheckInsByDateRange failed:', error);
      return [];
    }
  }

  async saveMoodCheckIn(moodCheckIn: MoodCheckIn): Promise<void> {
    const existing = await this.db.moodCheckIns.get(moodCheckIn.id);
    await this.db.moodCheckIns.put(moodCheckIn);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'mood_checkin',
      operation: existing ? 'update' : 'create',
      entityId: moodCheckIn.id,
      timestamp: new Date().toISOString(),
      data: moodCheckIn,
    });
  }

  async deleteMoodCheckIn(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.moodCheckIns.delete(id);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'mood_checkin',
      operation: 'delete',
      entityId: id,
      timestamp: now,
    });
    await this.addTombstone({
      id: uuidv4(),
      entityType: 'mood_checkin',
      entityId: id,
      deletedAt: now,
    });
  }

  // Preferences
  async getPreferences(): Promise<UserPreferences> {
    const prefs = await this.db.preferences.get('default');
    if (!prefs) return createDefaultPreferences();
    const { _id, ...preferences } = prefs;
    return preferences as UserPreferences;
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    await this.db.preferences.put({ ...preferences, _id: 'default' });
    await this.addPendingChange({
      id: uuidv4(),
      type: 'preferences',
      operation: 'update',
      entityId: 'default',
      timestamp: new Date().toISOString(),
    });
  }

  // Stats
  async getStats(): Promise<UserStats> {
    const stats = await this.db.stats.get('default');
    if (!stats) return createDefaultStats();
    const { _id, ...userStats } = stats;
    return userStats as UserStats;
  }

  async saveStats(stats: UserStats): Promise<void> {
    await this.db.stats.put({ ...stats, _id: 'default' });
    await this.addPendingChange({
      id: uuidv4(),
      type: 'stats',
      operation: 'update',
      entityId: 'default',
      timestamp: new Date().toISOString(),
    });
  }

  // Sync Metadata
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const meta = await this.db.metadata.get('lastSyncTime');
      return meta ? new Date(meta.value as string) : null;
    } catch (error) {
      console.warn('[Storage] getLastSyncTime failed:', error);
      return null;
    }
  }

  async setLastSyncTime(time: Date): Promise<void> {
    try {
      await this.db.metadata.put({ key: 'lastSyncTime', value: time.toISOString() });
    } catch (error) {
      console.warn('[Storage] setLastSyncTime failed:', error);
    }
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    try {
      return await this.db.pendingChanges.orderBy('timestamp').toArray();
    } catch (error) {
      console.warn('[Storage] getPendingChanges failed, returning empty array:', error);
      return [];
    }
  }

  async addPendingChange(change: PendingChange): Promise<void> {
    try {
      await this.db.pendingChanges.put(change);
    } catch (error) {
      console.warn('[Storage] addPendingChange failed:', error);
    }
  }

  async clearPendingChanges(changeIds: string[]): Promise<void> {
    try {
      if (changeIds.length > 0) {
        await this.db.pendingChanges.bulkDelete(changeIds);
      }
    } catch (error) {
      console.warn('[Storage] clearPendingChanges failed:', error);
    }
  }

  // Tombstone Management
  async getTombstones(): Promise<Tombstone[]> {
    try {
      return await this.db.tombstones.toArray();
    } catch (error) {
      console.warn('[Storage] getTombstones failed, returning empty array:', error);
      return [];
    }
  }

  async addTombstone(tombstone: Tombstone): Promise<void> {
    try {
      await this.db.tombstones.put(tombstone);
    } catch (error) {
      console.warn('[Storage] addTombstone failed:', error);
    }
  }

  async importTombstones(tombstones: Tombstone[]): Promise<void> {
    try {
      // Merge with existing tombstones (avoid duplicates by entityType+entityId)
      const existing = await this.getTombstones();
      const existingKeys = new Set(existing.map(t => `${t.entityType}:${t.entityId}`));

      const newTombstones = tombstones.filter(t => !existingKeys.has(`${t.entityType}:${t.entityId}`));
      if (newTombstones.length > 0) {
        await this.db.tombstones.bulkPut(newTombstones);
      }
    } catch (error) {
      console.warn('[Storage] importTombstones failed:', error);
    }
  }

  async cleanupTombstones(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffISO = cutoffDate.toISOString();

      const oldTombstones = await this.db.tombstones
        .where('deletedAt')
        .below(cutoffISO)
        .toArray();

      if (oldTombstones.length > 0) {
        await this.db.tombstones.bulkDelete(oldTombstones.map(t => t.id));
      }

      return oldTombstones.length;
    } catch (error) {
      console.warn('[Storage] cleanupTombstones failed:', error);
      return 0;
    }
  }

  // Bulk Operations
  async exportAll(): Promise<ExportData> {
    const [
      tasks,
      projects,
      schedules,
      goals,
      notes,
      lists,
      listInstances,
      habitInstancesRaw,
      journalEntries,
      moodCheckIns,
      preferences,
      stats,
      tombstones,
    ] = await Promise.all([
      this.getTasks(),
      this.getProjects(),
      this.db.schedules.toArray(),
      this.getGoals(),
      this.getNotes(),
      this.getLists(),
      this.getListInstances(),
      this.db.habitInstances.toArray(),
      this.getJournalEntries(),
      this.getMoodCheckIns(),
      this.getPreferences(),
      this.getStats(),
      this.getTombstones(),
    ]);

    const habitInstances = habitInstancesRaw.map(({ _key, ...instance }) => instance as HabitInstance);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks,
      projects,
      schedules,
      goals,
      notes,
      lists,
      listInstances,
      habitInstances,
      journalEntries,
      moodCheckIns,
      preferences,
      stats,
      tombstones: {
        tombstones,
        cleanedUpBefore: undefined, // Will be set during cleanup
      },
    };
  }

  async importAll(data: ExportData): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.tasks,
        this.db.projects,
        this.db.schedules,
        this.db.goals,
        this.db.notes,
        this.db.lists,
        this.db.listInstances,
        this.db.habitInstances,
        this.db.journalEntries,
        this.db.moodCheckIns,
        this.db.tombstones,
        this.db.preferences,
        this.db.stats,
      ],
      async () => {
        // Clear existing data
        await Promise.all([
          this.db.tasks.clear(),
          this.db.projects.clear(),
          this.db.schedules.clear(),
          this.db.goals.clear(),
          this.db.notes.clear(),
          this.db.lists.clear(),
          this.db.listInstances.clear(),
          this.db.habitInstances.clear(),
          this.db.journalEntries.clear(),
          this.db.moodCheckIns.clear(),
        ]);

        // Import new data (with fallbacks for older export formats)
        const habitInstances = (data.habitInstances || []).map(hi => ({
          ...hi,
          _key: `${hi.habit_id}:${hi.date}`,
        }));

        // Handle old format: convert separate habits array to tasks with is_habit=true
        const oldHabits = (data as any).habits || [];
        const now = new Date().toISOString();
        const convertedHabits = oldHabits.map((habit: any) => ({
          id: habit.id,
          project_id: habit.project_id,
          parent_task_id: null,
          title: habit.title,
          description: habit.description || '',
          priority: habit.priority ?? 2,
          difficulty: habit.difficulty ?? 2,
          energy_level: habit.energy_level || 'medium',
          estimated_minutes: habit.estimated_minutes ?? 30,
          actual_minutes: null,
          status: habit.status || 'todo',
          dependencies: [],
          tags: habit.tags || [],
          deadline: null,
          scheduled_for: null,
          created_at: habit.created_at || now,
          updated_at: habit.updated_at || now,
          completed_at: null,
          is_habit: true,
          recurrence: habit.recurrence || { frequency: 'daily', days_of_week: [], time_of_day: null },
          is_paused: habit.is_paused ?? false,
          paused_until: habit.paused_until || null,
          needs_review: false,
          is_pinned: false,
          pin_type: 'soft',
        }));

        // Merge tasks with converted habits and normalize
        // Normalize imported tasks to ensure they have all required fields
        const normalizedTasks = (data.tasks || []).map((task: any) => ({
          ...task,
          is_pinned: task.is_pinned ?? false,
          pin_type: task.pin_type ?? 'soft',
          is_paused: task.is_paused ?? false,
          needs_review: task.needs_review ?? false,
        }));
        const allTasks = [...normalizedTasks, ...convertedHabits];

        await Promise.all([
          this.db.tasks.bulkPut(allTasks),
          this.db.projects.bulkPut(data.projects || []),
          this.db.schedules.bulkPut(data.schedules || []),
          this.db.goals.bulkPut(data.goals || []),
          this.db.notes.bulkPut(data.notes || []),
          this.db.lists.bulkPut(data.lists || []),
          this.db.listInstances.bulkPut(data.listInstances || []),
          this.db.habitInstances.bulkPut(habitInstances),
          this.db.journalEntries.bulkPut(data.journalEntries || []),
          this.db.moodCheckIns.bulkPut(data.moodCheckIns || []),
        ]);

        if (data.preferences) {
          await this.savePreferences(data.preferences);
        }
        if (data.stats) {
          await this.saveStats(data.stats);
        }
      }
    );

    // Import tombstones (merge, don't clear - we need to preserve local deletions)
    if (data.tombstones?.tombstones) {
      await this.importTombstones(data.tombstones.tombstones);
    }
  }

  async clearAll(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.tasks,
        this.db.projects,
        this.db.schedules,
        this.db.goals,
        this.db.notes,
        this.db.lists,
        this.db.listInstances,
        this.db.habitInstances,
        this.db.journalEntries,
        this.db.moodCheckIns,
        this.db.pendingChanges,
        this.db.tombstones,
        this.db.metadata,
      ],
      async () => {
        await Promise.all([
          this.db.tasks.clear(),
          this.db.projects.clear(),
          this.db.schedules.clear(),
          this.db.goals.clear(),
          this.db.notes.clear(),
          this.db.lists.clear(),
          this.db.listInstances.clear(),
          this.db.habitInstances.clear(),
          this.db.journalEntries.clear(),
          this.db.moodCheckIns.clear(),
          this.db.pendingChanges.clear(),
          this.db.tombstones.clear(),
          this.db.metadata.clear(),
        ]);
      }
    );
  }
}
