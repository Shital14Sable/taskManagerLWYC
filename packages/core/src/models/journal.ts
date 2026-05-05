import { v4 as uuidv4 } from 'uuid';

/**
 * Mood levels for journal entries (1-5 scale)
 */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Mood metadata with optional notes
 */
export interface MoodEntry {
  level: MoodLevel;
  emoji: string; // The emoji representation of the mood
  label: string; // Human-readable label
  note?: string; // Optional note about why this mood
}

/**
 * Time of day for journal prompts
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Entry type: daily (date-bound) or topic (general/timeless)
 */
export type JournalEntryType = 'daily' | 'topic';

/**
 * A journal prompt that can be answered
 */
export interface JournalPrompt {
  id: string;
  text: string;
  category: 'gratitude' | 'reflection' | 'intention' | 'learning' | 'emotion' | 'general';
  timeOfDay: TimeOfDay[];
  response?: string;
}

/**
 * Stats snapshot that can be imported into a journal entry
 */
export interface JournalStatsSnapshot {
  // Task stats
  tasksCompleted: number;
  tasksCreated: number;
  totalMinutesWorked: number;

  // Habit stats
  habitsCompleted: number;
  habitStreak: number;

  // Goal progress
  goalsProgressed: number;

  // Mood average (if available from previous entries)
  averageMood?: number;

  // XP and level
  xpEarned: number;
  currentLevel: number;

  // Period this snapshot covers
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  periodStart: string; // ISO date
  periodEnd: string; // ISO date

  // Optional breakdown by project/habit
  byProject?: Record<string, {
    tasksCompleted: number;
    minutesWorked: number;
  }>;
  byHabit?: Record<string, {
    completions: number;
    streak: number;
  }>;
}

/**
 * A journal entry
 */
export interface JournalEntry {
  id: string;
  entry_type: JournalEntryType; // 'daily' (date-bound) or 'topic' (general)
  date: string; // ISO date (YYYY-MM-DD) - for daily entries, creation date for topics
  timeOfDay: TimeOfDay;

  // Content
  title: string;
  content: string;
  prompts: JournalPrompt[];

  // Mood tracking
  mood?: MoodEntry;

  // Organization (for topic entries)
  folder_path: string; // Folder path like "Ideas/Tech" - empty for daily entries

  // Linked entities
  linked_task_ids: string[];
  linked_project_ids: string[];
  linked_habit_ids: string[];
  linked_goal_ids: string[];

  // Imported stats
  stats?: JournalStatsSnapshot;

  // Auto-imported completed items for this day
  completedTaskIds: string[];
  completedHabitIds: string[];

  // Metadata
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreate {
  entry_type?: JournalEntryType;
  date?: string;
  timeOfDay?: TimeOfDay;
  title?: string;
  content?: string;
  prompts?: JournalPrompt[];
  mood?: MoodEntry;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  stats?: JournalStatsSnapshot;
  completedTaskIds?: string[];
  completedHabitIds?: string[];
  tags?: string[];
}

export interface JournalEntryUpdate {
  title?: string;
  content?: string;
  prompts?: JournalPrompt[];
  mood?: MoodEntry;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  stats?: JournalStatsSnapshot;
  completedTaskIds?: string[];
  completedHabitIds?: string[];
  tags?: string[];
}

/**
 * Mood emoji and label mappings
 */
export const MOOD_CONFIG: Record<MoodLevel, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😢', label: 'Very Low', color: '#ef4444' },
  2: { emoji: '😔', label: 'Low', color: '#f97316' },
  3: { emoji: '😐', label: 'Neutral', color: '#eab308' },
  4: { emoji: '🙂', label: 'Good', color: '#22c55e' },
  5: { emoji: '😄', label: 'Great', color: '#10b981' },
};

/**
 * Default prompts by time of day
 */
