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
import type { StorageAdapter, PendingChange, ExportData, Tombstone } from '../interface';

/**
 * In-memory storage implementation for testing
 */
export class MemoryStorage implements StorageAdapter {
  private tasks = new Map<string, Task>();
  private projects = new Map<string, Project>();
  private schedules = new Map<string, Schedule>();
  private goals = new Map<string, Goal>();
  private notes = new Map<string, Note>();
  private lists = new Map<string, TaskList>();
  private listInstances = new Map<string, ListInstance>();
  private habitInstances = new Map<string, HabitInstance>();
  private journalEntries = new Map<string, JournalEntry>();
  private moodCheckIns = new Map<string, MoodCheckIn>();
  private preferences: UserPreferences = createDefaultPreferences();
  private stats: UserStats = createDefaultStats();
  private pendingChanges = new Map<string, PendingChange>();
  private tombstones = new Map<string, Tombstone>();
  private lastSyncTime: Date | null = null;

  async initialize(): Promise<void> {
    // No initialization needed for memory storage
  }

  async close(): Promise<void> {
    // No cleanup needed
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.project_id === projectId);
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  async saveTask(task: Task): Promise<void> {
    const existing = this.tasks.has(task.id);
    this.tasks.set(task.id, task);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'task',
      operation: existing ? 'update' : 'create',
      entityId: task.id,
      timestamp: new Date().toISOString(),
    });
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  async deleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.tasks.delete(id);
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
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  // Schedules
  async getSchedule(date: string): Promise<Schedule | null> {
    return this.schedules.get(date) ?? null;
  }

  async getSchedules(startDate: string, endDate: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      s => s.date >= startDate && s.date <= endDate
    );
  }

  async saveSchedule(schedule: Schedule): Promise<void> {
    this.schedules.set(schedule.date, schedule);
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    for (const schedule of schedules) {
      this.schedules.set(schedule.date, schedule);
    }
  }

  async deleteSchedule(date: string): Promise<void> {
    this.schedules.delete(date);
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    return Array.from(this.goals.values());
  }

  async getGoal(id: string): Promise<Goal | null> {
    return this.goals.get(id) ?? null;
  }

  async saveGoal(goal: Goal): Promise<void> {
    this.goals.set(goal.id, goal);
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals.delete(id);
  }

  // Notes
  async getNotes(): Promise<Note[]> {
    return Array.from(this.notes.values());
  }

  async getNote(id: string): Promise<Note | null> {
    return this.notes.get(id) ?? null;
  }

  async getNotesByFolder(folder: string): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(n => n.folder_path === folder);
  }

  async saveNote(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }

  async deleteNote(id: string): Promise<void> {
    this.notes.delete(id);
  }

  // Lists
  async getLists(): Promise<TaskList[]> {
    return Array.from(this.lists.values());
  }

  async getList(id: string): Promise<TaskList | null> {
    return this.lists.get(id) ?? null;
  }

  async saveList(list: TaskList): Promise<void> {
    this.lists.set(list.id, list);
  }

  async deleteList(id: string): Promise<void> {
    this.lists.delete(id);
  }

  // List Instances
  async getListInstances(): Promise<ListInstance[]> {
    return Array.from(this.listInstances.values());
  }

  async getListInstance(id: string): Promise<ListInstance | null> {
    return this.listInstances.get(id) ?? null;
  }

  async saveListInstance(instance: ListInstance): Promise<void> {
    this.listInstances.set(instance.id, instance);
  }

  async deleteListInstance(id: string): Promise<void> {
    this.listInstances.delete(id);
  }

  // Habit Instances
  async getHabitInstance(taskId: string, date: string): Promise<HabitInstance | null> {
    const key = `${taskId}:${date}`;
    return this.habitInstances.get(key) ?? null;
  }

  async getHabitInstances(date: string): Promise<HabitInstance[]> {
    return Array.from(this.habitInstances.values()).filter(hi => hi.date === date);
  }

  async getHabitInstancesByHabit(habitId: string, startDate?: string, endDate?: string): Promise<HabitInstance[]> {
    let results = Array.from(this.habitInstances.values()).filter(hi => hi.habit_id === habitId);
    if (startDate) {
      results = results.filter(r => r.date >= startDate);
    }
    if (endDate) {
      results = results.filter(r => r.date <= endDate);
    }
    return results;
  }

  async saveHabitInstance(instance: HabitInstance): Promise<void> {
    const key = `${instance.habit_id}:${instance.date}`;
    this.habitInstances.set(key, instance);
  }

  async deleteHabitInstance(habitId: string, date: string): Promise<void> {
    this.habitInstances.delete(`${habitId}:${date}`);
  }

  // Journal Entries
  async getJournalEntries(): Promise<JournalEntry[]> {
    return Array.from(this.journalEntries.values());
  }

  async getJournalEntry(id: string): Promise<JournalEntry | null> {
    return this.journalEntries.get(id) ?? null;
  }

  async getJournalEntriesByDate(date: string): Promise<JournalEntry[]> {
    return Array.from(this.journalEntries.values()).filter(e => e.date === date);
  }

  async getJournalEntriesByDateRange(startDate: string, endDate: string): Promise<JournalEntry[]> {
    return Array.from(this.journalEntries.values()).filter(
      e => e.date >= startDate && e.date <= endDate
    );
  }

  async saveJournalEntry(entry: JournalEntry): Promise<void> {
    const existing = this.journalEntries.has(entry.id);
    this.journalEntries.set(entry.id, entry);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'journal',
      operation: existing ? 'update' : 'create',
      entityId: entry.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteJournalEntry(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.journalEntries.delete(id);
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
    return Array.from(this.moodCheckIns.values());
  }

  async getMoodCheckIn(id: string): Promise<MoodCheckIn | null> {
    return this.moodCheckIns.get(id) ?? null;
  }

  async getMoodCheckInsByDate(date: string): Promise<MoodCheckIn[]> {
    return Array.from(this.moodCheckIns.values()).filter(m => m.date === date);
  }

  async getMoodCheckInsByDateRange(startDate: string, endDate: string): Promise<MoodCheckIn[]> {
    return Array.from(this.moodCheckIns.values()).filter(
      m => m.date >= startDate && m.date <= endDate
    );
  }

  async saveMoodCheckIn(moodCheckIn: MoodCheckIn): Promise<void> {
    const existing = this.moodCheckIns.has(moodCheckIn.id);
    this.moodCheckIns.set(moodCheckIn.id, moodCheckIn);
    await this.addPendingChange({
      id: uuidv4(),
      type: 'mood_checkin',
      operation: existing ? 'update' : 'create',
      entityId: moodCheckIn.id,
      timestamp: new Date().toISOString(),
    });
  }

  async deleteMoodCheckIn(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.moodCheckIns.delete(id);
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
    return { ...this.preferences };
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    this.preferences = { ...preferences };
  }

  // Stats
  async getStats(): Promise<UserStats> {
    return { ...this.stats };
  }

  async saveStats(stats: UserStats): Promise<void> {
    this.stats = { ...stats };
  }

  // Sync Metadata
  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }

  async setLastSyncTime(time: Date): Promise<void> {
    this.lastSyncTime = time;
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    return Array.from(this.pendingChanges.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  async addPendingChange(change: PendingChange): Promise<void> {
    this.pendingChanges.set(change.id, change);
  }

  async clearPendingChanges(changeIds: string[]): Promise<void> {
    for (const id of changeIds) {
      this.pendingChanges.delete(id);
    }
  }

  // Tombstone Management
  async getTombstones(): Promise<Tombstone[]> {
    return Array.from(this.tombstones.values());
  }

  async addTombstone(tombstone: Tombstone): Promise<void> {
    this.tombstones.set(tombstone.id, tombstone);
  }

  async importTombstones(tombstones: Tombstone[]): Promise<void> {
    const existingKeys = new Set(
      Array.from(this.tombstones.values()).map(t => `${t.entityType}:${t.entityId}`)
    );
    for (const t of tombstones) {
      const key = `${t.entityType}:${t.entityId}`;
      if (!existingKeys.has(key)) {
        this.tombstones.set(t.id, t);
      }
    }
  }

  async cleanupTombstones(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    const toDelete: string[] = [];
    for (const [id, t] of this.tombstones) {
      if (t.deletedAt < cutoffISO) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.tombstones.delete(id);
    }

    return toDelete.length;
  }

  // Bulk Operations
  async exportAll(): Promise<ExportData> {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks: await this.getTasks(),
      projects: await this.getProjects(),
      schedules: Array.from(this.schedules.values()),
      goals: await this.getGoals(),
      notes: await this.getNotes(),
      lists: await this.getLists(),
      listInstances: await this.getListInstances(),
      habitInstances: Array.from(this.habitInstances.values()),
      journalEntries: await this.getJournalEntries(),
      moodCheckIns: await this.getMoodCheckIns(),
      preferences: await this.getPreferences(),
      stats: await this.getStats(),
      tombstones: {
        tombstones: await this.getTombstones(),
        cleanedUpBefore: undefined,
      },
    };
  }

  async importAll(data: ExportData): Promise<void> {
    // Clear existing
    this.tasks.clear();
    this.projects.clear();
    this.schedules.clear();
    this.goals.clear();
    this.notes.clear();
    this.lists.clear();
    this.listInstances.clear();
    this.habitInstances.clear();
    this.journalEntries.clear();
    this.moodCheckIns.clear();

    // Import
    for (const task of data.tasks) this.tasks.set(task.id, task);
    for (const project of data.projects) this.projects.set(project.id, project);
    for (const schedule of data.schedules) this.schedules.set(schedule.date, schedule);
    for (const goal of data.goals) this.goals.set(goal.id, goal);
    for (const note of data.notes) this.notes.set(note.id, note);
    for (const list of data.lists) this.lists.set(list.id, list);
    for (const instance of data.listInstances) this.listInstances.set(instance.id, instance);
    for (const hi of data.habitInstances) {
      this.habitInstances.set(`${hi.habit_id}:${hi.date}`, hi);
    }
    for (const entry of data.journalEntries || []) {
      this.journalEntries.set(entry.id, entry);
    }
    for (const mood of data.moodCheckIns || []) {
      this.moodCheckIns.set(mood.id, mood);
    }
    this.preferences = data.preferences;
    this.stats = data.stats;

    // Import tombstones (merge, don't clear)
    if (data.tombstones?.tombstones) {
      await this.importTombstones(data.tombstones.tombstones);
    }
  }

  async clearAll(): Promise<void> {
    this.tasks.clear();
    this.projects.clear();
    this.schedules.clear();
    this.goals.clear();
    this.notes.clear();
    this.lists.clear();
    this.listInstances.clear();
    this.habitInstances.clear();
    this.journalEntries.clear();
    this.moodCheckIns.clear();
    this.pendingChanges.clear();
    this.tombstones.clear();
    this.lastSyncTime = null;
    this.preferences = createDefaultPreferences();
    this.stats = createDefaultStats();
  }
}
