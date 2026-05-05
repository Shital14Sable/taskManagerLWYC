import { v4 as uuidv4 } from 'uuid';

export type ReviewType = 'daily' | 'weekly' | 'monthly';

export interface TaskSummary {
  completed_count: number;
  completed_tasks: Array<{ id: string; title: string; completed_at: string }>;
  stale_count: number;
  stale_tasks: Array<{ id: string; title: string; last_updated: string }>;
  upcoming_deadlines: Array<{ id: string; title: string; deadline: string }>;
  total_time_spent: number;  // In minutes
}

export interface GoalProgress {
  goal_id: string;
  title: string;
  progress: number;
  status: string;
  linked_projects_count: number;
  tasks_completed_in_period: number;
}

export interface HabitSummaryItem {
  habit_id: string;
  title: string;
  scheduled_count: number;
  completed_count: number;
  completion_rate: number;
  current_streak: number;
}

export interface ListSummaryItem {
  list_id: string;
  name: string;
  pending_count: number;
  completed_count: number;
  recent_additions: string[];
}

export interface ReviewContent {
  tasks_completed: TaskSummary;
  goals_progress: GoalProgress[];
  habits_summary: HabitSummaryItem[];
  lists_summary: ListSummaryItem[];
  productivity_score: number;  // 0-100
  highlights: string[];
  areas_for_improvement: string[];
}

export interface Review {
  id: string;
  review_type: ReviewType;
  date: string;  // ISO date string - the date this review is for
  period_start: string;  // ISO date
  period_end: string;  // ISO date
  content: ReviewContent;
  notes: string;  // User-added notes/reflections
  created_at: string;  // ISO datetime string
}

export interface ReviewCreate {
  review_type: ReviewType;
  date?: string | null;
}

export interface ReviewUpdate {
  notes?: string;
}

export function createDefaultTaskSummary(): TaskSummary {
  return {
    completed_count: 0,
    completed_tasks: [],
    stale_count: 0,
    stale_tasks: [],
    upcoming_deadlines: [],
    total_time_spent: 0,
  };
}

export function createDefaultReviewContent(): ReviewContent {
  return {
    tasks_completed: createDefaultTaskSummary(),
    goals_progress: [],
    habits_summary: [],
    lists_summary: [],
    productivity_score: 0,
    highlights: [],
    areas_for_improvement: [],
  };
}

export function createReview(
  reviewType: ReviewType,
  date: string,
  periodStart: string,
  periodEnd: string
): Review {
  return {
    id: uuidv4(),
    review_type: reviewType,
    date,
    period_start: periodStart,
    period_end: periodEnd,
    content: createDefaultReviewContent(),
    notes: '',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate a unique key for the review (used for file naming)
 */
export function getReviewPeriodKey(reviewType: ReviewType, targetDate: Date): string {
  if (reviewType === 'daily') {
    return targetDate.toISOString().split('T')[0];
  } else if (reviewType === 'weekly') {
    // Get ISO week number
    const year = targetDate.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (targetDate.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  } else if (reviewType === 'monthly') {
    const year = targetDate.getFullYear();
    const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }
  return targetDate.toISOString().split('T')[0];
}