export const DEFAULT_PROMPTS: Record<TimeOfDay, JournalPrompt[]> = {
  morning: [
    { id: 'morning-1', text: 'What are you grateful for today?', category: 'gratitude', timeOfDay: ['morning'] },
    { id: 'morning-2', text: 'What is your main focus for today?', category: 'intention', timeOfDay: ['morning'] },
    { id: 'morning-3', text: 'How are you feeling this morning?', category: 'emotion', timeOfDay: ['morning'] },
  ],
  afternoon: [
    { id: 'afternoon-1', text: 'How is your day going so far?', category: 'reflection', timeOfDay: ['afternoon'] },
    { id: 'afternoon-2', text: 'What have you accomplished today?', category: 'reflection', timeOfDay: ['afternoon'] },
    { id: 'afternoon-3', text: 'Is there anything blocking your progress?', category: 'general', timeOfDay: ['afternoon'] },
  ],
  evening: [
    { id: 'evening-1', text: 'What went well today?', category: 'reflection', timeOfDay: ['evening'] },
    { id: 'evening-2', text: 'What did you learn today?', category: 'learning', timeOfDay: ['evening'] },
    { id: 'evening-3', text: 'What are you grateful for from today?', category: 'gratitude', timeOfDay: ['evening'] },
    { id: 'evening-4', text: 'How could tomorrow be even better?', category: 'intention', timeOfDay: ['evening'] },
  ],
  night: [
    { id: 'night-1', text: 'How are you feeling as the day ends?', category: 'emotion', timeOfDay: ['night'] },
    { id: 'night-2', text: 'What was the highlight of your day?', category: 'reflection', timeOfDay: ['night'] },
    { id: 'night-3', text: 'What are you looking forward to tomorrow?', category: 'intention', timeOfDay: ['night'] },
  ],
};

/**
 * Get the current time of day based on hour
 */
export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Create a new journal entry
 */
export function createJournalEntry(data: JournalEntryCreate): JournalEntry {
  const now = new Date();
  const nowISO = now.toISOString();
  const dateStr = data.date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeOfDay = data.timeOfDay ?? getCurrentTimeOfDay();
  const entryType = data.entry_type ?? 'daily';

  // Get default prompts for time of day (only for daily entries)
  const defaultPrompts = entryType === 'daily'
    ? DEFAULT_PROMPTS[timeOfDay].map(p => ({ ...p, response: '' }))
    : [];

  // Default title based on entry type
  const defaultTitle = entryType === 'topic'
    ? data.title ?? 'New Topic'
    : data.title ?? `${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Journal`;

  return {
    id: uuidv4(),
    entry_type: entryType,
    date: dateStr,
    timeOfDay,
    title: defaultTitle,
    content: data.content ?? '',
    prompts: data.prompts ?? defaultPrompts,
    mood: data.mood,
    folder_path: data.folder_path ?? '',
    linked_task_ids: data.linked_task_ids ?? [],
    linked_project_ids: data.linked_project_ids ?? [],
    linked_habit_ids: data.linked_habit_ids ?? [],
    linked_goal_ids: data.linked_goal_ids ?? [],
    stats: data.stats,
    completedTaskIds: data.completedTaskIds ?? [],
    completedHabitIds: data.completedHabitIds ?? [],
    tags: data.tags ?? [],
    created_at: nowISO,
    updated_at: nowISO,
  };
}

/**
 * Create a mood entry
 */
export function createMoodEntry(level: MoodLevel, note?: string): MoodEntry {
  const config = MOOD_CONFIG[level];
  return {
    level,
    emoji: config.emoji,
    label: config.label,
    note,
  };
}

/**
 * Get journal entries for a date range
 */
export function filterEntriesByDateRange(
  entries: JournalEntry[],
  startDate: string,
  endDate: string
): JournalEntry[] {
  return entries.filter(e => e.date >= startDate && e.date <= endDate);
}

/**
 * Get journal entries linked to a project
 */
export function filterEntriesByProject(entries: JournalEntry[], projectId: string): JournalEntry[] {
  return entries.filter(e => e.linked_project_ids.includes(projectId));
}

/**
 * Get journal entries linked to a habit
 */
export function filterEntriesByHabit(entries: JournalEntry[], habitId: string): JournalEntry[] {
  return entries.filter(e => e.linked_habit_ids.includes(habitId));
}

/**
 * Calculate mood statistics for a set of entries
 */
export interface MoodStats {
  averageMood: number;
  moodCounts: Record<MoodLevel, number>;
  moodTrend: 'improving' | 'declining' | 'stable';
  totalEntries: number;
  entriesWithMood: number;
  byDayOfWeek: Record<number, { count: number; totalMood: number; average: number }>;
  byTimeOfDay: Record<TimeOfDay, { count: number; totalMood: number; average: number }>;
}

