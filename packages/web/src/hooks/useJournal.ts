import { useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import type {
  JournalEntry,
  JournalEntryCreate,
  JournalEntryUpdate,
  MoodEntry,
  MoodLevel,
  TimeOfDay,
  MoodStats,
  MoodCorrelation,
  JournalFolder,
} from '@trackmind/core';
import {
  createJournalEntry,
  createMoodEntry,
  filterEntriesByDateRange,
  filterEntriesByProject,
  filterEntriesByHabit,
  calculateMoodStats,
  calculateMoodCorrelation,
  getCurrentTimeOfDay,
  toISODateString,
  searchJournalEntries,
  filterEntriesByFolder,
} from '@trackmind/core';

// Build folder tree from journal entries and explicit folders
// This is the same logic as useNotes.ts buildFolderTree
function buildFolderTree(entries: JournalEntry[], explicitFolders: string[]): JournalFolder[] {
  const folderMap = new Map<string, { count: number; subfolders: Set<string> }>();

  // Helper to add a folder path to the map
  const addFolderPath = (rawPath: string, incrementCount: boolean) => {
    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length === 0) return;

    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? currentPath + '/' + parts[i] : parts[i];

      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, { count: 0, subfolders: new Set() });
      }

      if (parentPath && folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.subfolders.add(parts[i]);
      }
    }

    // Increment count for the actual folder if requested
    if (incrementCount) {
      const normalizedPath = parts.join('/');
      if (folderMap.has(normalizedPath)) {
        folderMap.get(normalizedPath)!.count++;
      }
    }
  };

  // First, add all explicit folders (without incrementing count)
  for (const folderPath of explicitFolders) {
    const normalizedPath = folderPath.trim();
    if (normalizedPath && normalizedPath !== '/') {
      addFolderPath(normalizedPath, false);
    }
  }

  // Then, add folders from topic entries (with count increment)
  const topicEntries = entries.filter(e => e.entry_type === 'topic');
  for (const entry of topicEntries) {
    const rawPath = entry.folder_path?.trim() || '';
    if (rawPath && rawPath !== '/') {
      addFolderPath(rawPath, true);
    }
  }

  // Build tree structure
  function buildSubtree(path: string): JournalFolder[] {
    const folder = folderMap.get(path);
    if (!folder) return [];

    return Array.from(folder.subfolders).sort().map(name => {
      const subPath = path + '/' + name;
      return {
        name,
        path: subPath,
        subfolders: buildSubtree(subPath),
        entry_count: folderMap.get(subPath)?.count ?? 0,
      };
    });
  }

  // Get root level folders (single-part paths)
  const rootFolders: JournalFolder[] = [];
  for (const [path, data] of folderMap) {
    // Root folders don't contain slashes
    if (!path.includes('/')) {
      rootFolders.push({
        name: path,
        path,
        subfolders: buildSubtree(path),
        entry_count: data.count,
      });
    }
  }

  return rootFolders.sort((a, b) => a.name.localeCompare(b.name));
}

export interface UseJournalOptions {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  habitId?: string;
}

