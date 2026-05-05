// Task
export type {
  TaskStatus,
  EnergyLevel,
  PinType,
  RecurrenceFrequency,
  Recurrence,
  Task,
  TaskCreate,
  TaskUpdate,
} from './task';
export { createTask, createDefaultRecurrence } from './task';

// Project
export type { ProjectStatus, Project, ProjectCreate, ProjectUpdate } from './project';
export { createProject } from './project';

// Schedule
export type {
  TimeSlot,
  SchedulePreferences,
  ScheduleConstraints,
  ScheduledTask,
  ScheduleSummary,
  Schedule,
} from './schedule';
export {
  createDefaultSchedulePreferences,
  createDefaultScheduleConstraints,
  createDefaultScheduleSummary,
  createSchedule,
} from './schedule';

// Goal
export type { TimeHorizon, GoalCategory, GoalStatus, Goal, GoalCreate, GoalUpdate } from './goal';
export { createGoal } from './goal';

// List
export type {
  ListType,
  ListItem,
  TaskList,
  ListInstance,
  ListCreate,
  ListUpdate,
  ListItemCreate,
  ListItemUpdate,
  ListInstanceCreate,
  ListInstanceUpdate,
} from './list';
export { createListItem, createList, createListInstance } from './list';

// Note
export type { Note, NoteCreate, NoteUpdate, Folder } from './note';
export { createNote, getNoteSafeTitle, getNoteFilePath } from './note';

// Habit
export type { HabitInstance, HabitInstanceCreate, HabitInstanceUpdate } from './habit';
export { createHabitInstance, getHabitInstanceKey } from './habit';

// Preferences
export type {
  EnergyLevelType,
  DayWorkHours,
  EnergyBlock,
  TaskDefaults,
  SchedulingPreferences,
  DisplayPreferences,
  OnboardingState,
  MoodBlock,
  SidebarPreferences,
  WidgetId,
  UserPreferences,
} from './preferences';
export {
  createDefaultWorkHours,
  createDefaultEnergyPatterns,
  createDefaultTaskDefaults,
  createDefaultSchedulingPreferences,
  createDefaultDisplayPreferences,
  createDefaultPreferences,
  createDefaultSidebarPreferences,
  createDefaultMoodBlocks,
  getWorkHoursForDay,
  getEnergyPatternsForDay,
  getEnergyLevelAtTime,
  getCurrentMoodBlock,
  timeToMinutes,
  minutesToTime,
} from './preferences';

// Gamification
export type { BadgeType, Badge, BadgeAchievement, UserStats } from './gamification';
export {
  BADGE_DEFINITIONS,
  createDefaultStats,
  calculateXP,
  calculateLevel,
  xpForNextLevel,
  xpProgressInLevel,
  checkBadges,
} from './gamification';

// Review
export type {
  ReviewType,
  TaskSummary,
  GoalProgress,
  HabitSummaryItem,
  ListSummaryItem,
  ReviewContent,
  Review,
  ReviewCreate,
  ReviewUpdate,
} from './review';
export {
  createDefaultTaskSummary,
  createDefaultReviewContent,
  createReview,
  getReviewPeriodKey,
} from './review';

// Journal
export type {
  MoodLevel,
  MoodEntry,
  TimeOfDay,
  JournalEntryType,
  JournalPrompt,
  JournalStatsSnapshot,
  JournalEntry,
  JournalEntryCreate,
  JournalEntryUpdate,
  MoodStats,
  MoodCorrelation,
  JournalFolder,
} from './journal';
export {
  MOOD_CONFIG,
  DEFAULT_PROMPTS,
  getCurrentTimeOfDay,
  createJournalEntry,
  createMoodEntry,
  filterEntriesByDateRange,
  filterEntriesByProject,
  filterEntriesByHabit,
  calculateMoodStats,
  calculateMoodCorrelation,
  buildJournalFolderTree,
  searchJournalEntries,
  filterEntriesByFolder,
} from './journal';

// Mood (standalone mood tracking)
export type {
  MoodLevel as MoodCheckInLevel,
  MoodCheckIn,
  MoodCheckInCreate,
  MoodCheckInUpdate,
} from './mood';
export {
  MOOD_EMOJI_CONFIG,
  createMoodCheckIn,
  filterMoodsByTimeRange,
  getLatestMoodForBlock,
  calculateAverageMood,
  calculateMoodTrend,
  groupMoodsByDate,
} from './mood';