export function calculateMoodStats(entries: JournalEntry[]): MoodStats {
  const entriesWithMood = entries.filter(e => e.mood);
  const moodCounts: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byDayOfWeek: Record<number, { count: number; totalMood: number; average: number }> = {};
  const byTimeOfDay: Record<TimeOfDay, { count: number; totalMood: number; average: number }> = {
    morning: { count: 0, totalMood: 0, average: 0 },
    afternoon: { count: 0, totalMood: 0, average: 0 },
    evening: { count: 0, totalMood: 0, average: 0 },
    night: { count: 0, totalMood: 0, average: 0 },
  };

  let totalMood = 0;

  for (const entry of entriesWithMood) {
    if (!entry.mood) continue;

    const level = entry.mood.level;
    moodCounts[level]++;
    totalMood += level;

    // By day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = new Date(entry.date).getDay();
    if (!byDayOfWeek[dayOfWeek]) {
      byDayOfWeek[dayOfWeek] = { count: 0, totalMood: 0, average: 0 };
    }
    byDayOfWeek[dayOfWeek].count++;
    byDayOfWeek[dayOfWeek].totalMood += level;

    // By time of day
    byTimeOfDay[entry.timeOfDay].count++;
    byTimeOfDay[entry.timeOfDay].totalMood += level;
  }

  // Calculate averages
  const averageMood = entriesWithMood.length > 0 ? totalMood / entriesWithMood.length : 0;

  for (const day in byDayOfWeek) {
    const d = byDayOfWeek[parseInt(day)];
    d.average = d.count > 0 ? d.totalMood / d.count : 0;
  }

  for (const time of Object.keys(byTimeOfDay) as TimeOfDay[]) {
    const t = byTimeOfDay[time];
    t.average = t.count > 0 ? t.totalMood / t.count : 0;
  }

  // Calculate trend (compare first half vs second half)
  let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (entriesWithMood.length >= 4) {
    const sorted = [...entriesWithMood].sort((a, b) => a.date.localeCompare(b.date));
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, e) => sum + (e.mood?.level || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + (e.mood?.level || 0), 0) / secondHalf.length;

    if (secondAvg - firstAvg > 0.3) moodTrend = 'improving';
    else if (firstAvg - secondAvg > 0.3) moodTrend = 'declining';
  }

  return {
    averageMood,
    moodCounts,
    moodTrend,
    totalEntries: entries.length,
    entriesWithMood: entriesWithMood.length,
    byDayOfWeek,
    byTimeOfDay,
  };
}

/**
 * Calculate mood correlation with task completion
 */
export interface MoodCorrelation {
  tasksCompleted: { correlation: number; description: string };
  habitsCompleted: { correlation: number; description: string };
  timeOfDay: { bestTime: TimeOfDay; worstTime: TimeOfDay };
  dayOfWeek: { bestDay: number; worstDay: number };
}

export function calculateMoodCorrelation(entries: JournalEntry[]): MoodCorrelation | null {
  const entriesWithMood = entries.filter(e => e.mood);
  if (entriesWithMood.length < 5) return null;

  // Simple correlation: do more completed tasks correlate with better mood?
  let tasksSum = 0, moodSum = 0, tasksMoodSum = 0, tasksSquareSum = 0, moodSquareSum = 0;

  for (const entry of entriesWithMood) {
    const tasks = entry.completedTaskIds.length;
    const mood = entry.mood!.level;
    tasksSum += tasks;
    moodSum += mood;
    tasksMoodSum += tasks * mood;
    tasksSquareSum += tasks * tasks;
    moodSquareSum += mood * mood;
  }

  const n = entriesWithMood.length;
  const taskCorr = (n * tasksMoodSum - tasksSum * moodSum) /
    Math.sqrt((n * tasksSquareSum - tasksSum * tasksSum) * (n * moodSquareSum - moodSum * moodSum)) || 0;

  // Habits correlation
  let habitsSum = 0, habitsMoodSum = 0, habitsSquareSum = 0;
  for (const entry of entriesWithMood) {
    const habits = entry.completedHabitIds.length;
    const mood = entry.mood!.level;
    habitsSum += habits;
    habitsMoodSum += habits * mood;
    habitsSquareSum += habits * habits;
  }

  const habitCorr = (n * habitsMoodSum - habitsSum * moodSum) /
    Math.sqrt((n * habitsSquareSum - habitsSum * habitsSum) * (n * moodSquareSum - moodSum * moodSum)) || 0;

  // Best/worst time of day
  const moodStats = calculateMoodStats(entries);
  let bestTime: TimeOfDay = 'morning', worstTime: TimeOfDay = 'morning';
  let bestTimeAvg = 0, worstTimeAvg = 6;

  for (const time of Object.keys(moodStats.byTimeOfDay) as TimeOfDay[]) {
    const stats = moodStats.byTimeOfDay[time];
    if (stats.count > 0) {
      if (stats.average > bestTimeAvg) {
        bestTimeAvg = stats.average;
        bestTime = time;
      }
      if (stats.average < worstTimeAvg) {
        worstTimeAvg = stats.average;
        worstTime = time;
      }
    }
  }

  // Best/worst day of week
  let bestDay = 0, worstDay = 0;
  let bestDayAvg = 0, worstDayAvg = 6;

  for (const day in moodStats.byDayOfWeek) {
    const stats = moodStats.byDayOfWeek[parseInt(day)];
    if (stats.count > 0) {
      if (stats.average > bestDayAvg) {
        bestDayAvg = stats.average;
        bestDay = parseInt(day);
      }
      if (stats.average < worstDayAvg) {
        worstDayAvg = stats.average;
        worstDay = parseInt(day);
      }
    }
  }

  const describeCorrelation = (corr: number): string => {
    if (corr > 0.5) return 'Strong positive correlation';
    if (corr > 0.2) return 'Moderate positive correlation';
    if (corr > -0.2) return 'No significant correlation';
    if (corr > -0.5) return 'Moderate negative correlation';
    return 'Strong negative correlation';
  };

  return {
    tasksCompleted: { correlation: taskCorr, description: describeCorrelation(taskCorr) },
    habitsCompleted: { correlation: habitCorr, description: describeCorrelation(habitCorr) },
    timeOfDay: { bestTime, worstTime },
    dayOfWeek: { bestDay, worstDay },
  };
}