export function useJournal(options: UseJournalOptions = {}) {
  const {
    journalEntries,
    saveJournalEntry: saveEntry,
    deleteJournalEntry: removeEntry,
    tasks,
    journalFolders,
    addJournalFolder,
  } = useApp();

  // Filter entries based on options
  const filteredEntries = useMemo(() => {
    let entries = journalEntries;

    if (options.startDate && options.endDate) {
      entries = filterEntriesByDateRange(entries, options.startDate, options.endDate);
    }

    if (options.projectId) {
      entries = filterEntriesByProject(entries, options.projectId);
    }

    if (options.habitId) {
      entries = filterEntriesByHabit(entries, options.habitId);
    }

    // Sort by date descending (most recent first)
    return entries.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // If same date, sort by timeOfDay
      const timeOrder: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
      return timeOrder.indexOf(b.timeOfDay) - timeOrder.indexOf(a.timeOfDay);
    });
  }, [journalEntries, options.startDate, options.endDate, options.projectId, options.habitId]);

  // Get entries grouped by date
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, JournalEntry[]>();
    for (const entry of filteredEntries) {
      if (!grouped.has(entry.date)) {
        grouped.set(entry.date, []);
      }
      grouped.get(entry.date)!.push(entry);
    }
    return grouped;
  }, [filteredEntries]);

  // Calculate mood statistics
  const moodStats = useMemo<MoodStats | null>(() => {
    if (filteredEntries.length === 0) return null;
    return calculateMoodStats(filteredEntries);
  }, [filteredEntries]);

  // Calculate mood correlations
  const moodCorrelation = useMemo<MoodCorrelation | null>(() => {
    return calculateMoodCorrelation(filteredEntries);
  }, [filteredEntries]);

  // Create a new journal entry
  const createEntry = useCallback(async (data: JournalEntryCreate): Promise<JournalEntry> => {
    const entry = createJournalEntry(data);
    await saveEntry(entry);
    return entry;
  }, [saveEntry]);

  // Update an existing journal entry
  const updateEntry = useCallback(async (id: string, data: JournalEntryUpdate): Promise<JournalEntry> => {
    const existing = journalEntries.find(e => e.id === id);
    if (!existing) {
      throw new Error(`Journal entry ${id} not found`);
    }
    const updated: JournalEntry = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveEntry(updated);
    return updated;
  }, [journalEntries, saveEntry]);

  // Delete a journal entry
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    await removeEntry(id);
  }, [removeEntry]);

  // Get or create today's entry for a specific time of day
  const getTodayEntry = useCallback(async (timeOfDay?: TimeOfDay): Promise<JournalEntry> => {
    const today = toISODateString(new Date());
    const targetTimeOfDay = timeOfDay ?? getCurrentTimeOfDay();

    // Find existing entry for today and time of day
    const existing = journalEntries.find(
      e => e.date === today && e.timeOfDay === targetTimeOfDay
    );

    if (existing) {
      return existing;
    }

    // Create new entry
    return createEntry({
      date: today,
      timeOfDay: targetTimeOfDay,
    });
  }, [journalEntries, createEntry]);

  // Set mood for an entry
  const setMood = useCallback(async (entryId: string, level: MoodLevel, note?: string): Promise<JournalEntry> => {
    const mood = createMoodEntry(level, note);
    return updateEntry(entryId, { mood });
  }, [updateEntry]);

  // Add completed items to an entry (auto-import)
  const importCompletedItems = useCallback(async (entryId: string): Promise<JournalEntry> => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }

    // Get tasks completed on this date
    const completedTasks = tasks.filter(t =>
      t.status === 'done' &&
      t.completed_at?.startsWith(entry.date)
    );

    const completedTaskIds = completedTasks.map(t => t.id);
    const completedHabitIds = completedTasks.filter(t => t.is_habit).map(t => t.id);

    return updateEntry(entryId, {
      completedTaskIds,
      completedHabitIds,
    });
  }, [journalEntries, tasks, updateEntry]);

  // Link entities to an entry
  const linkTask = useCallback(async (entryId: string, taskId: string): Promise<JournalEntry> => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.linked_task_ids.includes(taskId)) {
      return entry;
    }
    return updateEntry(entryId, {
      linked_task_ids: [...entry.linked_task_ids, taskId],
    });
  }, [journalEntries, updateEntry]);

  const linkProject = useCallback(async (entryId: string, projectId: string): Promise<JournalEntry> => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.linked_project_ids.includes(projectId)) {
      return entry;
    }
    return updateEntry(entryId, {
      linked_project_ids: [...entry.linked_project_ids, projectId],
    });
  }, [journalEntries, updateEntry]);

  const linkHabit = useCallback(async (entryId: string, habitId: string): Promise<JournalEntry> => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.linked_habit_ids.includes(habitId)) {
      return entry;
    }
    return updateEntry(entryId, {
      linked_habit_ids: [...entry.linked_habit_ids, habitId],
    });
  }, [journalEntries, updateEntry]);

  const linkGoal = useCallback(async (entryId: string, goalId: string): Promise<JournalEntry> => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.linked_goal_ids.includes(goalId)) {
      return entry;
    }
    return updateEntry(entryId, {
      linked_goal_ids: [...entry.linked_goal_ids, goalId],
    });
  }, [journalEntries, updateEntry]);

  // Get entries for a specific week
  const getWeekEntries = useCallback((weekStart: string): JournalEntry[] => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = toISODateString(end);
    return filterEntriesByDateRange(journalEntries, weekStart, endStr);
  }, [journalEntries]);

  // Get entries for a specific month
  const getMonthEntries = useCallback((year: number, month: number): JournalEntry[] => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return filterEntriesByDateRange(journalEntries, start, end);
  }, [journalEntries]);

  // Topic entries (entries not tied to a date)
  const topicEntries = useMemo(() => {
    return filteredEntries.filter(e => e.entry_type === 'topic');
  }, [filteredEntries]);

  // Topic folders built from topic entries and journal folders
  // Using explicit length in deps to ensure React detects array changes
  const topicFolders = useMemo<JournalFolder[]>(() => {
    return buildFolderTree(journalEntries, journalFolders);
  }, [journalEntries, journalFolders, journalFolders.length]);

  // Search topics by query
  const searchTopics = useCallback((query: string): JournalEntry[] => {
    return searchJournalEntries(journalEntries, query, { topicsOnly: true });
  }, [journalEntries]);

  // Get topic entries by folder
  const getTopicsByFolder = useCallback((folderPath: string | null): JournalEntry[] => {
    return filterEntriesByFolder(journalEntries, folderPath);
  }, [journalEntries]);

  // Create a folder (uses journal folders from AppContext)
  const createFolder = useCallback((folderPath: string): void => {
    addJournalFolder(folderPath);
  }, [addJournalFolder]);

  return {
    // Data
    entries: filteredEntries,
    entriesByDate,
    moodStats,
    moodCorrelation,
    topicEntries,
    topicFolders,
    loading: false,
    error: null,

    // CRUD operations
    createEntry,
    updateEntry,
    deleteEntry,

    // Convenience methods
    getTodayEntry,
    setMood,
    importCompletedItems,

    // Linking
    linkTask,
    linkProject,
    linkHabit,
    linkGoal,

    // Date-based queries
    getWeekEntries,
    getMonthEntries,

    // Topic organization
    searchTopics,
    getTopicsByFolder,
    createFolder,
  };
}
