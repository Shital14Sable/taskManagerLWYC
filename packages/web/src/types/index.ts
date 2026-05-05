// Re-export core types from the shared package
export type {
  Task,
  Recurrence,
  TaskStatus,
  EnergyLevel,
  Project,
  ProjectStatus,
  ScheduledTask,
  Schedule,
  ScheduleSummary,
  Goal,
  GoalStatus,
  TimeHorizon,
  GoalCategory,
  Note,
  TaskList as List,
  ListItem,
  ListInstance,
  HabitInstance,
  UserPreferences,
  UserStats,
  Badge,
  LevelProgress,
  Review,
  ReviewType,
  ReviewContent,
  TaskSummary,
  GoalProgress as GoalProgressSummary,
  HabitSummaryItem as HabitSummary,
} from '@trackmind/core';

// Re-export sync types
export type { SyncStatus, SyncResult, AuthState, GitHubUser } from '@trackmind/sync';

// Web-specific types
export type ListType = 'eternal' | 'template' | 'quick';

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string;
  priority?: number;
  difficulty?: number;
  energy_level?: 'low' | 'medium' | 'high';
  estimated_minutes?: number;
  has_deadline?: boolean;
  deadline?: string;
  parent_task_id?: string;
  is_habit?: boolean;
  recurrence?: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    days_of_week?: string[];
    time_of_day?: string;
    end_date?: string;
  };
  tags?: string[];
  needs_review?: boolean;
  dependencies?: string[];
  status?: 'todo' | 'in_progress' | 'completed';
  // Fixed time scheduling (meetings, appointments)
  is_pinned?: boolean;
  pin_type?: 'soft' | 'hard';
  scheduled_for?: string;  // ISO datetime for when the task is scheduled
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  priority?: number;
  parent_id?: string;
  color?: string;
}

export interface TagCategory {
  tag: string;
  name: string;
  parent: string | null;
  keywords: string[];
}

// Default tag colors for lists
export const DEFAULT_TAG_COLORS: Record<string, string> = {
  work: '#3b82f6',
  personal: '#22c55e',
  'priority/high': '#ef4444',
  'priority/medium': '#f59e0b',
  'priority/low': '#6b7280',
  research: '#8b5cf6',
  reading: '#06b6d4',
  watch: '#ec4899',
  buy: '#f97316',
  idea: '#eab308',
};

export function getTagColor(tag: string): string {
  if (DEFAULT_TAG_COLORS[tag]) {
    return DEFAULT_TAG_COLORS[tag];
  }
  const parts = tag.split('/');
  if (parts.length > 1 && DEFAULT_TAG_COLORS[parts[0]]) {
    return DEFAULT_TAG_COLORS[parts[0]];
  }
  return '#6b7280';
}

export interface NoteFolder {
  name: string;
  path: string;
  subfolders: NoteFolder[];
  note_count: number;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  is_daily_note?: boolean;
  date?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  tags?: string[];
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  time_horizon?: 'yearly' | 'quarterly' | 'monthly';
  category?: 'career' | 'health' | 'personal' | 'learning' | 'financial' | 'relationships' | 'other';
  target_date?: string;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  time_horizon?: 'yearly' | 'quarterly' | 'monthly';
  category?: 'career' | 'health' | 'personal' | 'learning' | 'financial' | 'relationships' | 'other';
  target_date?: string;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string;
  status?: 'active' | 'achieved' | 'abandoned';
}

export interface GoalProgress {
  goal_id: string;
  goal_title: string;
  overall_progress: number;
  total_tasks: number;
  completed_tasks: number;
  linked_projects: number;
  projects: {
    project_id: string;
    project_name: string;
    total_tasks: number;
    completed_tasks: number;
    progress: number;
  }[];
}

export interface CreateListInput {
  name: string;
  description?: string;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  default_sort?: 'order' | 'rating' | 'price' | 'priority' | 'due_date';
}

export interface UpdateListInput {
  name?: string;
  description?: string;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  default_sort?: 'order' | 'rating' | 'price' | 'priority' | 'due_date';
  archived?: boolean;
}

export interface CreateListItemInput {
  text: string;
  quantity?: string;
  notes?: string;
  category?: string;
  url?: string;
  tags?: string[];
  children?: CreateListItemInput[];
  order?: number;
  parent_item_id?: string;
  price?: string;
  rating?: number;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  due_date?: string;
  source?: string;
  image_url?: string;
}

export interface UpdateListItemInput {
  text?: string;
  quantity?: string;
  notes?: string;
  category?: string;
  url?: string;
  tags?: string[];
  order?: number;
  completed_at?: string;
  price?: string;
  rating?: number;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  due_date?: string;
  source?: string;
  image_url?: string;
}

export interface SearchResult {
  type: 'task' | 'project' | 'habit';
  id: string;
  title: string;
  description?: string;
  status: string;
  project_id?: string;
  project_name?: string;
  tags: string[];
  priority: number;
  deadline?: string;
  is_habit: boolean;
  score: number;
  matches: string[];
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

// XP gain tracking for task completion
export interface XPGain {
  xpEarned: number;
  newLevel?: number;
  newBadges: import('@trackmind/core').Badge[];
}