/**
 * Folder structure for organizing topic journal entries
 */
export interface JournalFolder {
  name: string;
  path: string;
  entry_count: number;
  subfolders: JournalFolder[];
}

/**
 * Build folder tree from journal entries and explicit folders
 */
export function buildJournalFolderTree(entries: JournalEntry[], explicitFolders: string[] = []): JournalFolder[] {
  const topicEntries = entries.filter(e => e.entry_type === 'topic' && e.folder_path);
  const folderMap = new Map<string, JournalFolder>();

  // Count entries per folder path
  const entryCounts = new Map<string, number>();
  for (const entry of topicEntries) {
    const path = entry.folder_path;
    entryCounts.set(path, (entryCounts.get(path) || 0) + 1);
  }

  // Build all folder nodes from explicit folders first
  const allPaths = new Set<string>();
  for (const folderPath of explicitFolders) {
    const normalizedPath = folderPath.trim();
    if (normalizedPath && normalizedPath !== '/') {
      const parts = normalizedPath.split('/').filter(Boolean);
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        allPaths.add(currentPath);
      }
    }
  }

  // Then add paths from entries
  for (const entry of topicEntries) {
    const parts = entry.folder_path.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      allPaths.add(currentPath);
    }
  }

  // Create folder nodes
  for (const path of allPaths) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    folderMap.set(path, {
      name,
      path,
      entry_count: entryCounts.get(path) || 0,
      subfolders: [],
    });
  }

  // Build tree structure
  const roots: JournalFolder[] = [];
  for (const [path, folder] of folderMap) {
    const parts = path.split('/');
    if (parts.length === 1) {
      roots.push(folder);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.subfolders.push(folder);
      }
    }
  }

  // Sort folders alphabetically
  const sortFolders = (folders: JournalFolder[]) => {
    folders.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      sortFolders(folder.subfolders);
    }
  };
  sortFolders(roots);

  return roots;
}

/**
 * Search journal entries by query string
 */
export function searchJournalEntries(
  entries: JournalEntry[],
  query: string,
  options?: { topicsOnly?: boolean }
): JournalEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  return entries.filter(entry => {
    // Filter by entry type if specified
    if (options?.topicsOnly && entry.entry_type !== 'topic') {
      return false;
    }

    // Search in title
    if (entry.title.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Search in content
    if (entry.content.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Search in tags
    if (entry.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
      return true;
    }

    // Search in folder path
    if (entry.folder_path?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return false;
  });
}

/**
 * Filter topic entries by folder path
 */
export function filterEntriesByFolder(
  entries: JournalEntry[],
  folderPath: string | null
): JournalEntry[] {
  const topicEntries = entries.filter(e => e.entry_type === 'topic');

  if (!folderPath) {
    return topicEntries;
  }

  return topicEntries.filter(e =>
    e.folder_path === folderPath ||
    e.folder_path.startsWith(folderPath + '/')
  );
}
